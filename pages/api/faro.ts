import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    
    // Format headers to be compatible with fetch
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) headers.append(key, Array.isArray(value) ? value.join(', ') : value);
    });
    const url = process.env.NEXT_PUBLIC_FARO_URL || 'http://alloy-receiver.monitoring.svc.cluster.local:4319/collect';
    console.log('Faro URL:', url);
    // Forward to grafana faro
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
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
    console.error('Error forwarding request:', error);
    return res.status(500).json({ error: error.message });
  }
}