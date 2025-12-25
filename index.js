#!/usr/bin/env node

import 'dotenv/config';
import cluster from 'cluster';
import os from 'os';
import app from './src/core/app.js';
import { initDatabase } from './src/core/database.js';
import { loadAllPlugins } from './src/utils/pluginManager.js';
import logger from './src/utils/logger.js';

const numCPUs = os.cpus().length;
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
    try {
        // Initialize database
        logger.info('🔄 Initializing database...');
        await initDatabase();
        
        // Load all plugins
        logger.info('🔄 Loading plugins...');
        await loadAllPlugins(app);
        
        // Start server
        const server = app.listen(PORT, HOST, () => {
            const asciiArt = `
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║    ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗ ██████╗ ██████╗   ║
║    ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝██╔════╝██╔═══██╗  ║
║    ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗██║     ██║   ██║  ║
║    ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║██║     ██║   ██║  ║
║    ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║╚██████╗╚██████╔╝  ║
║    ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝   ║
║                                                                   ║
╠═══════════════════════════════════════════════════════════════════╣
║                         Version 3.0.0 🚀                          ║
╠═══════════════════════════════════════════════════════════════════╣
║  📍 Server: http://${HOST}:${PORT}                               ║
║  🌐 Environment: ${process.env.NODE_ENV || 'development'}        ║
║  🖥️  Platform: ${process.platform}/${process.arch}               ║
║  ⚡ Node.js: ${process.version}                                   ║
║  📊 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB ║
║  👥 CPU Cores: ${numCPUs}                                        ║
║  ⏰ Started: ${new Date().toLocaleString()}                      ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ⎯ʏᴏᴜ ᴀʀᴇ ᴍʏ ʙᴇsᴛ ғʀɪᴇɴᴅ, ᴍʏ ʜᴜᴍᴀɴ ᴅɪᴀʀʏ, ᴀɴᴅ ᴍʏ ᴏᴛʜᴇʀ ʜᴀʟғ  ║
║  𓄹ꠂ🫶🏻🐣🌷♡゙𓂃                                      ║
║                                                                   ║
║  👤 Owner: ${process.env.OWNER_NAME || 'Abdullah'}               ║
║  📞 Contact: ${process.env.OWNER_NUMBER || '+923288055104'}      ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
            `;
            
            console.log(asciiArt);
            logger.info(`✅ Server running on http://${HOST}:${PORT}`);
            logger.info(`✅ Plugins loaded: ${app.locals.plugins?.length || 0}`);
            logger.info(`✅ Database connected successfully`);
        });
        
        // Graceful shutdown
        const shutdown = async (signal) => {
            logger.info(`\n${signal} received. Starting graceful shutdown...`);
            
            server.close(async () => {
                logger.info('✅ HTTP server closed');
                
                // Close database connections
                try {
                    const { sequelize } = await import('./src/core/database.js');
                    await sequelize?.close();
                    logger.info('✅ Database connections closed');
                } catch (err) {
                    logger.error('Error closing database:', err);
                }
                
                logger.info('✅ Shutdown complete');
                process.exit(0);
            });
            
            // Force shutdown after 10 seconds
            setTimeout(() => {
                logger.error('⚠️  Force shutdown after 10 seconds');
                process.exit(1);
            }, 10000);
        };
        
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        
        // Error handlers
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use`);
                process.exit(1);
            } else {
                logger.error('Server error:', error);
            }
        });
        
        return server;
        
    } catch (error) {
        logger.error('🔥 Failed to start server:', error);
        process.exit(1);
    }
}

// Cluster mode for production
if (isProduction && cluster.isPrimary) {
    logger.info(`Primary ${process.pid} is running`);
    
    // Fork workers
    for (let i = 0; i < Math.min(numCPUs, 4); i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died. Forking new worker...`);
        cluster.fork();
    });
    
} else {
    // Worker process or development mode
    startServer().catch((error) => {
        logger.error('Worker failed:', error);
        process.exit(1);
    });
}
