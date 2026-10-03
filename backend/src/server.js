import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5050;

async function start() {
  if (!process.env.MONGODB_URI) {
    console.error('[fatal] MONGODB_URI is missing — copy .env.example to .env');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error('[fatal] JWT_SECRET is missing — copy .env.example to .env');
    process.exit(1);
  }

  await connectDB(process.env.MONGODB_URI);
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`[api] TutWithUs dashboard API listening on http://localhost:${PORT}/api`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[fatal] port ${PORT} is already in use — set a different PORT in backend/.env`);
      process.exit(1);
    }
    throw err;
  });

  const shutdown = (signal) => {
    console.log(`\n[api] ${signal} received, closing…`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[fatal] failed to start', err);
  process.exit(1);
});
