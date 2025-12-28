import { Sequelize } from 'sequelize';
import chalk from 'chalk';
import logger from '../utils/logger.js';

let sequelize = null;
let pool = null;
let isConnected = false;

export const initDatabase = async () => {
    try {
        logger.info('🔄 Initializing database connection...');
        
        const databaseUrl = process.env.DATABASE_URL;
        
        if (!databaseUrl) {
            logger.warn('⚠️  DATABASE_URL not found, using SQLite for development');
            sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: './database.sqlite',
                logging: false
            });
            
            await sequelize.authenticate();
            isConnected = true;
            logger.info(chalk.green('✅ SQLite database connected'));
            return { sequelize, pool: null, isConnected };
        }
        
        // Parse PostgreSQL URL
        const dbConfig = parseDatabaseUrl(databaseUrl);
        
        // Create Sequelize instance
        sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
            host: dbConfig.host,
            port: dbConfig.port,
            dialect: 'postgres',
            logging: false,
            pool: {
                max: 20,
                min: 5,
                acquire: 30000,
                idle: 10000
            },
            dialectOptions: {
                ssl: process.env.NODE_ENV === 'production' ? {
                    require: true,
                    rejectUnauthorized: false
                } : false
            }
        });
        
        // Test connection
        await sequelize.authenticate();
        isConnected = true;
        
        logger.info(chalk.green('✅ PostgreSQL database connected'));
        logger.info(`📊 Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
        
        // Sync models
        await sequelize.sync({ alter: true });
        logger.info(chalk.green('✅ Database models synchronized'));
        
        return { sequelize, pool, isConnected };
        
    } catch (error) {
        logger.error(chalk.red('❌ Database connection failed:'), error.message);
        
        // Fallback to SQLite
        logger.warn('🔄 Falling back to SQLite...');
        sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: './database.sqlite',
            logging: false
        });
        
        await sequelize.authenticate();
        isConnected = true;
        logger.info(chalk.green('✅ SQLite database connected'));
        
        return { sequelize, pool: null, isConnected };
    }
};

export const getDatabase = () => {
    if (!sequelize) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return { sequelize, pool, isConnected };
};

// Helper function to parse database URL
function parseDatabaseUrl(url) {
    const pattern = /^(?:postgres:\/\/)([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
    const match = url.match(pattern);
    
    if (!match) {
        throw new Error('Invalid database URL format');
    }
    
    return {
        username: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4]),
        database: match[5]
    };
}

export const checkConnection = async () => {
    try {
        await sequelize?.authenticate();
        return { connected: true, timestamp: new Date() };
    } catch (error) {
        return { connected: false, error: error.message, timestamp: new Date() };
    }
};

export const closeDatabase = async () => {
    try {
        if (sequelize) {
            await sequelize.close();
            logger.info('✅ Database connection closed');
        }
    } catch (error) {
        logger.error('Error closing database:', error);
    }
};

// Database health check
export const healthCheck = async () => {
    try {
        const connectionCheck = await checkConnection();
        
        return {
            status: connectionCheck.connected ? 'healthy' : 'unhealthy',
            checks: [{
                name: 'database_connection',
                status: connectionCheck.connected ? 'healthy' : 'unhealthy',
                details: connectionCheck
            }],
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        return {
            status: 'unhealthy',
            checks: [{ name: 'health_check', status: 'failed', error: error.message }],
            timestamp: new Date().toISOString()
        };
    }
};

export default {
    initDatabase,
    getDatabase,
    checkConnection,
    closeDatabase,
    healthCheck
};
