const Groq = require('groq-sdk');
require('dotenv').config();

/**
 * OCR Agent using Groq's Llama 4 Scout model
 * Extracts text from images using vision capabilities
 */
class OCRAgent {
    constructor() {
        this.client = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        this.model = 'meta-llama/llama-4-scout-17b-16e-instruct';
    }

    /**
     * Extract text from image/PDF using Mistral OCR Direct API
     * (Same logic as file.routes.js /image-to-excel which works)
     */
    async extractText(base64Image, mimeType = 'image/png') {
        try {
            console.log('🔍 Running Mistral OCR (Direct API)...');

            const axios = require('axios');

            // Specialized OCR endpoint payload (same as file.routes.js)
            const isPdf = mimeType === 'application/pdf';
            const documentType = isPdf ? "document_url" : "image_url";
            const documentUrlKey = isPdf ? "document_url" : "image_url";

            const payload = {
                model: "mistral-ocr-latest",
                document: {
                    type: documentType,
                    [documentUrlKey]: `data:${mimeType || 'image/jpeg'};base64,${base64Image}`
                }
            };

            console.log(`� OCR Request: Type=${documentType}, Size=${base64Image?.length || 0} bytes`);

            const mistralResponse = await axios.post('https://api.mistral.ai/v1/ocr', payload, {
                headers: {
                    'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            // Mistral OCR response structure: pages[0].markdown
            const pages = mistralResponse.data?.pages || [];
            const extractedText = pages.map(p => p.markdown).join('\n\n') || '';

            console.log(`✅ OCR extracted ${extractedText.length} characters`);

            return extractedText;

        } catch (error) {
            console.error('❌ OCR Error Details:', JSON.stringify(error.response?.data, null, 2));
            throw new Error('OCR extraction failed: ' + (error.response?.data?.message || error.message));
        }
    }

    /**
     * Extract text from image/PDF and convert to styled HTML
     * Step 1: mistral-ocr-latest (best OCR quality)
     * Step 2: mistral-large-latest (HTML formatting)
     */
    async extractTextAsHtml(base64Image, mimeType = 'image/png') {
        try {
            const axios = require('axios');

            // Step 1: Mistral OCR for best text extraction
            console.log('🔍 Step 1: Mistral OCR...');
            const isPdf = mimeType === 'application/pdf';

            const ocrPayload = {
                model: "mistral-ocr-latest",
                document: {
                    type: isPdf ? "document_url" : "image_url",
                    [isPdf ? "document_url" : "image_url"]: `data:${mimeType};base64,${base64Image}`
                }
            };

            let ocrResponse;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    ocrResponse = await axios.post('https://api.mistral.ai/v1/ocr', ocrPayload, {
                        headers: {
                            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        maxBodyLength: Infinity,
                        timeout: 120000
                    });
                    break;
                } catch (err) {
                    console.log(`⚠️ OCR attempt ${attempt}/3 failed`);
                    if (attempt === 3) throw err;
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            const ocrText = ocrResponse.data?.pages?.map(p => p.markdown).join('\n\n') || '';
            console.log(`✅ OCR: ${ocrText.length} chars`);

            // Step 2: Mistral Chat for HTML formatting
            console.log('🎨 Step 2: Mistral HTML formatting...');
            const htmlPrompt = `Convert this text to HTML with inline CSS. Return ONLY HTML.

FORMAT:
- Wrap in <div class="page">
- Titles: <h1 style="text-align:center;font-weight:bold;font-size:20px;">
- Headings: <h2 style="font-weight:bold;font-size:16px;">
- Paragraphs: <p style="margin:8px 0;">
- Bold: <strong>
- Questions: <p><strong>N.</strong> text</p>
- No image markdown

MATH FORMULAS (IMPORTANT):
- Convert LaTeX $formula$ to readable HTML
- Superscript: V^2 → V<sup>2</sup>
- Subscript: Q_1 → Q<sub>1</sub>
- Fractions: 1/2 → ½ or (1/2)
- Example: $1/2 CV^2$ → ½ CV<sup>2</sup>
- Example: $Q_1 = 3\\mu c$ → Q<sub>1</sub> = 3μc

TEXT:
${ocrText}`;

            const chatResponse = await axios.post('https://api.mistral.ai/v1/chat/completions', {
                model: "mistral-large-latest",
                messages: [{ role: "user", content: htmlPrompt }],
                max_tokens: 16000,
                temperature: 0.1
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            let html = chatResponse.data?.choices?.[0]?.message?.content || '';
            html = html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();

            console.log(`✅ HTML: ${html.length} chars`);
            return { text: ocrText, html, images: [] };

        } catch (error) {
            console.error('❌ Error:', error.response?.data || error.message);
            throw new Error('OCR failed: ' + (error.response?.data?.message || error.message));
        }
    }

    /**
     * Extract text from multiple images (PDF pages)
     * @param {Array<{base64: string, mimeType: string}>} images - Array of image data
     * @returns {Promise<string>} - Combined extracted text
     */
    async extractFromMultipleImages(images) {
        try {
            console.log(`🔍 Processing ${images.length} pages...`);

            const textParts = [];

            for (let i = 0; i < images.length; i++) {
                console.log(`📄 Processing page ${i + 1}/${images.length}...`);

                const text = await this.extractText(images[i].base64, images[i].mimeType);
                textParts.push(`--- Page ${i + 1} ---\n\n${text}`);

                // Small delay between requests to avoid rate limiting
                if (i < images.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            const combinedText = textParts.join('\n\n');
            console.log(`✅ Successfully extracted text from ${images.length} pages`);

            return combinedText;

        } catch (error) {
            console.error('❌ Multi-page OCR failed:', error.message);
            throw error;
        }
    }
}

module.exports = { OCRAgent };
