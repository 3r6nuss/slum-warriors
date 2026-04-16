import { log } from './logger.js';

/**
 * Async Error Wrapper for Express API Routes
 * Eliminates the need for try/catch blocks in every route.
 * Instead of:
 *   router.get('/endpoint', async (req, res) => {
 *      try { ... } catch (err) { res.status(500)... }
 *   })
 * Use:
 *   router.get('/endpoint', asyncHandler(async (req, res) => {
 *      ...
 *   }))
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
        // We log it locally to console, the Global Error Handler in index.js handles the response
        log('ERROR', `[AsyncHandler] Caught error in ${req.method} ${req.originalUrl}: ${err.message}`);
        next(err);
    });
};
