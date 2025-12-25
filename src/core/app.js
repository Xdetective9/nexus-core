import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import fileUpload from 'express-fileupload';
import methodOverride from 'method-override';
import flash from 'connect-flash';
import expressLayouts from 'express-ejs-layouts';

// Custom middleware
import rateLimiter from '../middleware/rateLimiter.js';
import authMiddleware from '../middleware/auth.js';
import validator from '../middleware/validator.js';
import { getDatabase } from './database.js';
import logger from '../utils/logger.js';

// ES Modules fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ========== DATABASE SESSION STORE ==========
const { pool } = getDatabase();
const PgStore = pgSession(session);

const sessionStore = new PgStore({
    pool,
    tableName: 'sessions',
    createTableIfMissing: true,
    pruneSessionInterval: 3600
});

// ========== VIEW ENGINE SETUP ==========
app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, '../views'),
    path.join(__dirname, '../plugins')
]);
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// ========== STATIC FILES ==========
const staticOptions = {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=UTF-8');
        }
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        }
        if (filePath.endsWith('.woff2')) {
            res.setHeader('Content-Type', 'font/woff2');
        }
    }
};

app.use(express.static(path.join(__dirname, '../../public'), staticOptions));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads'), staticOptions));

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdn.socket.io"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "data:"],
            imgSrc: ["'self'", "data:", "https:", "blob:", "http:"],
            connectSrc: ["'self'", "ws:", "wss:", "https://cdn.socket.io"],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            manifestSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    originAgentCluster: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    xFrameOptions: { action: "deny" },
    xContentTypeOptions: true,
    xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
    xXssProtection: false
}));

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ========== BASIC MIDDLEWARE ==========
if (process.env.GZIP === 'true') {
    app.use(compression({ level: parseInt(process.env.COMPRESSION_LEVEL) || 6 }));
}

app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined', {
    stream: { write: (message) => logger.http(message.trim()) }
}));

app.use(express.json({
    limit: process.env.UPLOAD_LIMIT || '100mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use(express.urlencoded({
    extended: true,
    limit: process.env.UPLOAD_LIMIT || '100mb',
    parameterLimit: 10000
}));

app.use(methodOverride('_method'));
app.use(flash());

app.use(fileUpload({
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024,
        files: 10
    },
    useTempFiles: true,
    tempFileDir: process.env.TEMP_PATH || '/tmp',
    abortOnLimit: true,
    responseOnLimit: 'File size limit exceeded',
    createParentPath: true,
    safeFileNames: true,
    preserveExtension: 4
}));

// ========== SESSION CONFIGURATION ==========
app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    name: process.env.SESSION_NAME,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: process.env.DOMAIN ? new URL(process.env.DOMAIN).hostname : undefined
    }
}));

logger.info('✅ PostgreSQL session store configured');

// ========== GLOBAL VARIABLES ==========
app.use((req, res, next) => {
    // App info
    res.locals.app = {
        name: 'NexusCore',
        version: '3.0.0',
        description: 'Ultimate Modular Platform',
        year: new Date().getFullYear()
    };
    
    // Owner info
    res.locals.owner = {
        name: process.env.OWNER_NAME || 'Abdullah',
        number: process.env.OWNER_NUMBER || '+923288055104',
        email: process.env.OWNER_EMAIL,
        whatsapp: process.env.OWNER_WHATSAPP
    };
    
    // User info
    res.locals.user = req.session.user || null;
    res.locals.isAdmin = req.session.user?.role === 'admin';
    
    // Messages
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    res.locals.warning = req.flash('warning');
    
    // Request info
    res.locals.path = req.path;
    res.locals.query = req.query;
    
    // Environment
    res.locals.env = {
        node: process.version,
        production: process.env.NODE_ENV === 'production'
    };
    
    next();
});

// ========== RATE LIMITING ==========
app.use(rateLimiter);

// ========== BASIC ROUTES ==========

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'connected',
        plugins: app.locals.plugins?.length || 0,
        version: '3.0.0'
    });
});

// Status page
app.get('/status', (req, res) => {
    res.json({
        server: {
            status: 'online',
            uptime: process.uptime(),
            memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
            platform: `${process.platform}/${process.arch}`
        },
        plugins: {
            total: app.locals.plugins?.length || 0,
            active: app.locals.plugins?.filter(p => p.active).length || 0
        },
        system: {
            cpus: require('os').cpus().length,
            load: require('os').loadavg(),
            freemem: `${(require('os').freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`
        }
    });
});

// Home page
app.get('/', (req, res) => {
    res.render('pages/index', {
        title: 'Home | NexusCore',
        layout: 'layouts/main'
    });
});

// Features page
app.get('/features', (req, res) => {
    res.render('pages/features', {
        title: 'Features | NexusCore',
        layout: 'layouts/main',
        features: app.locals.plugins || []
    });
});

// Plugins page
app.get('/plugins', (req, res) => {
    const plugins = app.locals.plugins || [];
    const categories = [...new Set(plugins.map(p => p.category))];
    
    res.render('pages/plugins', {
        title: 'Plugins | NexusCore',
        layout: 'layouts/main',
        plugins: plugins.filter(p => p.active),
        categories,
        totalPlugins: plugins.length
    });
});

// ========== AUTH ROUTES ==========

// Admin login
app.get('/admin/login', (req, res) => {
    if (req.session.user?.role === 'admin') {
        return res.redirect('/admin');
    }
    res.render('pages/admin-login', {
        title: 'Admin Login | NexusCore',
        layout: 'layouts/main'
    });
});

