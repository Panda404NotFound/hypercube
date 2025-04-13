import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Маршрут для получения информации о доступных WASM модулях
router.get('/info', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    modules: [
      {
        name: 'hypercube',
        description: 'Core hypercube geometry and physics module',
        version: '0.1.0',
      }
    ],
  });
});

// Маршрут для проверки статуса WASM модулей
router.get('/health', (req: Request, res: Response) => {
  try {
    const wasmPath = path.resolve(__dirname, '../../../wasm/pkg');
    const exists = fs.existsSync(wasmPath);
    
    if (exists) {
      res.status(200).json({
        status: 'success',
        message: 'WASM modules are available',
        path: wasmPath,
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'WASM modules not found',
        path: wasmPath,
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to check WASM modules',
      error: (error as Error).message,
    });
  }
});

export default router; 