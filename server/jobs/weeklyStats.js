import cron from 'node-cron';
import db from '../db.js';
import { sendSystemAlert } from '../lib/discord.js';

function compileAndSendStats() {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const dateStr = oneWeekAgo.toISOString().replace('T', ' ').slice(0, 19);

        // Get top active user
        const topUserRows = db.prepare(`
            SELECT person_name, COUNT(*) as tx_count
            FROM transactions
            WHERE created_at >= ?
            GROUP BY person_name
            ORDER BY tx_count DESC
            LIMIT 1
        `).all(dateStr);

        // Get most moved product (by absolute quantity)
        const topProductRows = db.prepare(`
            SELECT p.name, SUM(t.quantity) as total_moved
            FROM transactions t
            JOIN products p ON t.product_id = p.id
            WHERE t.created_at >= ?
            GROUP BY t.product_id
            ORDER BY total_moved DESC
            LIMIT 1
        `).all(dateStr);

        // Get total transactions this week
        const totalTx = db.prepare(`
            SELECT COUNT(*) as count
            FROM transactions
            WHERE created_at >= ?
        `).get(dateStr);

        // If no transactions, don't spam
        if (!totalTx || totalTx.count === 0) {
            return;
        }

        const topUser = topUserRows.length > 0 ? topUserRows[0] : null;
        const topProduct = topProductRows.length > 0 ? topProductRows[0] : null;

        let description = `**Gesamte Transaktionen:** ${totalTx.count}\n\n`;

        if (topUser) {
            description += `🏆 **Aktivster Nutzer:** ${topUser.person_name} (${topUser.tx_count} Transaktionen)\n`;
        }
        if (topProduct) {
            description += `📦 **Meistbewegtes Produkt:** ${topProduct.name} (${topProduct.total_moved} Stück bewegt)\n`;
        }

        sendSystemAlert(
            '📊 Wöchentliche Lager-Statistik',
            description,
            0x9b59b6 // Purple
        );
    } catch (err) {
        console.error('Failed to compile weekly stats:', err);
    }
}

function startWeeklyStatsJob() {
    // Schedule to run every Sunday at 23:00 (11 PM)
    cron.schedule('0 23 * * 0', () => {
        console.log('[Jobs] Running weekly stats compilation...');
        compileAndSendStats();
    }, {
        timezone: "Europe/Berlin" // Or your desired timezone
    });
    console.log('[Jobs] Weekly Stats Scheduler started. Next run: Sunday 23:00.');
}

export { compileAndSendStats };
export default startWeeklyStatsJob;
