import { body, query, param, validationResult } from 'express-validator';
import validator from 'validator';
import logger from '../utils/logger.js';

const validationMiddleware = {
    // Validate plugin upload
    validatePluginUpload: [
        body('name')
            .notEmpty().withMessage('Plugin name is required')
            .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
            .trim()
            .escape(),
        
        body('version')
            .notEmpty().withMessage('Version is required')
            .matches(/^(\d+\.)?(\d+\.)?(\*|\d+)$/).withMessage('Invalid version format')
            .trim()
            .escape(),
        
        body('description')
            .notEmpty().withMessage('Description is required')
            .isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters')
            .trim()
            .escape(),
        
        body('route')
            .notEmpty().withMessage('Route is required')
            .matches(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/).withMessage('Invalid route format')
            .trim()
            .escape(),
        
        body('category')
            .notEmpty().withMessage('Category is required')
            .isIn(['ai', 'automation', 'tools', 'media', 'development', 'social', 'productivity', 'utility'])
            .withMessage('Invalid category')
            .trim()
            .escape(),
        
        body('author')
            .optional()
            .isLength({ max: 100 }).withMessage('Author name too long')
            .trim()
            .escape(),
        
        body('dependencies')
            .optional()
            .isArray().withMessage('Dependencies must be an array'),
        
        body('config')
            .optional()
            .isObject().withMessage('Config must be an object'),
        
        // Custom validation for file
        body().custom((value, { req }) => {
            if (!req.files || !req.files.plugin) {
                throw new Error('Plugin file is required');
            }
            
            const file = req.files.plugin;
            const allowedTypes = ['application/json', 'application/zip'];
            const maxSize = 10 * 1024 * 1024; // 10MB
            
            if (!allowedTypes.includes(file.mimetype)) {
                throw new Error('Only JSON and ZIP files are allowed');
            }
            
            if (file.size > maxSize) {
                throw new Error('File size must be less than 10MB');
            }
            
            return true;
        })
    ],
    
    // Validate admin login
    validateLogin: [
        body('username')
            .optional()
            .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
            .trim()
            .escape(),
        
        body('password')
            .optional()
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
            .trim(),
        
        body('verification_code')
            .optional()
            .isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits')
            .isNumeric().withMessage('Verification code must be numeric')
            .trim(),
        
        // Custom validation: require either password or verification code
        body().custom((value, { req }) => {
            if (!req.body.password && !req.body.verification_code) {
                throw new Error('Either password or verification code is required');
            }
            return true;
        })
    ],
    
    // Validate file upload
    validateFileUpload: [
        body('file')
            .custom((value, { req }) => {
                if (!req.files || Object.keys(req.files).length === 0) {
                    throw new Error('No files were uploaded');
                }
                return true;
            }),
        
        body().custom((value, { req }) => {
            const files = req.files;
            const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024;
            const allowedTypes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'application/pdf', 'application/json', 'text/plain',
                'video/mp4', 'audio/mpeg'
            ];
            
            for (const file of Object.values(files)) {
                if (file.size > maxSize) {
                    throw new Error(`File ${file.name} exceeds maximum size of ${maxSize / 1024 / 1024}MB`);
                }
                
                if (!allowedTypes.includes(file.mimetype)) {
                    throw new Error(`File type ${file.mimetype} not allowed`);
                }
            }
            
            return true;
        })
    ],
    
    // Validate API request
    validateApiRequest: [
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
            .toInt(),
        
        query('page')
            .optional()
            .isInt({ min: 1 }).withMessage('Page must be at least 1')
            .toInt(),
        
        query('sort')
            .optional()
            .isIn(['name', 'date', 'rating', 'downloads']).withMessage('Invalid sort field'),
        
        query('order')
            .optional()
            .isIn(['asc', 'desc']).withMessage('Order must be asc or desc')
    ],
    
    // Validate user registration
    validateUserRegistration: [
        body('username')
            .notEmpty().withMessage('Username is required')
            .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
            .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Username can only contain letters, numbers, dots, underscores and hyphens')
            .trim()
            .escape(),
        
        body('email')
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email address')
            .normalizeEmail(),
        
        body('password')
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
            .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
            .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
            .matches(/\d/).withMessage('Password must contain at least one number')
            .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
        
        body('confirmPassword')
            .notEmpty().withMessage('Please confirm your password')
            .custom((value, { req }) => {
                if (value !== req.body.password) {
                    throw new Error('Passwords do not match');
                }
                return true;
            })
    ],
    
    // Validate contact form
    validateContactForm: [
        body('name')
            .notEmpty().withMessage('Name is required')
            .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
            .trim()
            .escape(),
        
        body('email')
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email address')
            .normalizeEmail(),
        
        body('message')
            .notEmpty().withMessage('Message is required')
            .isLength({ min: 10, max: 2000 }).withMessage('Message must be 10-2000 characters')
            .trim()
            .escape(),
        
        body('phone')
            .optional()
            .isMobilePhone().withMessage('Invalid phone number')
            .trim()
            .escape()
    ],
    
    // Sanitize input
    sanitizeInput: (req, res, next) => {
        // Sanitize query parameters
        if (req.query) {
            Object.keys(req.query).forEach(key => {
                if (typeof req.query[key] === 'string') {
                    req.query[key] = validator.escape(validator.trim(req.query[key]));
                }
            });
        }
        
        // Sanitize body parameters
        if (req.body) {
            Object.keys(req.body).forEach(key => {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = validator.escape(validator.trim(req.body[key]));
                }
            });
        }
        
        // Sanitize params
        if (req.params) {
            Object.keys(req.params).forEach(key => {
                if (typeof req.params[key] === 'string') {
                    req.params[key] = validator.escape(validator.trim(req.params[key]));
                }
            });
        }
        
        next();
    },
    
    // Custom validator for URLs
    isUrl: (value) => {
        if (!value) return true;
        return validator.isURL(value, {
            protocols: ['http', 'https'],
            require_protocol: true,
            require_valid_protocol: true
        });
    },
    
    // Custom validator for file size
    isFileSize: (value, maxSizeMB) => {
        if (!value) return true;
        const maxSize = maxSizeMB * 1024 * 1024;
        return value.size <= maxSize;
    },
    
    // Custom validator for file type
    isFileType: (value, allowedTypes) => {
        if (!value) return true;
        return allowedTypes.includes(value.mimetype);
    },
    
    // Validation result handler
    validationResult: (req, res, next) => {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(err => err.msg);
            
            logger.warn('Validation failed:', {
                errors: errorMessages,
                path: req.path,
                method: req.method,
                ip: req.ip
            });
            
            if (req.xhr || req.path.startsWith('/api/')) {
                return res.status(400).json({
                    success: false,
                    errors: errorMessages,
                    code: 'VALIDATION_FAILED'
                });
            }
            
            req.flash('error', errorMessages[0]);
            return res.redirect('back');
        }
        
        next();
    },
    
    // Async validation wrapper
    asyncHandler: (validations) => {
        return async (req, res, next) => {
            try {
                await Promise.all(validations.map(validation => validation.run(req)));
                next();
            } catch (error) {
                next(error);
            }
        };
    }
};

export default validationMiddleware;
