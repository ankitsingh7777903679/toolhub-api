const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const os = require('os');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * POST /api/file/image-to-csv
 * Extract table data from image or PDF using Groq AI (Llama vision)
 */
router.post('/image-to-csv', async (req, res) => {
    try {
        const { base64, mimeType } = req.body;

        if (!base64) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Please provide base64 image data'
            });
        }

        console.log(`📊 Image to CSV request received (${mimeType})`);

        // For PDFs, Groq can handle them directly with vision models
        const dataUrl = `data:${mimeType || 'image/png'};base64,${base64}`;

        const response = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `You are a data extraction expert. Look at this ${mimeType === 'application/pdf' ? 'document' : 'image'} and extract ALL table data you can find.

INSTRUCTIONS:
1. Find any tables, spreadsheets, or tabular data
2. Extract ALL rows and columns accurately
3. Return the data in PURE CSV format (comma-separated values)
4. Use commas to separate columns
5. Use newlines to separate rows
6. If a cell contains commas, wrap it in double quotes
7. Include the header row if visible
8. Do NOT include any explanations, markdown, or code blocks
9. Return ONLY the raw CSV data, nothing else

If no table data is found, return: "NO_TABLE_DATA_FOUND"`
                        },
                        {
                            type: 'image_url',
                            image_url: { url: dataUrl }
                        }
                    ]
                }
            ],
            max_tokens: 4096,
            temperature: 0.1
        });

        const csvData = response.choices?.[0]?.message?.content?.trim() || '';

        if (csvData === 'NO_TABLE_DATA_FOUND' || !csvData) {
            return res.status(400).json({
                error: 'No table data found',
                message: 'Could not find any table data in the file'
            });
        }

        // Parse CSV for preview
        const rows = csvData.split('\n').filter(r => r.trim());
        const parsedData = rows.map(row => {
            const cells = [];
            let current = '';
            let inQuotes = false;

            for (const char of row) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    cells.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            cells.push(current.trim());
            return cells;
        });

        console.log(`✅ Extracted ${parsedData.length} rows`);

        res.json({
            success: true,
            csv: csvData,
            preview: parsedData,
            rowCount: parsedData.length,
            columnCount: parsedData[0]?.length || 0
        });

    } catch (error) {
        console.error('Image to CSV Error:', error.message);
        res.status(500).json({
            error: 'Extraction failed',
            message: error.message
        });
    }
});

/**
 * POST /api/file/image-to-excel
 * 2-Step Workflow: Mistral OCR → Groq AI → JSON for Excel
 */
