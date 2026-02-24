import express from 'express';
import cors from 'cors';
import path from 'path';
import daysRouter from './routes/days';
import wordsRouter from './routes/words';
import { getDb, closeDb } from './db';

const app = express();
const PORT = parseInt(process.env.PORT || '3141', 10);

app.use(cors());
app.use(express.json());

// Initialize DB on startup
getDb();

// API routes
app.use('/api/days', daysRouter);
app.use('/api/days/:date/words', wordsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve client build in production
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
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
