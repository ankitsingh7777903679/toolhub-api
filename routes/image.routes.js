const express = require('express');
const router = express.Router();
const { ImageAgent } = require('../agents/image.agent');

const imageAgent = new ImageAgent();

/**
 * POST /api/image/generate
 * Generate AI images based on text prompt
 */
router.post('/generate', async (req, res) => {
    try {
        const { prompt, count = 1 } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Please provide a text prompt'
            });
        }

        console.log(`🎨 Generating ${count} images for prompt: "${prompt}"`);

        const imageUrls = await imageAgent.generateMultipleImages(prompt, count);

        res.json({
            success: true,
            images: imageUrls,
            prompt: prompt,
            count: imageUrls.length
        });

    } catch (error) {
        console.error('Image Generation Error:', error.message);
        res.status(500).json({
            error: 'Generation failed',
            message: error.message
        });
    }
});

/**
 * GET /api/image/status
 * Check image generation service status
 */
router.get('/status', (req, res) => {
    res.json({
        status: 'ready',
        model: 'anycoderapps/Z-Image-Turbo',
        provider: 'Gradio (anycoderapps)'
    });
});

module.exports = router;
