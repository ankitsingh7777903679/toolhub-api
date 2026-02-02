const fs = require('fs').promises;
const path = require('path');

class ImageAgent {
    constructor() {
        this.outputDir = path.join(__dirname, '../public/generated-images');
        this.ensureOutputDir();
    }

    async ensureOutputDir() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create output directory:', error);
        }
    }

    /**
     * Generate an image using Gradio client
     * @param {string} prompt - The text prompt for image generation
     * @param {number} index - Index number for logging
     * @returns {Promise<string>} - URL to the generated image (HuggingFace URL)
     */
    async generateImage(prompt, index = 0) {
        try {
            // console.log(`🎨 [${index + 1}] Generating image with prompt:`, prompt);

            // Dynamically import ESM-only modules at runtime
            const { Client } = await import("@gradio/client");

            const client = await Client.connect('anycoderapps/Z-Image-Turbo');

            const result = await client.predict("/generate_image", {
                prompt: prompt,
            });

            // console.log(`✅ [${index + 1}] Image generation result received`);

            // Extract and return the HuggingFace image URL directly
            const imageUrl = (result.data)[0].url;
            // console.log(`🔗 [${index + 1}] Image URL:`, imageUrl);

            return imageUrl;

        } catch (error) {
            // console.error(`❌ [${index + 1}] Image generation failed:`, error.message);
            throw new Error(`Image generation failed: ${error.message}`);
        }
    }

    /**
     * Generate multiple images sequentially with delays
     * @param {string} prompt - The text prompt
     * @param {number} count - Number of images to generate
     * @returns {Promise<string[]>} - Array of image URLs
     */
    async generateMultipleImages(prompt, count = 1) {
        try {
            // console.log(`🎨 Generating ${count} images sequentially...`);

            const imageUrls = [];

            // Generate images sequentially with a small delay between each
            for (let i = 0; i < count; i++) {
                try {
                    const url = await this.generateImage(prompt, i);
                    imageUrls.push(url);

                    // Add a small delay between generations to avoid rate limiting
                    if (i < count - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    console.error(`⚠️ Failed to generate image ${i + 1}:`, error.message);
                    // Continue with next image even if one fails
                }
            }

            // console.log(`✅ Successfully generated ${imageUrls.length}/${count} images`);

            if (imageUrls.length === 0) {
                throw new Error('All image generation attempts failed');
            }

            return imageUrls;

        } catch (error) {
            // console.error('❌ Multiple image generation failed:', error);
            throw error;
        }
    }

    /**
     * Clean up old generated images (optional)
     * @param {number} maxAgeMs - Maximum age in milliseconds
     */
    async cleanupOldImages(maxAgeMs = 24 * 60 * 60 * 1000) {
        try {
            const files = await fs.readdir(this.outputDir);
            const now = Date.now();

            for (const file of files) {
                const filePath = path.join(this.outputDir, file);
                const stats = await fs.stat(filePath);

                if (now - stats.mtimeMs > maxAgeMs) {
                    await fs.unlink(filePath);
                    // console.log('🗑️ Cleaned up old image:', file);
                }
            }
        } catch (error) {
            // console.error('Cleanup error:', error);
        }
    }
}

module.exports = { ImageAgent };
