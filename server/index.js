const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const session = require('express-session');
const { initWebSocket } = require('./websocket');
const { log, requestLoggerMiddleware } = require('./logger');

// Initialize DB (runs schema + seed)
require('./db');

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

// Initialize WebSocket
initWebSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    log('SERVER', `Slum Warriors Lagerverwaltung API läuft auf Port ${PORT}`);
    log('SERVER', `Mode: ${isProduction ? 'Production' : 'Development'}`);
    log('SERVER', `WebSocket verfügbar auf ws://0.0.0.0:${PORT}`);
});
