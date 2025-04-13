import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import routes from './routes';
import errorHandler from './middleware/errorHandler';
import logger from './utils/logger';

// Загрузка переменных окружения
dotenv.config();

// Создание Express приложения
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Настройка middleware
app.use(helmet()); // Безопасность заголовков
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json()); // Парсинг JSON
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined')); // Логгирование

// Ограничение запросов
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // Максимум 100 запросов на IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Использование маршрутов API
app.use('/api', routes);

// Обработка ошибок
app.use(errorHandler);

// Запуск сервера
app.listen(PORT, () => {
  logger.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app; 