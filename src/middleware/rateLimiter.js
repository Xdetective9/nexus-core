import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from '../utils/logger.js';

// Simple memory rate limiter - works everywhere
const rateLimiter = new RateLimiterMemory({
    points: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    duration: parseInt(process.env.RATE_LIMIT_WINDOW) || 900,
    blockDuration: 60
});

logger.info('✅ Rate limiter initialized');

const rateLimiterMiddleware = async (req, res, next) => {
    try {
        // Skip rate limiting for health checks
        if (req.path === '/health' || req.path === '/status') {
            return next();
        }
        
        // Skip rate limiting for static files
        if (req.path.startsWith('/css/') || 
            req.path.startsWith('/js/') || 
            req.path.startsWith('/assets/') ||
            req.path.startsWith('/uploads/')) {
            return next();
        }
        
        // Use IP address as key
        const key = req.ip;
        
        // Apply rate limiting
        await rateLimiter.consume(key, 1);
        
        next();
        
    } catch (error) {
        if (error instanceof Error) {
            // Rate limit exceeded
            const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 60;
            
            res.set('Retry-After', retryAfter.toString());
            logger.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);
            
            if (req.xhr || req.path.startsWith('/api/')) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many requests',
                    message: 'Please try again later',
                    retryAfter,
                    code: 'RATE_LIMIT_EXCEEDED'
                });
            }
            
            // For web requests
            return res.status(429).render('pages/error', {
                title: 'Too Many Requests',
                layout: 'layouts/main',
                error: {
                    code: 429,
                    message: 'You have made too many requests. Please try again later.',
                    retryAfter: `${retryAfter} seconds`
                }
            });
        }
        
        next(error);
    }
};

// Simple rate limiters
export const authRateLimiter = new RateLimiterMemory({
    points: 5,
    duration: 15 * 60,
    blockDuration: 60 * 60
});

export const apiRateLimiter = new RateLimiterMemory({
    points: 100,
    duration: 60,
    blockDuration: 5 * 60
});

export const pluginUploadRateLimiter = new RateLimiterMemory({
    points: 3,
    duration: 60 * 60,
    blockDuration: 2 * 60 * 60
});

export default rateLimiterMiddleware;
