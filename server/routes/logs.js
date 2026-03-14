import express from 'express';
export const router = express.Router();
import db from '../db.js';

// GET /api/logs
// Unified feed of transactions and adjustments
router.get('/', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const { search, action } = req.query;

        let whereClause = "WHERE 1=1";
        const queryParams = [];

        if (search) {
            whereClause += " AND (person_name LIKE ? OR product_name LIKE ?)";
            queryParams.push(`%${search}%`, `%${search}%`);
        }

        if (action && action !== 'all') {
            whereClause += " AND action = ?";
            queryParams.push(action);
        }

        // Add limit and offset
        const finalParams = [...queryParams, limit, offset];

        const logsQuery = `
            SELECT * FROM (
                SELECT 
                    t.id || '-tx' as unique_id,
                    t.id as orig_id, 
                    'transaction' as source, 
                    t.warehouse_id,
                    w.name as warehouse_name,
                    t.product_id,
                    p.name as product_name,
                    t.person_name, 
                    t.type as action, 
                    t.quantity as qty_change,
                    NULL as old_qty,
                    NULL as new_qty,
                    NULL as reason,
                    t.created_at
                FROM transactions t
                LEFT JOIN warehouses w ON t.warehouse_id = w.id
                LEFT JOIN products p ON t.product_id = p.id

                UNION ALL

                SELECT 
                    a.id || '-adj' as unique_id,
                    a.id as orig_id, 
                    'adjustment' as source, 
                    a.warehouse_id,
                    w.name as warehouse_name,
                    a.product_id,
                    p.name as product_name,
                    a.person_name, 
                    'Korrektur' as action, 
                    a.difference as qty_change,
                    a.old_quantity as old_qty,
                    a.new_quantity as new_qty,
                    a.reason,
                    a.created_at
                FROM adjustments a
                LEFT JOIN warehouses w ON a.warehouse_id = w.id
                LEFT JOIN products p ON a.product_id = p.id
            ) as unified_logs
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        const logs = db.prepare(logsQuery).all(...finalParams);

        const totalQuery = `
            SELECT count(*) as total FROM (
                SELECT 
                    t.person_name, 
                    t.type as action,
                    p.name as product_name
                FROM transactions t
                LEFT JOIN products p ON t.product_id = p.id
                UNION ALL
                SELECT 
                    a.person_name, 
                    'Korrektur' as action,
                    p.name as product_name
                FROM adjustments a
                LEFT JOIN products p ON a.product_id = p.id
            ) as unified_logs
            ${whereClause}
        `;

        const totalCountParams = db.prepare(totalQuery).get(...queryParams).total;

        res.json({
            logs,
            totalCount: totalCountParams,
            totalPages: Math.ceil(totalCountParams / limit),
            currentPage: page
        });
    } catch {
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

export default router;
