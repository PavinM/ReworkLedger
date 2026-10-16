import { connectDatabase } from './config/database.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { projectRouter } from './routes/projects.js';
import { taskRouter } from './routes/tasks.js';
import { defectRouter } from './routes/defects.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

dotenv.config();

export const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
  }),
);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ReworkLedger API',
  });
});

app.use('/api/projects', projectRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/defects', defectRouter);
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
