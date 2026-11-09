/**
 * Standalone Video Proxy Daemon Server (Runs on port 3002)
 * Exposes a standard OpenAI-compatible HTTP interface for external IDEs,
 * scripts, and apps to tap into pooled Higgsfield, Runway, and Zero-GPU clusters.
 */

import http from 'http';
import { parse } from 'url';
import { VideoGateway } from './videoGateway';
import { sessionVault } from './sessionVault';
import { VideoGenerationRequest } from './types';

const PORT = 3002;

export function startVideoProxyServer(port = PORT): http.Server {
  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const { pathname } = parse(req.url || '', true);

    // Health check & stats
    if (req.method === 'GET' && pathname === '/v1/video/stats') {
      const stats = sessionVault.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats, null, 2));
      return;
    }

    // List sessions
    if (req.method === 'GET' && pathname === '/v1/video/sessions') {
      const sessions = sessionVault.getSessions().map((s) => ({
        id: s.id,
        provider: s.provider,
        label: s.label,
        remainingCredits: s.remainingCredits,
        totalGenerated: s.totalGenerated,
        status: s.status,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessions }, null, 2));
      return;
    }

    // Standard Video Generation endpoint (POST /v1/video/generations)
    if (req.method === 'POST' && pathname === '/v1/video/generations') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}') as VideoGenerationRequest;
          if (!payload.prompt) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing prompt parameter' }));
            return;
          }

          const job = await VideoGateway.generateVideo(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(job, null, 2));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || 'Internal proxy generation error' }));
        }
      });
      return;
    }

    // Catch-all
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found', available: ['/v1/video/generations', '/v1/video/stats', '/v1/video/sessions'] }));
  });

  server.listen(port, () => {
    console.log(`[VideoProxyDaemon] Listening on http://localhost:${port}`);
  });

  return server;
}

if (process.argv[1]?.includes('videoProxyServer')) {
  startVideoProxyServer();
}
