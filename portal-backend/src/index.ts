import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';
import { getPool, closePool } from './db/pool.js';
import { initStatusBroadcast, stopStatusBroadcast } from './services/statusBroadcast.js';

const PORT = parseInt(process.env.PORT || '4000', 10);

async function main(): Promise<void> {
  // Verify database connectivity
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() AS now');
    console.log(`[db] connected — server time: ${(result.rows[0] as { now: string }).now}`);
  } finally {
    client.release();
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] listening on port ${PORT}`);
  });

  // Initialize WebSocket status broadcast on the same HTTP server
  initStatusBroadcast(server);
  console.log('[ws] status broadcast initialized at /ws/status');

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] ${signal} received — shutting down`);
    stopStatusBroadcast();
    server.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
