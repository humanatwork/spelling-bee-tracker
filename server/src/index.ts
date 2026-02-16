import express from 'express';
import cors from 'cors';
import daysRouter from './routes/days';
import wordsRouter from './routes/words';
import backfillRouter from './routes/backfill';
import { getDb, closeDb } from './db';

const app = express();
const PORT = 3141;

app.use(cors());
app.use(express.json());

// Initialize DB on startup
getDb();

// Routes
app.use('/api/days', daysRouter);
app.use('/api/days/:date/words', wordsRouter);
app.use('/api/days/:date/backfill', backfillRouter);

// Global stats (phase 2)
app.get('/api/stats', (_req, res) => {
  res.status(501).json({ error: 'Global stats not implemented yet (phase 2)' });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Spelling Bee Tracker API running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
