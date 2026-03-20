/**
 * Simple in-memory rate limiter.
 * @param {number} maxRequests  – allowed requests per window (default 60)
 * @param {number} windowMs    – time window in ms (default 60 000 = 1 min)
 */
export default function rateLimit(maxRequests = 60, windowMs = 60_000) {
    const hits = new Map(); // ip -> { count, resetAt }

    // Cleanup expired entries every 5 minutes
    setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of hits) {
            if (now > entry.resetAt) hits.delete(ip);
        }
    }, 5 * 60_000);

    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress;
        const now = Date.now();
        let entry = hits.get(ip);

        if (!entry || now > entry.resetAt) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(ip, entry);
        }

        entry.count++;

        // Set standard rate-limit headers
        res.set('X-RateLimit-Limit', String(maxRequests));
        res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
        res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

        if (entry.count > maxRequests) {
            const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
            res.set('Retry-After', String(retryAfterSec));
            return res.status(429).json({
                error: 'Rate limit exceeded',
                retry_after_seconds: retryAfterSec,
            });
        }

        next();
    };
}
