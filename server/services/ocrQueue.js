import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { log } from '../logger.js';
import { getOcrSystemPrompt } from '../prompts/ocrPrompt.js';

// In-memory queue
const jobs = new Map();
const queue = [];
let isProcessing = false;

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = 'llama3.2-vision:latest';

/**
 * Adds an image to the OCR queue.
 * @param {Buffer} imageBuffer - Raw image buffer
 * @param {string[]} validItems - List of valid product names for few-shot prompting
 * @returns {string} jobId
 */
export function queueJob(imageBuffer, validItems = []) {
    const jobId = uuidv4();
    jobs.set(jobId, {
        id: jobId,
        status: 'pending',
        result: null,
        error: null,
        timestamp: Date.now()
    });

    queue.push({ jobId, imageBuffer, validItems });
    log('SCANNER', `Job ${jobId} added to queue. Queue length: ${queue.length}`);
    
    // Start processing if not already running
    if (!isProcessing) {
        processQueue();
    }
    
    return jobId;
}

/**
 * Gets the status of an OCR job
 * @param {string} jobId 
 * @returns {Object|null}
 */
export function getJobStatus(jobId) {
    return jobs.get(jobId) || null;
}

/**
 * Main worker loop
 */
async function processQueue() {
    if (queue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const { jobId, imageBuffer, validItems } = queue.shift();
    const job = jobs.get(jobId);
    
    if (!job) {
        processQueue();
        return;
    }

    job.status = 'processing';
    log('SCANNER', `Processing job ${jobId}...`);

    try {
        // Optimize and resize image using sharp to reduce LLM workload
        const optimizedBuffer = await sharp(imageBuffer)
            .resize({ width: 1920, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

        const base64Image = optimizedBuffer.toString('base64');

        log('SCANNER', `Job ${jobId} image optimized. Sending to Ollama (${OLLAMA_MODEL})...`);
        
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: getOcrSystemPrompt(validItems),
                images: [base64Image],
                format: "json", // Force JSON output
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(data.response);
            // Ensure it's an array
            if (!Array.isArray(parsedResult)) {
                parsedResult = parsedResult.items || parsedResult.data || [];
            }
        } catch (e) {
            log('ERROR', `Failed to parse Ollama JSON response: ${data.response}`);
            parsedResult = [];
        }

        job.status = 'completed';
        job.result = parsedResult;
        log('SCANNER', `Job ${jobId} completed. Found ${parsedResult.length} items.`);

    } catch (err) {
        log('ERROR', `Job ${jobId} failed: ${err.message}`);
        job.status = 'error';
        job.error = err.message;
    }

    // Process next job
    setTimeout(processQueue, 100);
}

// Cleanup old jobs periodically to prevent memory leaks
setInterval(() => {
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    let deleted = 0;
    for (const [id, job] of jobs.entries()) {
        if (now - job.timestamp > ONE_HOUR && (job.status === 'completed' || job.status === 'error')) {
            jobs.delete(id);
            deleted++;
        }
    }
    if (deleted > 0) {
        log('SCANNER', `Cleaned up ${deleted} old scanner jobs.`);
    }
}, 15 * 60 * 1000);
