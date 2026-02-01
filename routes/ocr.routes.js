const express = require('express');
const router = express.Router();
const { OCRAgent } = require('../agents/ocr.agent');

const ocrAgent = new OCRAgent();

/**
 * POST /api/ocr/extract
 * Extract text from images using OCR
 */
router.post('/extract', async (req, res) => {
    try {
        const { images } = req.body;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Please provide an array of images'
            });
        }

        // Validate each image
        for (let i = 0; i < images.length; i++) {
            if (!images[i].base64) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: `Image at index ${i} is missing base64 data`
                });
            }
        }

        console.log(`📄 OCR request received for ${images.length} images`);

        const extractedText = await ocrAgent.extractFromMultipleImages(images);

        res.json({
            success: true,
            text: extractedText,
            pageCount: images.length
        });

    } catch (error) {
        console.error('OCR Error:', error.message);
        res.status(500).json({
            error: 'OCR extraction failed',
            message: error.message
        });
    }
});

/**
 * POST /api/ocr/extract-single
 * Extract text from a single image/PDF
 * Optional: returnHtml=true to get styled HTML output
 */
router.post('/extract-single', async (req, res) => {
    try {
        const { base64, mimeType, returnHtml } = req.body;

        if (!base64) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Please provide base64 image data'
            });
        }

        console.log(`📄 Single OCR request (mimeType: ${mimeType}, html: ${!!returnHtml})`);

        if (returnHtml) {
            // Use Mistral for both OCR and HTML formatting
            const result = await ocrAgent.extractTextAsHtml(base64, mimeType || 'image/png');

            res.json({
                success: true,
                text: result.text,
                html: result.html,
                images: result.images
            });
        } else {
            // Standard text extraction
            const extractedText = await ocrAgent.extractText(base64, mimeType || 'image/png');

            res.json({
                success: true,
                text: extractedText
            });
        }

    } catch (error) {
        console.error('OCR Error:', error.message);
        res.status(500).json({
            error: 'OCR extraction failed',
            message: error.message
        });
    }
});

/**
 * GET /api/ocr/status
 * Check OCR agent status
 */
router.get('/status', (req, res) => {
    res.json({
        status: 'ready',
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        provider: 'Groq',
        capabilities: ['text extraction', 'document OCR', 'multi-page processing']
    });
});

module.exports = router;
