const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

/**
 * Image Enhancer Agent using Hugging Face Gradio Space
 * Uses Real-ESRGAN model for image upscaling and enhancement
 */
class EnhanceAgent {
    constructor() {
        // Working Real-ESRGAN Gradio Space
        this.spaceUrl = 'Nick088/Real-ESRGAN_Pytorch';
        // this.spaceUrl = 'Rockerleo/esrgan';
    }

    /**
     * Enhance an image using Real-ESRGAN
     * @param {string} base64Image - Image as base64 string
     * @returns {Promise<string>} - Enhanced image as base64
     */
    async enhanceImage(base64Image) {
        try {
            // console.log('🔧 Enhancing image with Real-ESRGAN...');

            // Remove data URL prefix if present
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');

            // console.log('📤 Connecting to Real-ESRGAN Space...');

            // Dynamically import ESM-only modules (same as image.agent.js)
            const { Client } = await import("@gradio/client");
            const { default: fetch } = await import("node-fetch");

            const client = await Client.connect(this.spaceUrl);

            // Create a Blob from the buffer for Gradio
            const blob = new Blob([imageBuffer], { type: 'image/png' });

            // Call the predict function with the image
            // Nick088's space uses: predict(image, scale, face_enhance)
            const result = await client.predict("/predict", [
                blob,    // image
                4,       // scale (2x, 4x, 8x)
                false    // face_enhance
            ]);

            // console.log('✅ Image enhanced successfully!');
            // console.log('Result:', result.data);

            // Handle the result - extract URL and download
            if (result.data && result.data[0]) {
                const enhancedData = result.data[0];

                // If it's a URL object with url property
                if (enhancedData.url) {
                    // console.log('📥 Downloading enhanced image from:', enhancedData.url);
                    const response = await fetch(enhancedData.url);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    return buffer.toString('base64');
                }

                // If it's a direct URL string
                if (typeof enhancedData === 'string' && enhancedData.startsWith('http')) {
                    // console.log('📥 Downloading enhanced image from:', enhancedData);
                    const response = await fetch(enhancedData);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    return buffer.toString('base64');
                }

                // If it's already base64
                if (typeof enhancedData === 'string') {
                    return enhancedData;
                }
            }

            throw new Error('No enhanced image returned from model');

        } catch (error) {
            // console.error('❌ Image enhancement failed:', error.message);
            throw new Error(`Enhancement failed: ${error.message}`);
        }
    }

    /**
     * Check if the API is available
     */
    async checkStatus() {
        return {
            available: true,
            model: 'Real-ESRGAN',
            message: 'Image enhancement is available via Gradio Space'
        };
    }
}

module.exports = { EnhanceAgent };
