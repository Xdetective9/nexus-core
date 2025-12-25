import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

const authMiddleware = {
    // Basic authentication check
    isAuthenticated: (req, res, next) => {
        if (req.session && req.session.user) {
            return next();
        }
        
        // Check JWT token
        const token = req.headers.authorization?.split(' ')[1] || 
                     req.cookies?.token || 
                     req.query.token;
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = decoded;
                return next();
            } catch (error) {
                logger.warn('Invalid JWT token:', error.message);
            }
        }
        
        // API requests return JSON
        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }
        
        // Web requests redirect to login
        req.flash('error', 'Please login to access this page');
        return res.redirect('/admin/login');
    },
    
    // Admin role check
    isAdmin: (req, res, next) => {
        const user = req.session?.user || req.user;
        
        if (user && user.role === 'admin') {
            return next();
        }
        
        logger.warn(`Unauthorized admin access attempt by ${user?.username || 'anonymous'}`);
        
        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(403).json({
                success: false,
                error: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }
        
        req.flash('error', 'Admin access required');
        return res.redirect('/admin/login');
    },
    
    // API key authentication
    hasApiKey: (req, res, next) => {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;
        
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key required',
                code: 'API_KEY_REQUIRED'
            });
        }
        
        // In production, you'd validate against database
        const validKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
        
        if (!validKeys.includes(apiKey)) {
            return res.status(403).json({
                success: false,
                error: 'Invalid API key',
                code: 'INVALID_API_KEY'
            });
        }
        
        next();
    },
    
    // Rate limiting per user
    rateLimitByUser: (req, res, next) => {
        const userId = req.session?.user?.id || req.ip;
        const requestCount = req.app.locals.rateLimitMap?.get(userId) || 0;
        
        if (requestCount > 100) { // 100 requests per window
            return res.status(429).json({
                success: false,
                error: 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED'
            });
        }
        
        if (!req.app.locals.rateLimitMap) {
            req.app.locals.rateLimitMap = new Map();
        }
        
        req.app.locals.rateLimitMap.set(userId, requestCount + 1);
        
        // Clear after 15 minutes
        setTimeout(() => {
            req.app.locals.rateLimitMap.delete(userId);
        }, 15 * 60 * 1000);
        
        next();
    },
    
    // CSRF protection
    csrfProtection: (req, res, next) => {
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
            return next();
        }
        
        const csrfToken = req.body._csrf || req.headers['x-csrf-token'];
        const sessionToken = req.session.csrfToken;
        
        if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
            logger.warn('CSRF token validation failed');
            return res.status(403).json({
                success: false,
                error: 'CSRF token validation failed',
                code: 'CSRF_FAILED'
            });
        }
        
        next();
    },
    
    // Generate CSRF token
    generateCsrfToken: (req, res, next) => {
        if (!req.session.csrfToken) {
            req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
        }
        res.locals.csrfToken = req.session.csrfToken;
        next();
    },
    
    // Permission-based access control
    hasPermission: (permissions) => {
        return (req, res, next) => {
            const user = req.session?.user || req.user;
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }
            
            const userPermissions = user.permissions || [];
            const hasPermission = permissions.some(permission => 
                userPermissions.includes(permission) || 
                user.role === 'admin'
            );
            
            if (!hasPermission) {
                logger.warn(`Permission denied for ${user.username}: ${permissions.join(', ')}`);
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                    code: 'PERMISSION_DENIED'
                });
            }
            
            next();
        };
    },
    
    // Two-factor authentication
    require2FA: (req, res, next) => {
        if (req.session.user?.twoFactorVerified) {
            return next();
        }
        
        if (req.path === '/admin/verify-2fa' || req.path === '/admin/send-2fa') {
            return next();
        }
        
        return res.redirect('/admin/verify-2fa');
    },
    
    // Validate password strength
    validatePassword: (password) => {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        return password.length >= minLength && 
               hasUpperCase && 
               hasLowerCase && 
               hasNumbers && 
               hasSpecialChar;
    },
    
    // Hash password
    hashPassword: async (password) => {
        const salt = await bcrypt.genSalt(12);
        return await bcrypt.hash(password, salt);
    },
    
    // Compare password
    comparePassword: async (password, hash) => {
        return await bcrypt.compare(password, hash);
    },
    
    // Generate JWT token
    generateToken: (user) => {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions || []
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
    },
    
    // Verify JWT token
    verifyToken: (token) => {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return null;
        }
    },
    
    // Audit log middleware
    auditLog: (action) => {
        return (req, res, next) => {
            const startTime = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                const user = req.session?.user || req.user;
                
                logger.info('AUDIT', {
                    action,
                    userId: user?.id || 'anonymous',
                    username: user?.username || 'anonymous',
                    ip: req.ip,
                    method: req.method,
                    url: req.originalUrl,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    userAgent: req.get('User-Agent'),
                    timestamp: new Date().toISOString()
                });
            });
            
            next();
        };
    }
};

export default authMiddleware;
