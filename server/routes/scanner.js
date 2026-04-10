import express from 'express';
import { log } from '../logger.js';

export const router = express.Router();

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

// POST /api/scanner/scan — Forward image to OCR microservice
router.post('/scan', async (req, res) => {
    try {
        // Read raw body as buffer (image is sent as multipart from frontend)
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('multipart/form-data')) {
            return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
        }

        // Collect all chunks
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

        const body = Buffer.concat(chunks);

        // Forward the entire multipart request to the OCR service
        const ocrResponse = await fetch(`${OCR_SERVICE_URL}/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': contentType,
            },
            body: body,
        });

        if (!ocrResponse.ok) {
            const errorText = await ocrResponse.text();
            log('ERROR', `OCR service error: ${ocrResponse.status} - ${errorText}`);
            return res.status(ocrResponse.status).json({
                error: `OCR service error: ${errorText}`,
            });
        }

        const result = await ocrResponse.json();
        log('SCANNER', `OCR scan complete: ${result.items?.length || 0} items found`);
        res.json(result);

    } catch (err) {
        log('ERROR', `Scanner proxy error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/scanner/health — Check OCR service status
router.get('/health', async (req, res) => {
    try {
        const ocrResponse = await fetch(`${OCR_SERVICE_URL}/health`);
        const data = await ocrResponse.json();
        res.json({ proxy: 'ok', ocr_service: data });
    } catch (err) {
        res.json({ proxy: 'ok', ocr_service: { status: 'unreachable', error: err.message } });
    }
});

export default router;
