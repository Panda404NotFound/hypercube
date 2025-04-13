import { Router } from 'express';
import statusRoutes from './status.routes';
import wasmRoutes from './wasm.routes';

const router = Router();

// Определение базовых маршрутов
router.use('/status', statusRoutes);
router.use('/wasm', wasmRoutes);

export default router; 