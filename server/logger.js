/**
 * Centralized server-side logger with in-memory ring buffer.
 * Captures all log output for the admin console.
 */

const MAX_ENTRIES = 500;
const logBuffer = [];
let logIdCounter = 0;

const LEVELS = { info: 'INFO', warn: 'WARN', error: 'ERROR' };

function createEntry(level, category, message) {
    const entry = {
        id: ++logIdCounter,
        timestamp: new Date().toISOString(),
        level,
        category,
        message: typeof message === 'string' ? message : JSON.stringify(message),
    };

    logBuffer.push(entry);
    if (logBuffer.length > MAX_ENTRIES) {
        logBuffer.shift();
    }

    return entry;
}

/**
 * Log a message to the ring buffer.
 * @param {'SERVER'|'WS'|'AUTH'|'API'|'DB'} category 
 * @param {string} message 
 * @param {'INFO'|'WARN'|'ERROR'} level 
 */
function log(category, message, level = 'INFO') {
    const entry = createEntry(level, category, message);

    // Also output to real console
    const prefix = `[${entry.timestamp}] [${level}] [${category}]`;
    if (level === 'ERROR') {
        console.error(`${prefix} ${entry.message}`);
    } else {
        console.log(`${prefix} ${entry.message}`);
    }

    return entry;
}

/**
 * Get log entries, optionally filtered.
 * @param {Object} opts
 * @param {string} [opts.since] - ISO timestamp, return only entries after this
 * @param {number} [opts.limit] - Max entries to return (from most recent)
 * @param {string} [opts.category] - Filter by category
 */
function getLogs({ since, limit, category } = {}) {
    let result = logBuffer;

    if (since) {
        const sinceDate = new Date(since);
        result = result.filter(e => new Date(e.timestamp) > sinceDate);
    }

    if (category) {
        result = result.filter(e => e.category === category.toUpperCase());
    }

    if (limit) {
        result = result.slice(-limit);
    }

    return result;
}

/**
 * Express middleware that logs every API request.
 */
function requestLoggerMiddleware(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const msg = `${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`;
        const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
        log('API', msg, level);
    });

    next();
}

export { log, getLogs, requestLoggerMiddleware };
