import express from 'express';
import { log } from '../logger.js';
import { queueJob, getJobStatus } from '../services/ocrQueue.js';

export const router = express.Router();

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

// POST /api/scanner/scan — Accepts raw image binary and queues OCR job
router.post('/scan', async (req, res) => {
    try {
        const chunks = [];
        let totalSize = 0;

        await new Promise((resolve, reject) => {
            req.on('data', (chunk) => {
                totalSize += chunk.length;
                if (totalSize > MAX_FILE_SIZE) {
                    reject(new Error('File too large (max 15 MB)'));
                    return;
                }
                chunks.push(chunk);
            });
            req.on('end', resolve);
            req.on('error', reject);
        });

        const imageBuffer = Buffer.concat(chunks);
        if (imageBuffer.length === 0) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        let validItems = [];
        try {
            // Lazy load DB internally to avoid circular dependencies if any
            const db = (await import('../db.js')).default;
            const rows = db.prepare('SELECT product_name FROM products').all();
            validItems = rows.map(r => r.product_name);
        } catch (dbErr) {
            log('ERROR', `Could not fetch product names for OCR prompt: ${dbErr.message}`);
        }

        const jobId = queueJob(imageBuffer, validItems);
        res.json({ jobId, status: 'pending' });

    } catch (err) {
        log('ERROR', `Scanner queue error: ${err.message}`);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// GET /api/scanner/job/:id — Poll job status
router.get('/job/:id', (req, res) => {
    const job = getJobStatus(req.params.id);
    if (!job) {
        return res.status(404).json({ error: 'Job not found or expired' });
    }
    res.json(job);
});

// GET /api/scanner/health — Check Ollama status
router.get('/health', async (req, res) => {
    try {
        const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
        const ping = await fetch(OLLAMA_URL);
        res.json({ proxy: 'ok', ocr_service: { status: ping.ok ? 'ok' : 'error' } });
    } catch (err) {
        res.json({ proxy: 'ok', ocr_service: { status: 'unreachable', error: err.message } });
    }
});

export default router;
