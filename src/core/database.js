import { Sequelize } from 'sequelize';
import pg from 'pg';
import chalk from 'chalk';
import logger from '../utils/logger.js';
import { config } from '../../config/database.config.js';

const { Pool } = pg;

let sequelize = null;
let pool = null;
let isConnected = false;

export const initDatabase = async () => {
    try {
        logger.info('🔄 Initializing database connection...');
        
        // Parse database URL
        const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
        
        // Create Sequelize instance
        sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
            host: dbConfig.host,
            port: dbConfig.port,
            dialect: 'postgres',
            logging: (msg) => logger.debug(msg),
            pool: {
                max: parseInt(process.env.DB_POOL_MAX) || 20,
                min: parseInt(process.env.DB_POOL_MIN) || 5,
                acquire: 30000,
                idle: 10000
            },
            dialectOptions: {
                ssl: process.env.DB_SSL === 'true' ? {
                    require: true,
                    rejectUnauthorized: false
                } : false,
                connectTimeout: 10000,
                keepAlive: true,
                statement_timeout: 30000
            },
            retry: {
                max: 5,
                match: [
                    /ConnectionError/,
                    /SequelizeConnectionError/,
                    /SequelizeConnectionRefusedError/,
                    /SequelizeHostNotFoundError/,
                    /SequelizeHostNotReachableError/,
                    /SequelizeInvalidConnectionError/,
                    /SequelizeConnectionTimedOutError/,
                    /TimeoutError/
                ],
                backoffBase: 1000,
                backoffExponent: 1.5
            }
        });
        
        // Create connection pool for sessions
        pool = new Pool({
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.username,
            password: dbConfig.password,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            ssl: process.env.DB_SSL === 'true' ? {
                rejectUnauthorized: false
            } : false
        });
        
        // Test connection
        await sequelize.authenticate();
        isConnected = true;
        
        logger.info(chalk.green('✅ Database connection established'));
        logger.info(`📊 Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
        
        // Sync models with safe options
        await sequelize.sync({
            alter: process.env.NODE_ENV === 'development',
            force: false,
            logging: false
        });
        
        logger.info(chalk.green('✅ Database models synchronized'));
        
        // Create default admin if not exists
        await createDefaultAdmin();
        
        return { sequelize, pool, isConnected };
        
    } catch (error) {
        logger.error(chalk.red('❌ Database connection failed:'), error.message);
        
        // Retry logic
        if (process.env.NODE_ENV === 'production') {
            logger.warn('🔄 Retrying database connection in 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            return initDatabase();
        } else {
            // Fallback to SQLite for development
            logger.warn(chalk.yellow('🔄 Falling back to SQLite for development...'));
            sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: './database.sqlite',
                logging: false,
                retry: {
                    max: 3
                }
            });
            
            await sequelize.authenticate();
            logger.info(chalk.green('✅ SQLite database connected'));
            isConnected = true;
            
            return { sequelize, pool: null, isConnected };
        }
    }
};

export const getDatabase = () => {
    if (!sequelize) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return { sequelize, pool, isConnected };
};

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
        if (pool) {
            await pool.end();
            logger.info('✅ Database pool closed');
        }
    } catch (error) {
        logger.error('Error closing database:', error);
    }
};

// Helper function to parse database URL
function parseDatabaseUrl(url) {
    if (!url) {
        throw new Error('DATABASE_URL is required');
    }
    
    const pattern = /^(?:postgres:\/\/)([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
    const match = url.match(pattern);
    
    if (!match) {
        throw new Error('Invalid database URL format. Expected: postgresql://user:password@host:port/database');
    }
    
    return {
        username: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4]),
        database: match[5]
    };
}

// Create default admin user
async function createDefaultAdmin() {
    try {
        const User = (await import('../models/User.js')).default;
        
        const adminExists = await User.findOne({
            where: { username: process.env.ADMIN_USERNAME || 'admin' }
        });
        
        if (!adminExists) {
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash(
                process.env.ADMIN_PASSWORD || 'admin123',
                12
            );
            
            await User.create({
                username: process.env.ADMIN_USERNAME || 'admin',
                password: hashedPassword,
                email: process.env.ADMIN_EMAIL || 'admin@nexuscore.com',
                role: 'admin',
                name: process.env.OWNER_NAME || 'Administrator',
                phone: process.env.OWNER_NUMBER || '+1234567890',
                isActive: true,
                lastLogin: new Date()
            });
            
            logger.info(chalk.green('✅ Default admin user created'));
        }
    } catch (error) {
        logger.error('Error creating default admin:', error);
    }
}

// Database health check
export const healthCheck = async () => {
    const checks = [];
    
    try {
        // Check connection
        const connectionCheck = await checkConnection();
        checks.push({
            name: 'database_connection',
            status: connectionCheck.connected ? 'healthy' : 'unhealthy',
            details: connectionCheck
        });
        
        // Check models
        const Plugin = (await import('../models/Plugin.js')).default;
        const pluginCount = await Plugin.count();
        checks.push({
            name: 'plugin_table',
            status: 'healthy',
            details: { count: pluginCount }
        });
        
        // Check session table
        const [sessionResult] = await sequelize.query(
            "SELECT COUNT(*) as count FROM sessions"
        );
        checks.push({
            name: 'session_table',
            status: 'healthy',
            details: { count: sessionResult[0]?.count || 0 }
        });
        
        return {
            status: checks.every(c => c.status === 'healthy') ? 'healthy' : 'degraded',
            checks,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        logger.error('Database health check failed:', error);
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
