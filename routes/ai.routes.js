const express = require('express');
const router = express.Router();
const { WritingAgent } = require('../agents/writing.agent');

const writingAgent = new WritingAgent();

/**
 * POST /api/ai/generate
 * Generate AI content based on prompt type
 */
router.post('/generate', async (req, res) => {
    try {
        const { promptType, text, paragraphs } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Please provide input text'
            });
        }

        if (!promptType) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Please provide a prompt type'
            });
        }

        console.log(`📝 Generating ${promptType} content...`);

        const result = await writingAgent.generate(promptType, text, paragraphs);

        res.json({
            success: true,
            text: result,
            promptType
        });

    } catch (error) {
        console.error('AI Generation Error:', error.message);
        res.status(500).json({
            error: 'Generation failed',
            message: error.message
        });
    }
});

/**
 * GET /api/ai/status
 * Check AI agent status
 */
router.get('/status', (req, res) => {
    res.json({
        status: 'ready',
        model: 'moonshotai/kimi-k2-instruct-0905',
        provider: 'Groq'
    });
});

module.exports = router;