router.post('/image-to-excel', async (req, res) => {
    try {
        const { base64, mimeType } = req.body;

        if (!base64) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Please provide base64 image data'
            });
        }

        console.log(`📊 Image to Excel request received (${mimeType})`);

        // STEP 1: Mistral OCR via Direct REST API (Specialized OCR Endpoint)
        console.log('🔍 Step 1: Running Mistral OCR-2512...');

        let ocrText = '';
        try {
            const axios = require('axios');

            // Specialized OCR endpoint payload
            const isPdf = mimeType === 'application/pdf';
            const documentType = isPdf ? "document_url" : "image_url";
            const documentUrlKey = isPdf ? "document_url" : "image_url";

            const payload = {
                model: "mistral-ocr-latest",
                document: {
                    type: documentType,
                    [documentUrlKey]: `data:${mimeType || 'image/jpeg'};base64,${base64}`
                }
            };

            const mistralResponse = await axios.post('https://api.mistral.ai/v1/ocr', payload, {
                headers: {
                    'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
            // console.log(mistralResponse.data);

            // Mistral OCR response structure: pages[0].markdown (or text)
            const pages = mistralResponse.data?.pages || [];
            ocrText = pages.map(p => p.markdown).join('\n\n') || '';

            console.log(`✅ OCR extracted ${ocrText.length} characters`);
        } catch (ocrError) {
            console.error('OCR Error Details:', JSON.stringify(ocrError.response?.data, null, 2));
            return res.status(500).json({
                error: 'OCR failed',
                message: 'Failed to extract text: ' + (ocrError.response?.data?.message || ocrError.message)
            });
        }

        if (!ocrText || ocrText.trim().length === 0) {
            return res.status(400).json({
                error: 'No text found',
                message: 'Could not extract text from the image'
            });
        }

        // STEP 2: Groq AI for JSON formatting
        console.log('🤖 Step 2: Processing with Groq AI...');

        const systemPrompt = `You are an expert at extracting clean, structured table data from messy OCR text.

## YOUR TASK:
Parse the OCR text and extract a clean table. The data is typically a handwritten or printed register/inventory list.

## DATA CLEANING RULES:
1. SEPARATE serial numbers from codes (e.g., "18. P318805" → sr_no: "18", code: "P318805")
2. CLEAN quantities - extract only numbers (e.g., "08" or "04")
3. CLEAN types - common values: "T", "TBNT", "BNT", "Tank", "Header" etc.
4. DIMENSIONS go in separate column if present (e.g., "8440 x 355")
5. REMOVE noise: random symbols, illegible text fragments, stray marks
6. PRESERVE all meaningful columns found in the source

## COLUMN DETECTION:
- Look for patterns: serial number | code | quantity | type | dimensions | remarks
- Column count varies - extract ALL columns you find
- Use descriptive header names: sr_no, code, qty, type, dimensions, remarks, date, time, etc.

## OUTPUT (ONLY valid JSON, no explanations):
{
  "table": [
    {"sr_no": "1", "code": "P123456", "qty": "04", "type": "T"},
    {"sr_no": "2", "code": "R789012", "qty": "02", "type": "BNT", "dimensions": "7310 x 355"}
  ]
}

CRITICAL: Return ONLY the JSON object. No markdown, no explanations, no text before or after.`;

        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Extract clean table data from this OCR text:\n\n${ocrText}` }
            ],
            max_tokens: 8192,
            temperature: 0.05
        });

        let content = response.choices?.[0]?.message?.content?.trim() || '{"table":[]}';

        // Clean up any markdown code blocks
        content = content.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

        // Remove any text before the first { or after the last }
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            content = content.substring(firstBrace, lastBrace + 1);
        }

        console.log('📝 Cleaned content length:', content.length);

        // Parse JSON
        let data;
        try {
            const parsed = JSON.parse(content);
            data = parsed.table || (Array.isArray(parsed) ? parsed : [parsed]);
        } catch (e) {
            console.log('⚠️ JSON parse failed, trying to fix common issues...');

            // Try to fix common JSON issues
            let fixedContent = content
                .replace(/,\s*}/g, '}')  // Remove trailing commas
                .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
                .replace(/'/g, '"')      // Replace single quotes
                .replace(/\n/g, ' ');    // Remove newlines inside JSON

            try {
                const parsed = JSON.parse(fixedContent);
                data = parsed.table || (Array.isArray(parsed) ? parsed : [parsed]);
            } catch (e2) {
                // Last resort: try to extract array of objects
                const arrayMatch = content.match(/\[\s*\{[\s\S]+\}\s*\]/);
                if (arrayMatch) {
                    try {
                        data = JSON.parse(arrayMatch[0]);
                    } catch (e3) {
                        console.log('❌ All parsing failed. Preview:', content.substring(0, 300));
                        return res.status(400).json({
                            error: 'Parsing failed',
                            message: 'Could not parse AI response. Please try again.'
                        });
                    }
                } else {
                    console.log('❌ No valid JSON found. Preview:', content.substring(0, 300));
                    return res.status(400).json({
                        error: 'Parsing failed',
                        message: 'Could not extract table data. Please try again.'
                    });
                }
            }
        }

        if (!data || data.length === 0) {
            return res.status(400).json({
                error: 'No data found',
                message: 'Could not extract structured data'
            });
        }

        console.log(`✅ Extracted ${data.length} rows for Excel`);

        res.json({
            success: true,
            data: data,
            rowCount: data.length,
            ocrLength: ocrText.length
        });

    } catch (error) {
        console.error('Image to Excel Error:', error.message);
        res.status(500).json({
            error: 'Extraction failed',
            message: error.message
        });
    }
});

module.exports = router;