app.post('/admin/login', 
    validator.validateLogin,
    async (req, res) => {
        const errors = validator.validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error', errors.array()[0].msg);
            return res.redirect('/admin/login');
        }
        
        const { username, password, verification_code } = req.body;
        
        // Password login
        if (username === process.env.ADMIN_USERNAME && 
            password === process.env.ADMIN_PASSWORD) {
            req.session.user = {
                id: 'admin',
                username,
                role: 'admin',
                name: process.env.OWNER_NAME,
                loginTime: new Date()
            };
            req.flash('success', 'Welcome back, Admin!');
            return res.redirect('/admin');
        }
        
        // WhatsApp verification
        if (verification_code && req.session.verificationCode) {
            if (verification_code === req.session.verificationCode.toString()) {
                req.session.user = {
                    id: 'whatsapp_admin',
                    username: 'whatsapp_user',
                    role: 'admin',
                    name: process.env.OWNER_NAME,
                    loginTime: new Date(),
                    authMethod: 'whatsapp'
                };
                delete req.session.verificationCode;
                req.flash('success', 'WhatsApp verification successful!');
                return res.redirect('/admin');
            }
        }
        
        req.flash('error', 'Invalid credentials');
        res.redirect('/admin/login');
    }
);

// Request WhatsApp verification
app.post('/admin/request-verification', async (req, res) => {
    try {
        const code = Math.floor(100000 + Math.random() * 900000);
        req.session.verificationCode = code;
        req.session.verificationRequestTime = Date.now();
        
        // Here you would integrate with Twilio/WhatsApp API
        // For now, we'll log it
        logger.info(`WhatsApp verification code for ${process.env.OWNER_NUMBER}: ${code}`);
        
        req.flash('info', `Verification code sent to ${process.env.OWNER_NUMBER}`);
        res.redirect('/admin/login');
    } catch (error) {
        logger.error('Verification request failed:', error);
        req.flash('error', 'Failed to send verification code');
        res.redirect('/admin/login');
    }
});

// Admin logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ========== ADMIN ROUTES ==========
const adminRouter = express.Router();

adminRouter.use(authMiddleware.isAuthenticated);
adminRouter.use(authMiddleware.isAdmin);

adminRouter.get('/', (req, res) => {
    res.render('pages/admin', {
        title: 'Admin Dashboard | NexusCore',
        layout: 'layouts/admin'
    });
});

// Plugin management
adminRouter.get('/plugins', async (req, res) => {
    const Plugin = (await import('../models/Plugin.js')).default;
    const plugins = await Plugin.findAll();
    
    res.render('admin/plugins', {
        title: 'Plugin Management | NexusCore',
        layout: 'layouts/admin',
        plugins
    });
});

adminRouter.post('/plugins/upload', async (req, res) => {
    try {
        if (!req.files || !req.files.plugin) {
            req.flash('error', 'No plugin file uploaded');
            return res.redirect('/admin/plugins');
        }
        
        const pluginFile = req.files.plugin;
        const pluginData = JSON.parse(pluginFile.data.toString());
        
        // Validate plugin structure
        const requiredFields = ['name', 'version', 'description', 'route', 'category'];
        for (const field of requiredFields) {
            if (!pluginData[field]) {
                req.flash('error', `Missing required field: ${field}`);
                return res.redirect('/admin/plugins');
            }
        }
        
        // Save to uploads
        const uploadDir = path.join(__dirname, '../../uploads/plugins');
        const fileName = `${Date.now()}-${pluginData.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        const filePath = path.join(uploadDir, fileName);
        
        await pluginFile.mv(filePath);
        
        // Save to database
        const Plugin = (await import('../models/Plugin.js')).default;
        await Plugin.create({
            ...pluginData,
            installedAt: new Date(),
            active: true
        });
        
        req.flash('success', `Plugin "${pluginData.name}" uploaded successfully!`);
        res.redirect('/admin/plugins');
        
    } catch (error) {
        logger.error('Plugin upload error:', error);
        req.flash('error', `Upload failed: ${error.message}`);
        res.redirect('/admin/plugins');
    }
});

// System settings
adminRouter.get('/settings', (req, res) => {
    res.render('admin/settings', {
        title: 'System Settings | NexusCore',
        layout: 'layouts/admin'
    });
});

// User management
adminRouter.get('/users', async (req, res) => {
    const User = (await import('../models/User.js')).default;
    const users = await User.findAll();
    
    res.render('admin/users', {
        title: 'User Management | NexusCore',
        layout: 'layouts/admin',
        users
    });
});

// Mount admin routes
app.use('/admin', adminRouter);

// ========== PLUGIN LOADING ==========
// This happens after routes are defined
app.use((req, res, next) => {
    // Plugin routes are loaded dynamically by pluginManager
    next();
});

// ========== ERROR HANDLERS ==========

// 404 Handler
app.use((req, res, next) => {
    res.status(404).render('pages/error', {
        title: '404 - Page Not Found',
        layout: 'layouts/main',
        error: {
            code: 404,
            message: 'The page you are looking for does not exist.',
            suggestion: 'Check the URL or go back to homepage'
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Server error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    
    const statusCode = err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.status(statusCode).render('pages/error', {
        title: `${statusCode} - Error`,
        layout: 'layouts/main',
        error: {
            code: statusCode,
            message: isProduction ? 'Something went wrong on our end.' : err.message,
            stack: isProduction ? undefined : err.stack,
            suggestion: 'Please try again later or contact support.'
        }
    });
});

export default app;
