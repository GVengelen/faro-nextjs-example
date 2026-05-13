import { NextApiRequest, NextApiResponse } from 'next'
import { createLogger, traceContextFromTraceparent } from '../../lib/logger';

const logger = createLogger('api.faro');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const traceparentHeader = Array.isArray(req.headers.traceparent)
    ? req.headers.traceparent[0]
    : req.headers.traceparent;
  const requestTraceContext = traceContextFromTraceparent(traceparentHeader);

  try {
    // Format headers to be compatible with fetch
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) headers.append(key, Array.isArray(value) ? value.join(', ') : value);
    });

    const url = process.env.NEXT_PUBLIC_FARO_URL || 'http://faro-receiver.monitoring.svc.cluster.local:12347/collect';
    logger.info('Forwarding Faro request', {
      url,
      method: req.method,
      ...requestTraceContext,
    });

    // Forward to grafana faro
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
    });

    logger.info('Received Faro upstream response', {
      statusCode: response.status,
      ...requestTraceContext,
    });

    // Send response to client
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error: any) {
    logger.error('Error forwarding Faro request', {
      error,
      ...requestTraceContext,
    });

    return res.status(500).json({ error: error.message });
  }
}
