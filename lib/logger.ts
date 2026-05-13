import { trace } from "@opentelemetry/api";

export type LogLevel = "debug" | "info" | "warn" | "error";

type JsonRecord = Record<string, unknown>;

interface TraceContext {
  traceId?: string;
  spanId?: string;
}

interface LoggerOptions {
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

function getActiveTraceContext(): TraceContext {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) {
    return {};
  }

  const spanContext = activeSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

function toSerializableError(value: unknown): JsonRecord {
  if (!(value instanceof Error)) {
    return {
      value,
    };
  }

  return {
    name: value.name,
    message: value.message,
    stack: value.stack,
  };
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

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[minLevel];
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

export function traceContextFromTraceparent(
  headerValue?: string,
): TraceContext {
  if (!headerValue) {
    return {};
  }

  const [version, traceId, spanId] = headerValue.trim().split("-");
  const isValid =
    version === "00" &&
    traceId &&
    spanId &&
    traceId.length === 32 &&
    spanId.length === 16;
  if (!isValid) {
    return {};
  }

  return {
    traceId,
    spanId,
  };
}

export function createLogger(name: string, options?: LoggerOptions) {
  const minLevel =
    options?.minLevel ?? normalizeLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
  const baseContext = options?.baseContext ?? {};

  function log(level: LogLevel, message: string, fields?: JsonRecord): void {
    if (!shouldLog(level, minLevel)) {
      return;
    }

    const traceContext = getActiveTraceContext();
    const payload: JsonRecord = {
      timestamp: new Date().toISOString(),
      level,
      logger: name,
      message,
      ...baseContext,
      ...traceContext,
      ...fields,
    };

    if (payload.error instanceof Error) {
      payload.error = toSerializableError(payload.error);
    }

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
