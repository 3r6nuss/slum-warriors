import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { setupWebSocket } from './websocket.js';
import { log, requestLoggerMiddleware } from './logger.js';
import startWeeklyStatsJob from './jobs/weeklyStats.js';

// Initialize DB (runs schema + seed)
import db from './db.js';
import { sendSystemAlert } from './lib/discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import transactionsRoutes from './routes/transactions.js';
import adjustmentsRoutes from './routes/adjustments.js';
import adminRoutes from './routes/admin.js';
import statsRoutes from './routes/stats.js';
import logsRoutes from './routes/logs.js';

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/adjustments', adjustmentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/logs', logsRoutes);

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
app.use((err, req, res) => {
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
setupWebSocket(server);

// Start Background Jobs
startWeeklyStatsJob();

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

process.on('unhandledRejection', (reason) => {
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
