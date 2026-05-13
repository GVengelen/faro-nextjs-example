type LogLevel = "debug" | "info" | "warn" | "error";

type JsonRecord = Record<string, unknown>;

interface BrowserLoggerOptions {
  enabled?: boolean;
  minLevel?: LogLevel;
  baseContext?: JsonRecord;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeLevel(rawLevel: string | undefined): LogLevel {
  if (
    rawLevel === "debug" ||
    rawLevel === "info" ||
    rawLevel === "warn" ||
    rawLevel === "error"
  ) {
    return rawLevel;
  }
  return "info";
}

function getConsoleMethod(level: LogLevel): (...data: unknown[]) => void {
  if (level === "debug") {
    return console.debug;
  }
  if (level === "info") {
    return console.info;
  }
  if (level === "warn") {
    return console.warn;
  }
  return console.error;
}

function safeStringify(payload: JsonRecord): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(payload, (_key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value as object)) {
        return "[Circular]";
      }
      seen.add(value as object);
    }
    return value;
  });
}

function extractTraceContextFromServerTiming(): JsonRecord {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return {};
  }

  const navigationEntry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (!navigationEntry || !navigationEntry.serverTiming?.length) {
    return {};
  }

  const traceParentEntry = navigationEntry.serverTiming.find(
    (item) => item.name === "traceparent",
  );
  if (!traceParentEntry?.description) {
    return {};
  }

  const parts = traceParentEntry.description.split("-");
  if (parts.length < 3) {
    return {};
  }

  const [, traceId, spanId] = parts;
  if (!traceId || !spanId) {
    return {};
  }

  return {
    traceId,
    spanId,
  };
}

export function createBrowserLogger(
  name: string,
  options?: BrowserLoggerOptions,
) {
  const minLevel =
    options?.minLevel ?? normalizeLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
  const enabled =
    options?.enabled ?? process.env.NEXT_PUBLIC_ENABLE_BROWSER_LOGS === "true";
  const baseContext = options?.baseContext ?? {};

  function log(level: LogLevel, message: string, fields?: JsonRecord): void {
    if (!enabled || LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[minLevel]) {
      return;
    }

    const payload: JsonRecord = {
      timestamp: new Date().toISOString(),
      level,
      logger: name,
      message,
      ...baseContext,
      ...extractTraceContextFromServerTiming(),
      ...fields,
    };

    getConsoleMethod(level)(safeStringify(payload));
  }

  return {
    debug: (message: string, fields?: JsonRecord) =>
      log("debug", message, fields),
    info: (message: string, fields?: JsonRecord) =>
      log("info", message, fields),
    warn: (message: string, fields?: JsonRecord) =>
      log("warn", message, fields),
    error: (message: string, fields?: JsonRecord) =>
      log("error", message, fields),
  };
}
