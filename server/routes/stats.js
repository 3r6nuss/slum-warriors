import express from 'express';
export const router = express.Router();
import db from '../db.js';

// Helper to get dates for the last N days
function getLastNDays(n) {
    const dates = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]); // YYYY-MM-DD
    }
    return dates;
}

// GET /api/stats/overview
router.get('/overview', (req, res) => {
    try {
        // Total unique products & total items in stock Across all warehouses
        const inventoryStats = db.prepare(`
            SELECT 
                COUNT(DISTINCT product_id) as total_products,
                SUM(quantity) as total_items
            FROM inventory
        `).get();

        // Top 5 active users (by number of transactions in last 7 days)
        const topUsers = db.prepare(`
            SELECT person_name, COUNT(*) as tx_count, SUM(quantity) as items_moved
            FROM transactions 
            WHERE created_at >= date('now', '-7 days')
            GROUP BY person_name
            ORDER BY tx_count DESC
            LIMIT 5
        `).all();

        // Top 5 most moved products (last 7 days)
        const topProducts = db.prepare(`
            SELECT p.name, sum(t.quantity) as volume
            FROM transactions t
            JOIN products p ON t.product_id = p.id
            WHERE t.created_at >= date('now', '-7 days')
            GROUP BY t.product_id
            ORDER BY volume DESC
            LIMIT 5
        `).all();

        res.json({
            inventory: inventoryStats,
            topUsers,
            topProducts
        });
    } catch {
        res.status(500).json({ error: 'Failed to access stats overview' });
    }
});

// GET /api/stats/activity
router.get('/activity', (req, res) => {
    try {
        // We want a daily chart for the last 14 days showing Checkins and Checkouts.
        const days = getLastNDays(14);

        // Fetch grouped counts per day based on type
        const dailyData = db.prepare(`
            SELECT 
                date(created_at) as day,
                type,
                COUNT(*) as count,
                SUM(quantity) as volume
            FROM transactions
            WHERE created_at >= date('now', '-14 days')
            GROUP BY date(created_at), type
        `).all();

        // Format data for Recharts: [{ date: '2023-10-01', checkins: 5, checkouts: 2 }, ...]
        const formatted = days.map(dayStr => {
            const checkins = dailyData.find(d => d.day === dayStr && d.type === 'checkin');
            const checkouts = dailyData.find(d => d.day === dayStr && d.type === 'checkout');

            // Format dayStr to a localized format (e.g. 10.10.) if desired, or keep YYYY-MM-DD
            const formattedDate = new Date(dayStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

            return {
                rawDate: dayStr,
                date: formattedDate,
                checkins: checkins ? checkins.count : 0,
                checkin_volume: checkins ? checkins.volume : 0,
                checkouts: checkouts ? checkouts.count : 0,
                checkout_volume: checkouts ? checkouts.volume : 0,
            };
        });

        res.json(formatted);
    } catch {
        res.status(500).json({ error: 'Failed to access daily activity stats' });
    }
});

export default router;
