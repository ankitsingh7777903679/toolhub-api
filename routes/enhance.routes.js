const express = require('express');
const router = express.Router();
const { EnhanceAgent } = require('../agents/enhance.agent');

const enhanceAgent = new EnhanceAgent();

/**
 * POST /api/enhance/image
 * Enhance an uploaded image using Real-ESRGAN
 */
router.post('/image', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({
                error: 'No image provided',
                message: 'Please provide an image in base64 format'
            });
        }

        console.log('📸 Received image for enhancement...');

        const enhancedBase64 = await enhanceAgent.enhanceImage(image);

        res.json({
            success: true,
            enhanced: `data:image/png;base64,${enhancedBase64}`,
            message: 'Image enhanced successfully'
        });

    } catch (error) {
        console.error('❌ Enhancement error:', error.message);
        res.status(500).json({
            error: 'Enhancement failed',
            message: error.message
        });
    }
});

/**
 * GET /api/enhance/status
 * Check if enhancement service is available
 */
router.get('/status', async (req, res) => {
    const status = await enhanceAgent.checkStatus();
    res.json(status);
});

module.exports = router;
