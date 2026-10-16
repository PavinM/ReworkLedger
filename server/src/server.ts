import { connectDatabase } from './config/database.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { projectRouter } from './routes/projects.js';
import { taskRouter } from './routes/tasks.js';
import { defectRouter } from './routes/defects.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { timeEntryRouter } from './routes/timeEntries.js';
import { payrollRouter } from './routes/payroll.js';
import { auditRouter } from './routes/audit.js';
import { authRouter } from './routes/auth.js';
import { analysisRouter } from './routes/analysis.js';

dotenv.config();

export const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: (origin, callback) => {
      const configuredOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
      const allowedOrigins = process.env.NODE_ENV === 'production'
        ? new Set([configuredOrigin])
        : new Set([
            configuredOrigin,
            'http://localhost:5173',
            'http://localhost:5174',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5174',
          ]);
      const isLocalDevelopmentOrigin = origin
        ? /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
        : true;
      if (!origin || allowedOrigins.has(origin) || (process.env.NODE_ENV !== 'production' && isLocalDevelopmentOrigin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'));
    },
  }),
);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ReworkLedger API',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/projects', projectRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/defects', defectRouter);
app.use('/api/time-entries', timeEntryRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/audit-logs', auditRouter);
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(`ReworkLedger API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

void startServer();
