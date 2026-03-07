const db = require('../db');

/**
 * Sends a message/embed to the configured Discord webhook.
 * @param {Object} payload The payload matching Discord Webhook execution structure
 */
async function sendDiscordAlert(payload) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
        const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('webhook_enabled');
        if (setting && setting.value === 'false') {
            return; // Webhook disabled globally
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error('[Discord Webhook] Failed to send alert:', response.statusText);
        }
    } catch (err) {
        console.error('[Discord Webhook] Error sending alert:', err.message);
    }
}

/**
 * Convenience function for common alerts
 */
async function sendSystemAlert(title, description, color = 0x3498db) {
    await sendDiscordAlert({
        embeds: [{
            title,
            description,
            color,
            timestamp: new Date().toISOString()
        }]
    });
}

module.exports = {
    sendDiscordAlert,
    sendSystemAlert,
};
