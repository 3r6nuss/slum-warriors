/**
 * Middleware that validates the Bearer token against BOT_API_KEY env var.
 */
export default function requireApiKey(req, res, next) {
    const key = process.env.BOT_API_KEY;

    if (!key) {
        return res.status(503).json({
            error: 'Bot API is not configured. Set BOT_API_KEY environment variable.',
        });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header. Use: Bearer <API_KEY>' });
    }

    const token = authHeader.slice(7);
    if (token !== key) {
        return res.status(403).json({ error: 'Invalid API key' });
    }

    next();
}
