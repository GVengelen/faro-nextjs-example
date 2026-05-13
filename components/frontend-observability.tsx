"use client";

import { faro, getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { createBrowserLogger } from '../lib/browser-logger';

const logger = createBrowserLogger('frontend.observability', {
  enabled: process.env.NEXT_PUBLIC_ENABLE_BROWSER_LOGS === 'true',
});

export default function FrontendObservability(){
  // skip if already initialized
  if (faro.api) {
    logger.debug('Faro already initialized');
    return null;
  }

  try {
    initializeFaro({
      url: "/api/faro",
      app: {
        name: process.env.NEXT_PUBLIC_FARO_APP_NAME || 'faro_client:webjs',
        namespace: process.env.NEXT_PUBLIC_FARO_APP_NAMESPACE || undefined,
        version: process.env.VERCEL_DEPLOYMENT_ID || '1.0.0',
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
      },

      instrumentations: [
        // Mandatory, omits default instrumentations otherwise.
        ...getWebInstrumentations(),

        // Tracing package to get end-to-end visibility for HTTP requests.
        new TracingInstrumentation(),
      ],
    });

    logger.info('Initialized Faro frontend observability', {
      endpoint: '/api/faro',
      appName: process.env.NEXT_PUBLIC_FARO_APP_NAME || 'faro_client:webjs',
    });
  } catch (error) {
    logger.error('Failed to initialize Faro frontend observability', {
      error,
    });

    return null;
  }

  return null;
}
