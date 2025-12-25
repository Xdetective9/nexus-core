import winston from 'winston';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDir = process.env.LOG_PATH || path.join(__dirname, '../../logs');

// Create log directory if it doesn't exist
import fs from 'fs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for console
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let color = chalk.white;
        
        switch (level) {
            case 'error': color = chalk.red; break;
            case 'warn': color = chalk.yellow; break;
            case 'info': color = chalk.cyan; break;
            case 'debug': color = chalk.magenta; break;
            case 'http': color = chalk.gray; break;
            default: color = chalk.white;
        }
        
        const levelStr = color(level.toUpperCase().padEnd(5));
        const timeStr = chalk.gray(timestamp);
        
        let metaStr = '';
        if (Object.keys(meta).length > 0 && level !== 'http') {
            metaStr = chalk.gray(' ' + JSON.stringify(meta));
        }
        
        return `${timeStr} ${levelStr} ${message}${metaStr}`;
    })
);

// File format
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

// Create logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: fileFormat,
    transports: [
        // Console transport
        new winston.transports.Console({
            format: consoleFormat
        }),
        
        // Error file transport
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        
        // Combined file transport
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            tailable: true
        }),
        
        // HTTP requests file transport
        new winston.transports.File({
            filename: path.join(logDir, 'http.log'),
            level: 'http',
            maxsize: 5242880, // 5MB
            maxFiles: 3,
            tailable: true
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log')
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log')
        })
    ]
});

// Custom methods for different log types
logger.success = (message, meta = {}) => {
    logger.info(`${chalk.green('✓')} ${message}`, meta);
};

logger.fail = (message, meta = {}) => {
    logger.error(`${chalk.red('✗')} ${message}`, meta);
};

logger.warning = (message, meta = {}) => {
    logger.warn(`${chalk.yellow('⚠')} ${message}`, meta);
};

logger.debug = (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
        logger.debug(`${chalk.magenta('🔍')} ${message}`, meta);
    }
};

logger.api = (method, url, status, duration, meta = {}) => {
    let statusColor = chalk.green;
    if (status >= 400) statusColor = chalk.yellow;
    if (status >= 500) statusColor = chalk.red;
    
    logger.http(`${method} ${url} ${statusColor(status)} ${duration}ms`, meta);
};

logger.plugin = (action, pluginName, meta = {}) => {
    logger.info(`${chalk.blue('🧩')} ${action}: ${pluginName}`, meta);
};

logger.database = (action, query, duration, meta = {}) => {
    logger.debug(`${chalk.cyan('🗄️')} ${action} ${duration}ms`, { query, ...meta });
};

// Export logger
export default logger;
