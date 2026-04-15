import fs from 'fs';
import sharp from 'sharp';
import db from './server/db.js';
import { getOcrSystemPrompt } from './server/prompts/ocrPrompt.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const OLLAMA_MODEL = 'llama3.2-vision:latest';

async function test() {
    try {
        console.log("Loading image...");
        const imageBuffer = fs.readFileSync('test_screenshot.jpg');
        
        console.log("Fetching DB items...");
        const rows = db.prepare('SELECT product_name FROM products').all();
        const validItems = rows.map(r => r.product_name);
        console.log(`Found ${validItems.length} items`);

        console.log("Sharp resize...");
        const optimizedBuffer = await sharp(imageBuffer)
            .resize({ width: 1920, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

        const base64Image = optimizedBuffer.toString('base64');
        const prompt = getOcrSystemPrompt(validItems);

        console.log("Calling Ollama API (this may take a few seconds)...");
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                images: [base64Image],
                format: "json",
                stream: false,
                options: {
                    temperature: 0.1
                }
            })
        });

        if (!response.ok) {
            console.error("HTTP ERROR", response.status, response.statusText);
            return;
        }

        const data = await response.json();
        console.log("\nRAW OLLAMA OUTPUT:");
        console.log(data.response);

        console.log("\nATTEMPTING PARSE:");
        const parsed = JSON.parse(data.response);
        console.log(JSON.stringify(parsed, null, 2));

    } catch (e) {
        console.error("test err:", e);
    }
}

test();
