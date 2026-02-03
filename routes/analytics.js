const express = require('express');
const router = express.Router();
const ToolUsage = require('../models/ToolUsage');

// POST /api/analytics/track - Record tool usage
router.post('/track', async (req, res) => {
    try {
        const { toolId, toolName, category } = req.body;

        if (!toolId || !toolName) {
            return res.status(400).json({ error: 'toolId and toolName are required' });
        }

        await ToolUsage.create({
            toolId,
            toolName,
            category: category || 'other'
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Analytics track error:', error);
        res.status(500).json({ error: 'Failed to track usage' });
    }
});

// GET /api/analytics/stats - Get all tool usage stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await ToolUsage.aggregate([
            {
                $group: {
                    _id: '$toolId',
                    toolName: { $first: '$toolName' },
                    category: { $first: '$category' },
                    count: { $sum: 1 },
                    lastUsed: { $max: '$timestamp' }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        // Calculate total
        const total = stats.reduce((sum, s) => sum + s.count, 0);

        res.json({
            total,
            tools: stats.map(s => ({
                toolId: s._id,
                toolName: s.toolName,
                category: s.category,
                count: s.count,
                lastUsed: s.lastUsed
            }))
        });
    } catch (error) {
        console.error('Analytics stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

module.exports = router;
