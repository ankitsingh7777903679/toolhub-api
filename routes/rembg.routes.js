const express = require('express');
const router = express.Router();
const { RemBgAgent } = require('../agents/rembg.agent');

const rembgAgent = new RemBgAgent();

/**
 * POST /api/rembg/remove
 * Remove background from an uploaded image
 */
router.post('/remove', async (req, res) => {
    try {
        const { image, model = 'u2net' } = req.body;

        if (!image) {
            return res.status(400).json({
                error: 'No image provided',
                message: 'Please provide an image in base64 format'
            });
        }

        // console.log('📸 Received image for background removal...');

        const processedBase64 = await rembgAgent.removeBackground(image, model);

        res.json({
            success: true,
            processed: `data:image/png;base64,${processedBase64}`,
            message: 'Background removed successfully'
        });

    } catch (error) {
        // console.error('❌ Background removal error:', error.message);
        res.status(500).json({
            error: 'Background removal failed',
            message: error.message
        });
    }
});

/**
 * GET /api/rembg/status
 * Check if background removal service is available
 */
router.get('/status', async (req, res) => {
    const status = await rembgAgent.checkStatus();
    res.json(status);
});

module.exports = router;
