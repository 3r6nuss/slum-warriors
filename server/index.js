const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const session = require('express-session');
const { initWebSocket } = require('./websocket');
const { log, requestLoggerMiddleware } = require('./logger');
const { startStatsJob } = require('./jobs/weeklyStats');

// Initialize DB (runs schema + seed)
const db = require('./db');
const { sendSystemAlert } = require('./lib/discord');

const app = express();
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
if (isProduction) {
    app.set('trust proxy', 1); // Trust NPM/Cloudflare reverse proxy
}
app.use(cors({
    origin: isProduction ? true : 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(requestLoggerMiddleware);

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'slum-warriors-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction ? true : false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax',
        proxy: isProduction,
    },
}));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/adjustments', require('./routes/adjustments'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (isProduction) {
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    // SPA fallback – serve index.html for all non-API routes
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        } else {
            next();
        }
    });
}

// Global API Error Handler
app.use((err, req, res, next) => {
    log('ERROR', `Express Error: ${err.message}`);
    try {
        const stmt = db.prepare('INSERT INTO error_logs (level, message, stack, context) VALUES (?, ?, ?, ?)');
        stmt.run('error', err.message, err.stack, `Route: ${req.method} ${req.originalUrl}`);

        sendSystemAlert(
            '⚠️ API Error',
            `**Route:** ${req.method} ${req.originalUrl}\n**Message:** ${err.message}\n\`\`\`\n${err.stack?.slice(0, 1000)}\n\`\`\``,
            0xe74c3c
        );
    } catch (dbErr) {
        console.error('Failed to log error to DB:', dbErr);
    }

    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Initialize WebSocket
initWebSocket(server);

// Start Background Jobs
startStatsJob();

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    log('SERVER', `Slum Warriors Lagerverwaltung API läuft auf Port ${PORT}`);
    log('SERVER', `Mode: ${isProduction ? 'Production' : 'Development'}`);
    log('SERVER', `WebSocket verfügbar auf ws://0.0.0.0:${PORT}`);
});

// Uncaught Exceptions and Promise Rejections
process.on('uncaughtException', (err) => {
    log('FATAL', `Uncaught Exception: ${err.message}`);
    try {
        db.prepare('INSERT INTO error_logs (level, message, stack, context) VALUES (?, ?, ?, ?)').run('fatal', err.message, err.stack, 'uncaughtException');
        sendSystemAlert('💥 Fatal Crash', `**Uncaught Exception:** ${err.message}\n\`\`\`\n${err.stack?.slice(0, 1000)}\n\`\`\``, 0x992d22);
    } catch (e) {
        console.error('Fallback logging failed', e);
    }
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    log('ERROR', `Unhandled Rejection: ${reason}`);
    try {
        const msg = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack : '';
        db.prepare('INSERT INTO error_logs (level, message, stack, context) VALUES (?, ?, ?, ?)').run('error', msg, stack, 'unhandledRejection');
        sendSystemAlert('⚠️ Unhandled Promise', `**Rejection:** ${msg}\n\`\`\`\n${stack?.slice(0, 1000)}\n\`\`\``, 0xe67e22);
    } catch (e) {
        console.error('Fallback logging failed', e);
    }
});
