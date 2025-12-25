import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import logger from '../utils/logger.js';

let rateLimiter;

// Initialize rate limiter based on environment
if (process.env.REDIS_URL) {
    // Use Redis for distributed rate limiting
    const redisClient = new Redis(process.env.REDIS_URL, {
        enableOfflineQueue: false,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        }
    });
    
    rateLimiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'rate_limit',
        points: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
        duration: parseInt(process.env.RATE_LIMIT_WINDOW) || 900, // 15 minutes
        blockDuration: 300, // Block for 5 minutes if exceeded
        insuranceLimiter: new RateLimiterMemory({
            points: 100,
            duration: 60
        })
    });
    
    logger.info('✅ Redis rate limiter initialized');
} else {
    // Use memory rate limiter (for single instance)
    rateLimiter = new RateLimiterMemory({
        points: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        duration: parseInt(process.env.RATE_LIMIT_WINDOW) || 900,
        blockDuration: 60
    });
    
    logger.info('✅ Memory rate limiter initialized');
}

// Custom rate limiter middleware
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
        
        // Different limits for different endpoints
        let pointsToConsume = 1;
        let customDuration = parseInt(process.env.RATE_LIMIT_WINDOW) || 900;
        
        // Stricter limits for authentication endpoints
        if (req.path.includes('/admin/login') || req.path.includes('/api/auth')) {
            pointsToConsume = 5;
            customDuration = 300; // 5 minutes
        }
        
        // Stricter limits for API endpoints
        if (req.path.startsWith('/api/')) {
            pointsToConsume = 2;
            customDuration = 60; // 1 minute
        }
        
        // Apply rate limiting
        await rateLimiter.consume(key, pointsToConsume);
        
        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': process.env.RATE_LIMIT_MAX || 100,
            'X-RateLimit-Remaining': await rateLimiter.get(key)?.remainingPoints || 0,
            'X-RateLimit-Reset': new Date(Date.now() + customDuration * 1000).toISOString()
        });
        
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
            
            // For web requests, show a friendly error page
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

// Special rate limiters for specific endpoints
export const authRateLimiter = new RateLimiterMemory({
    points: 5, // 5 attempts
    duration: 15 * 60, // 15 minutes
    blockDuration: 60 * 60 // Block for 1 hour
});

export const apiRateLimiter = new RateLimiterMemory({
    points: 100, // 100 requests
    duration: 60, // 1 minute
    blockDuration: 5 * 60 // Block for 5 minutes
});

export const pluginUploadRateLimiter = new RateLimiterMemory({
    points: 3, // 3 uploads
    duration: 60 * 60, // 1 hour
    blockDuration: 2 * 60 * 60 // Block for 2 hours
});

// Apply rate limiting by endpoint
export const applyRateLimit = (limiter, keyFn = (req) => req.ip) => {
    return async (req, res, next) => {
        try {
            const key = keyFn(req);
            await limiter.consume(key, 1);
            next();
        } catch (error) {
            const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 60;
            
            res.set('Retry-After', retryAfter.toString());
            
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                retryAfter,
                code: 'RATE_LIMIT_EXCEEDED'
            });
        }
    };
};

export default rateLimiterMiddleware;
