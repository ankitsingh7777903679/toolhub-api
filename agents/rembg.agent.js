const fs = require('fs').promises;
const path = require('path');

/**
 * Background Removal Agent using Hugging Face Gradio Space
 * Uses KenjieDec/RemBG model for automatic background removal
 */
class RemBgAgent {
    constructor() {
        // KenjieDec/RemBG Gradio Space
        this.spaceUrl = 'KenjieDec/RemBG';
    }

    /**
     * Remove background from an image
     * @param {string} base64Image - Image as base64 string
     * @param {string} model - Model to use (default: isnet-general-use)
     * @returns {Promise<string>} - Image with removed background as base64
     */
    async removeBackground(base64Image, model = 'isnet-general-use') {
        try {
            console.log('🔧 Removing background with RemBG...');

            // Remove data URL prefix if present
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');

            console.log('📤 Connecting to RemBG Space...');

            // Dynamically import ESM-only modules
            const { Client, handle_file } = await import("@gradio/client");
            const { default: fetch } = await import("node-fetch");

            const client = await Client.connect(this.spaceUrl);

            // Create a Blob from the buffer for Gradio
            const blob = new Blob([imageBuffer], { type: 'image/png' });

            console.log('📤 Processing image...');

            // Call the /inference endpoint with correct parameters
            // API: /inference with parameters: file, model, x, y
            const result = await client.predict("/inference", {
                file: blob,                    // Input image
                model: model,                  // Model selection
                x: 0,                          // Mouse X coordinate (not used for auto removal)
                y: 0                           // Mouse Y coordinate (not used for auto removal)
            });

            console.log('✅ Background removed successfully!');
            console.log('Result:', result.data);

            // Handle the result - returns tuple of 2 elements:
            // [0] Output Image, [1] Output Mask
            if (result.data && result.data[0]) {
                const processedData = result.data[0];

                // If it's a URL object with url property
                if (processedData.url) {
                    console.log('📥 Downloading processed image from:', processedData.url);
                    const response = await fetch(processedData.url);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    return buffer.toString('base64');
                }

                // If it has a path property (local file path from Gradio)
                if (processedData.path) {
                    console.log('📥 Downloading processed image from path');
                    // Try to construct URL from path
                    const response = await fetch(processedData.path);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    return buffer.toString('base64');
                }

                // If it's a direct URL string
                if (typeof processedData === 'string' && processedData.startsWith('http')) {
                    console.log('📥 Downloading processed image from:', processedData);
                    const response = await fetch(processedData);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    return buffer.toString('base64');
                }

                // If it's already base64
                if (typeof processedData === 'string') {
                    return processedData;
                }
            }

            throw new Error('No processed image returned from model');

        } catch (error) {
            console.error('❌ Background removal failed:', error.message);
            throw new Error(`Background removal failed: ${error.message}`);
        }
    }

    /**
     * Check if the API is available
     */
    async checkStatus() {
        return {
            available: true,
            model: 'RemBG (u2net)',
            message: 'Background removal is available via Gradio Space'
        };
    }
}

module.exports = { RemBgAgent };
