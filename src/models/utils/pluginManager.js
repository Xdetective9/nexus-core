import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import logger from './logger.js';
import { getDatabase } from '../core/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PluginManager extends EventEmitter {
    constructor() {
        super();
        this.plugins = new Map();
        this.pluginsPath = path.join(__dirname, '../plugins');
        this.uploadsPath = path.join(__dirname, '../../uploads/plugins');
        this.cache = new Map();
        this.loaded = false;
        this.stats = {
            total: 0,
            active: 0,
            errors: 0,
            loadTime: 0
        };
        
        this.ensureDirectories();
    }
    
    async ensureDirectories() {
        const dirs = [
            this.pluginsPath,
            this.uploadsPath,
            path.join(this.uploadsPath, 'temp'),
            path.join(this.uploadsPath, 'backup')
        ];
        
        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
            }
        }
    }
    
    async loadAllPlugins(app) {
        const startTime = Date.now();
        logger.info('🔄 Loading plugins...');
        
        try {
            // Clear previous plugins
            this.plugins.clear();
            this.cache.clear();
            
            // Load from database
            await this.loadFromDatabase(app);
            
            // Load from filesystem
            await this.loadFromFilesystem(app);
            
            // Update app locals
            app.locals.plugins = Array.from(this.plugins.values());
            app.locals.pluginCategories = this.getCategories();
            app.locals.featuredPlugins = this.getFeaturedPlugins();
            
            this.stats.loadTime = Date.now() - startTime;
            this.stats.total = this.plugins.size;
            this.stats.active = Array.from(this.plugins.values()).filter(p => p.active).length;
            
            this.loaded = true;
            this.emit('plugins:loaded', this.stats);
            
            logger.info(chalk.green(`✅ Loaded ${this.stats.total} plugins (${this.stats.active} active) in ${this.stats.loadTime}ms`));
            
            // Start plugin health monitor
            this.startHealthMonitor();
            
        } catch (error) {
            logger.error('❌ Plugin loading failed:', error);
            this.stats.errors++;
            this.emit('plugins:error', error);
        }
    }
    
    async loadFromDatabase(app) {
        try {
            const Plugin = (await import('../models/Plugin.js')).default;
            const dbPlugins = await Plugin.findAll({
                where: { active: true },
                order: [['category', 'ASC'], ['name', 'ASC']]
            });
            
            for (const dbPlugin of dbPlugins) {
                const pluginData = dbPlugin.toJSON();
                const pluginKey = `${pluginData.name}@${pluginData.version}`;
                
                if (!this.plugins.has(pluginKey)) {
                    await this.registerPlugin(app, pluginData);
                    this.plugins.set(pluginKey, pluginData);
                    logger.debug(`📦 Database plugin: ${pluginData.name} v${pluginData.version}`);
                }
            }
            
        } catch (error) {
            logger.warn('⚠️  No plugins in database or database error:', error.message);
        }
    }
    
    async loadFromFilesystem(app) {
        try {
            const pluginFolders = await fs.readdir(this.pluginsPath);
            
            for (const folder of pluginFolders) {
                if (folder.startsWith('_') || folder.startsWith('.') || folder === 'node_modules') {
                    continue;
                }
                
                const pluginPath = path.join(this.pluginsPath, folder);
                const stat = await fs.stat(pluginPath);
                
                if (stat.isDirectory()) {
                    await this.loadPluginFromFolder(app, folder, pluginPath);
                }
            }
            
        } catch (error) {
            logger.error('❌ Filesystem plugin loading error:', error);
        }
    }
    
    async loadPluginFromFolder(app, folder, pluginPath) {
        try {
            const configPath = path.join(pluginPath, 'plugin.json');
            
            if (!await this.fileExists(configPath)) {
                logger.warn(`⚠️  Skipping ${folder}: No plugin.json found`);
                return;
            }
            
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            // Validate config
            if (!this.validatePluginConfig(config)) {
                logger.warn(`⚠️  Skipping ${folder}: Invalid plugin configuration`);
                return;
            }
            
            const pluginKey = `${config.name}@${config.version}`;
            
            // Check if already loaded
            if (this.plugins.has(pluginKey)) {
                logger.debug(`⏭️  Skipping ${config.name}: Already loaded`);
                return;
            }
            
            // Load routes
            const routesPath = path.join(pluginPath, 'routes.js');
            if (await this.fileExists(routesPath)) {
                const routesModule = await import(`file://${routesPath}`);
                if (typeof routesModule.default === 'function') {
                    routesModule.default(app, config);
                    logger.debug(`🛣️  Routes registered: ${config.name}`);
                }
            }
            
            // Load controller
            const controllerPath = path.join(pluginPath, 'controller.js');
            if (await this.fileExists(controllerPath)) {
                const controllerModule = await import(`file://${controllerPath}`);
                config.controller = controllerModule.default || controllerModule;
                logger.debug(`🎮 Controller loaded: ${config.name}`);
            }
            
            // Load view if exists
            const viewPath = path.join(pluginPath, 'view.ejs');
            if (await this.fileExists(viewPath)) {
                config.hasView = true;
                logger.debug(`👁️  View available: ${config.name}`);
            }
            
            // Load dependencies if any
            if (config.dependencies && config.dependencies.length > 0) {
                await this.checkDependencies(config);
            }
            
            // Save to cache
            this.cache.set(pluginKey, {
                config,
                path: pluginPath,
                loadedAt: new Date(),
                stats: {
                    requests: 0,
                    errors: 0,
                    lastUsed: null
                }
            });
            
            // Save to database if not exists
            await this.saveToDatabase(config);
            
            this.plugins.set(pluginKey, config);
            logger.info(chalk.green(`✅ Plugin loaded: ${config.name} v${config.version}`));
            
            this.emit('plugin:loaded', config);
            
        } catch (error) {
            logger.error(`❌ Failed to load plugin ${folder}:`, error.message);
            this.stats.errors++;
            this.emit('plugin:error', { folder, error });
        }
    }
    
    async registerPlugin(app, config) {
        try {
            const pluginFolder = config.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const pluginPath = path.join(this.pluginsPath, pluginFolder);
            const routesPath = path.join(pluginPath, 'routes.js');
            
            if (await this.fileExists(routesPath)) {
                const routesModule = await import(`file://${routesPath}`);
                if (typeof routesModule.default === 'function') {
                    routesModule.default(app, config);
                }
            }
            
        } catch (error) {
            logger.error(`❌ Failed to register plugin ${config.name}:`, error.message);
        }
    }
    
    async installPlugin(pluginFile, pluginData) {
        try {
            logger.info(`🔄 Installing plugin: ${pluginData.name} v${pluginData.version}`);
            
            // Validate plugin
            if (!this.validatePluginConfig(pluginData)) {
                throw new Error('Invalid plugin configuration');
            }
            
            // Check for conflicts
            const existingPlugin = Array.from(this.plugins.values())
                .find(p => p.name === pluginData.name || p.route === pluginData.route);
            
            if (existingPlugin) {
                throw new Error(`Plugin conflict: ${existingPlugin.name} already exists`);
            }
            
            // Create plugin directory
            const pluginFolder = pluginData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const pluginPath = path.join(this.pluginsPath, pluginFolder);
            
            await fs.mkdir(pluginPath, { recursive: true });
            
            // Save plugin files
            const pluginJsonPath = path.join(pluginPath, 'plugin.json');
            await fs.writeFile(pluginJsonPath, JSON.stringify(pluginData, null, 2));
            
            // Save uploaded files
            if (pluginFile) {
                const uploadPath = path.join(this.uploadsPath, `${Date.now()}-${pluginData.name}.zip`);
                await pluginFile.mv(uploadPath);
            }
            
            // Save to database
            const Plugin = (await import('../models/Plugin.js')).default;
            const plugin = await Plugin.create({
                ...pluginData,
                installedAt: new Date(),
                active: true,
                status: 'active'
            });
            
            logger.info(chalk.green(`✅ Plugin installed: ${pluginData.name} v${pluginData.version}`));
            
            this.emit('plugin:installed', plugin);
            
            return {
                success: true,
                plugin,
                message: `Plugin ${pluginData.name} installed successfully`
            };
            
        } catch (error) {
            logger.error('❌ Plugin installation failed:', error);
            
            this.emit('plugin:install:error', error);
            
            return {
                success: false,
                error: error.message,
                message: `Failed to install plugin: ${error.message}`
            };
        }
    }
    
    async uninstallPlugin(pluginName) {
        try {
            logger.info(`🔄 Uninstalling plugin: ${pluginName}`);
            
            // Find plugin
            const plugin = Array.from(this.plugins.values())
                .find(p => p.name === pluginName);
            
            if (!plugin) {
                throw new Error(`Plugin ${pluginName} not found`);
            }
            
            // Update database
            const Plugin = (await import('../models/Plugin.js')).default;
            await Plugin.update(
                { active: false, status: 'inactive' },
                { where: { name: pluginName } }
            );
            
            // Remove from memory
            const pluginKey = `${plugin.name}@${plugin.version}`;
            this.plugins.delete(pluginKey);
            this.cache.delete(pluginKey);
            
            logger.info(chalk.yellow(`🗑️  Plugin uninstalled: ${pluginName}`));
            
            this.emit('plugin:uninstalled', pluginName);
            
            return {
                success: true,
                message: `Plugin ${pluginName} uninstalled successfully`
            };
            
        } catch (error) {
            logger.error('❌ Plugin uninstallation failed:', error);
            
            return {
                success: false,
                error: error.message,
                message: `Failed to uninstall plugin: ${error.message}`
            };
        }
    }
    
    async updatePlugin(pluginName, updateData) {
        try {
            logger.info(`🔄 Updating plugin: ${pluginName}`);
            
            // Update database
            const Plugin = (await import('../models/Plugin.js')).default;
            const [updated] = await Plugin.update(
                { ...updateData, lastUpdated: new Date() },
                { where: { name: pluginName } }
            );
            
            if (updated === 0) {
                throw new Error(`Plugin ${pluginName} not found`);
            }
            
            // Reload plugin
            const plugin = await Plugin.findOne({ where: { name: pluginName } });
            
            // Update in memory
            const pluginKey = `${plugin.name}@${plugin.version}`;
            this.plugins.set(pluginKey, plugin.toJSON());
            
            logger.info(chalk.blue(`🔄 Plugin updated: ${pluginName}`));
            
            this.emit('plugin:updated', plugin);
            
            return {
                success: true,
                plugin,
                message: `Plugin ${pluginName} updated successfully`
            };
            
        } catch (error) {
            logger.error('❌ Plugin update failed:', error);
            
            return {
                success: false,
                error: error.message,
                message: `Failed to update plugin: ${error.message}`
            };
        }
    }
    
    validatePluginConfig(config) {
        const required = ['name', 'version', 'description', 'route', 'category'];
        const missing = required.filter(field => !config[field]);
        
        if (missing.length > 0) {
            logger.error(`Missing required fields: ${missing.join(', ')}`);
            return false;
        }
        
        if (!config.route.startsWith('/')) {
            logger.error('Route must start with /');
            return false;
        }
        
        if (config.version && !/^(\d+\.)?(\d+\.)?(\*|\d+)$/.test(config.version)) {
            logger.error('Invalid version format');
            return false;
        }
        
        return true;
    }
    
    async checkDependencies(config) {
        const missingDeps = [];
        
        for (const dep of config.dependencies) {
            try {
                await import(dep);
            } catch {
                missingDeps.push(dep);
            }
        }
        
        if (missingDeps.length > 0) {
            logger.warn(`⚠️  Missing dependencies for ${config.name}: ${missingDeps.join(', ')}`);
            return false;
        }
        
        return true;
    }
    
    async saveToDatabase(config) {
        try {
            const Plugin = (await import('../models/Plugin.js')).default;
            
            const [plugin, created] = await Plugin.findOrCreate({
                where: { name: config.name },
                defaults: {
                    ...config,
                    installedAt: new Date(),
                    active: true
                }
            });
            
            if (!created) {
                await plugin.update({
                    ...config,
                    lastUpdated: new Date()
                });
            }
            
            return plugin;
            
        } catch (error) {
            logger.error('Failed to save plugin to database:', error);
            return null;
        }
    }
    
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    getCategories() {
        const categories = new Set();
        for (const plugin of this.plugins.values()) {
            if (plugin.category) {
                categories.add(plugin.category);
            }
        }
        return Array.from(categories);
    }
    
    getFeaturedPlugins() {
        return Array.from(this.plugins.values())
            .filter(p => p.featured && p.active)
            .slice(0, 6);
    }
    
    getPlugin(name) {
        return Array.from(this.plugins.values()).find(p => p.name === name);
    }
    
    getPluginByRoute(route) {
        return Array.from(this.plugins.values()).find(p => p.route === route);
    }
    
    getPluginsByCategory(category) {
        return Array.from(this.plugins.values())
            .filter(p => p.category === category && p.active);
    }
    
    searchPlugins(query) {
        const q = query.toLowerCase();
        return Array.from(this.plugins.values())
            .filter(p => 
                p.active && (
                    p.name.toLowerCase().includes(q) ||
                    p.description.toLowerCase().includes(q) ||
                    (p.tags && p.tags.some(tag => tag.toLowerCase().includes(q)))
                )
            );
    }
    
    startHealthMonitor() {
        // Monitor plugin health every 5 minutes
        setInterval(() => {
            this.checkPluginHealth();
        }, 5 * 60 * 1000);
    }
    
    async checkPluginHealth() {
        const healthReport = {
            timestamp: new Date(),
            total: this.plugins.size,
            healthy: 0,
            warnings: 0,
            errors: 0,
            details: []
        };
        
        for (const [key, plugin] of this.plugins) {
            try {
                // Check if plugin route is accessible
                // This is a basic health check
                const cacheEntry = this.cache.get(key);
                
                if (cacheEntry && cacheEntry.stats.errors > 10) {
                    healthReport.errors++;
                    healthReport.details.push({
                        plugin: plugin.name,
                        status: 'error',
                        message: 'Too many errors'
                    });
                } else {
                    healthReport.healthy++;
                    healthReport.details.push({
                        plugin: plugin.name,
                        status: 'healthy'
                    });
                }
            } catch (error) {
                healthReport.errors++;
                healthReport.details.push({
                    plugin: plugin.name,
                    status: 'error',
                    message: error.message
                });
            }
        }
        
        logger.debug('Plugin health check:', healthReport);
        this.emit('plugins:health', healthReport);
        
        return healthReport;
    }
    
    getStats() {
        return {
            ...this.stats,
            categories: this.getCategories().length,
            cacheSize: this.cache.size,
            loaded: this.loaded,
            timestamp: new Date()
        };
    }
    
    async backupPlugins() {
        try {
            const backupDir = path.join(this.uploadsPath, 'backup', Date.now().toString());
            await fs.mkdir(backupDir, { recursive: true });
            
            // Backup plugin configurations
            const backupData = Array.from(this.plugins.values());
            const backupFile = path.join(backupDir, 'plugins-backup.json');
            
            await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
            
            logger.info(`✅ Plugins backed up to ${backupFile}`);
            
            return {
                success: true,
                backupFile,
                count: backupData.length
            };
            
        } catch (error) {
            logger.error('❌ Plugin backup failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
const pluginManager = new PluginManager();

// Export functions
export const loadAllPlugins = (app) => pluginManager.loadAllPlugins(app);
export const installPlugin = (pluginFile, pluginData) => pluginManager.installPlugin(pluginFile, pluginData);
export const uninstallPlugin = (pluginName) => pluginManager.uninstallPlugin(pluginName);
export const updatePlugin = (pluginName, updateData) => pluginManager.updatePlugin(pluginName, updateData);
export const getPlugin = (name) => pluginManager.getPlugin(name);
export const getPluginsByCategory = (category) => pluginManager.getPluginsByCategory(category);
export const searchPlugins = (query) => pluginManager.searchPlugins(query);
export const getPluginStats = () => pluginManager.getStats();
export const backupPlugins = () => pluginManager.backupPlugins();

export default pluginManager;
