import { Router, Request, Response } from 'express';

const router = Router();

// Маршрут для проверки статуса сервера
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'HYPERCUBE API server is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

export default router; 