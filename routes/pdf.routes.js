const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer-core');

// Find Chrome executable path
const getChromePath = () => {
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.CHROME_PATH
    ];

    const fs = require('fs');
    for (const p of paths) {
        if (p && fs.existsSync(p)) {
            return p;
        }
    }
    return null;
};

/**
 * POST /api/pdf/generate
 * Generate PDF from text with proper Hindi/Gujarati font support
 */
router.post('/generate', async (req, res) => {
    let browser = null;

    try {
        let { text, filename, base64, mimeType } = req.body;

        // If base64 provided, run Mistral OCR first to get text
        if (base64) {
            // console.log(`🔍 Running Mistral OCR for PDF generation... (${mimeType})`);

            try {
                const axios = require('axios');
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

                const pages = mistralResponse.data?.pages || [];
                text = pages.map(p => p.markdown).join('\n\n') || '';

                // console.log(`✅ OCR extracted ${text.length} characters for PDF generation`);
            } catch (ocrError) {
                console.error('OCR Error in PDF generation:', ocrError.message);
                // Fallthrough - will fail at !text check below if extraction failed
            }
        }

        if (!text) {
            return res.status(400).json({
                error: 'No text provided',
                message: 'Please provide text or an image/PDF to convert'
            });
        }

        const chromePath = getChromePath();
        if (!chromePath) {
            return res.status(500).json({
                error: 'Chrome not found',
                message: 'Please install Google Chrome or set CHROME_PATH environment variable'
            });
        }

        // console.log(`📄 Generating PDF with Chrome: ${chromePath}`);

        // Launch browser
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Check if text contains HTML tags (from new OCR format)
        const containsHtml = /<[a-z][\s\S]*>/i.test(text);

        let bodyContent;
        if (containsHtml) {
            // OCR returned HTML - use it directly
            // Remove page markers and clean up
            bodyContent = text.replace(/=== Page \d+ ===/g, '<hr style="page-break-before:always; margin:20px 0;">');
        } else {
            // Plain text - escape and convert to HTML
            bodyContent = `<div class="content">${text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>')}</div>`;
        }

        // Create HTML content with proper fonts and styling
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap');
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Noto Sans Devanagari', 'Mangal', 'Arial Unicode MS', Arial, sans-serif;
                        font-size: 11pt;
                        line-height: 1.6;
                        padding: 40px;
                        color: #000;
                        background: #fff;
                    }
                    
                    .content {
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                    
                    .page {
                        margin-bottom: 20px;
                    }
                    
                    h1 { font-size: 18pt; margin: 15px 0; }
                    h2 { font-size: 16pt; margin: 12px 0; }
                    h3 { font-size: 14pt; margin: 10px 0; }
                    
                    p { margin: 8px 0; }
                    
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin: 10px 0;
                    }
                    
                    td, th {
                        border: 1px solid #ccc;
                        padding: 8px;
                        text-align: left;
                    }
                    
                    ol, ul {
                        margin: 10px 0 10px 30px;
                    }
                    
                    li {
                        margin: 5px 0;
                    }
                    
                    hr {
                        border: none;
                        border-top: 1px solid #888;
                        margin: 15px 0;
                    }
                </style>
            </head>
            <body>
                ${bodyContent}
            </body>
            </html>
        `;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Wait for fonts to load
        await page.evaluateHandle(() => document.fonts.ready);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            },
            printBackground: true
        });

        await browser.close();
        browser = null;

        // console.log(`✅ PDF generated successfully (${pdfBuffer.length} bytes)`);

        // Send PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename || 'extracted.pdf'}"`,
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('❌ PDF generation error:', error.message);

        if (browser) {
            await browser.close();
        }

        res.status(500).json({
            error: 'PDF generation failed',
            message: error.message
        });
    }
});

/**
 * GET /api/pdf/status
 * Check if PDF generation is available
 */
router.get('/status', (req, res) => {
    const chromePath = getChromePath();

    res.json({
        available: !!chromePath,
        chromePath: chromePath || 'Not found',
        message: chromePath
            ? 'PDF generation is available'
            : 'Chrome not found. Please install Google Chrome.'
    });
});

const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
let muhammara;
try {
    muhammara = require('muhammara');
} catch (e) {
    console.error('Failed to load muhammara:', e.message);
}

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

/**
 * POST /api/pdf/word-to-pdf
 * Convert Word document (.docx) to PDF using MS Word via PowerShell
 */
router.post('/word-to-pdf', upload.single('file'), async (req, res) => {
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const inputPath = path.join(tempDir, `word_${timestamp}.docx`);
    const outputPath = path.join(tempDir, `word_${timestamp}.pdf`);
    const psScriptPath = path.join(tempDir, `convert_${timestamp}.ps1`);

    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        if (!file.originalname.match(/\.(doc|docx)$/i)) {
            return res.status(400).json({ error: 'Invalid file type. Please upload a .doc or .docx file.' });
        }

        // console.log(`📄 Converting Word document: ${file.originalname}`);

        // Write file to temp directory
        fs.writeFileSync(inputPath, file.buffer);

        // Create PowerShell script file (avoids escaping issues)
        const psScript = `
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open("${inputPath.replace(/\\/g, '\\\\')}")
    $doc.SaveAs([ref]"${outputPath.replace(/\\/g, '\\\\')}", [ref]17)
    $doc.Close()
} finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}
`;
        fs.writeFileSync(psScriptPath, psScript);

        // Execute PowerShell
        const { execSync } = require('child_process');

        // console.log('📦 Using MS Word for conversion...');

        try {
            execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
                timeout: 120000,
                windowsHide: true
            });
        } catch (psError) {
            // Clean up
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);

            console.error('PowerShell error:', psError.message);
            return res.status(500).json({
                error: 'MS Word conversion failed',
                message: 'Make sure Microsoft Word is installed and try again.'
            });
        }

        // Clean up script file
        if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);

        // Check if PDF was created
        if (!fs.existsSync(outputPath)) {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            return res.status(500).json({
                error: 'Conversion failed',
                message: 'PDF was not generated. Please try again.'
            });
        }

        // Read the PDF
        const pdfBuffer = fs.readFileSync(outputPath);

        // Clean up temp files
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        // Create output filename
        const outputFilename = file.originalname.replace(/\.(doc|docx)$/i, '.pdf');

        // console.log(`✅ Word to PDF conversion successful: ${outputFilename} (${pdfBuffer.length} bytes)`);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${outputFilename}"`,
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('❌ Word to PDF conversion error:', error.message);

        // Clean up
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);

        res.status(500).json({
            error: 'Conversion failed',
            message: error.message
        });
    }
});

/**
 * POST /api/pdf/protect
 * Add password protection to PDF using muhammara
 */
router.post('/protect', upload.single('file'), async (req, res) => {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `input_${Date.now()}.pdf`);
    const outputPath = path.join(tempDir, `protected_${Date.now()}.pdf`);

    try {
        if (!muhammara) {
            throw new Error('PDF encryption library (muhammara) is not available. Please restart backend.');
        }

        const { password } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No PDF file provided' });
        }

        if (!password) {
            return res.status(400).json({ error: 'No password provided' });
        }

        // Write input file
        fs.writeFileSync(inputPath, file.buffer);

        // console.log(`🔒 Protecting PDF with password using muhammara...`);

        // Use muhammara to create a NEW encrypted PDF and copy pages
        // This is more reliable for password protection than modifying existing
        const writer = muhammara.createWriter(outputPath, {
            userPassword: password,
            ownerPassword: password,
            userProtectionFlag: 4
        });

        writer.appendPDFPagesFromPDF(inputPath);
        writer.end();

        // Read protected file
        const protectedPdf = fs.readFileSync(outputPath);

        // Clean up temp files
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        // console.log(`✅ PDF protected successfully with muhammara`);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="protected_${file.originalname}"`,
            'X-Protection-Status': 'encrypted'
        });
        res.send(protectedPdf);

    } catch (error) {
        console.error('❌ PDF protection error:', error.message);

        // Clean up
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        res.status(500).json({
            error: 'PDF protection failed',
            message: error.message
        });
    }
});


/**
 * POST /api/pdf/unlock
 * Remove password from PDF using muhammara
 */
router.post('/unlock', upload.single('file'), async (req, res) => {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `locked_${Date.now()}.pdf`);
    const outputPath = path.join(tempDir, `unlocked_${Date.now()}.pdf`);

    try {
        if (!muhammara) {
            throw new Error('PDF encryption library (muhammara) is not available. Please restart backend.');
        }

        const { password } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No PDF file provided' });
        }

        if (!password) {
            return res.status(400).json({ error: 'No password provided' });
        }

        // Write input file
        fs.writeFileSync(inputPath, file.buffer);

        // console.log(`🔓 Unlocking PDF using muhammara...`);

        // Use muhammara to unlock: create new PDF and append pages from encrypted source
        const pdfWriter = muhammara.createWriter(outputPath);
        pdfWriter.appendPDFPagesFromPDF(inputPath, { password: password });
        pdfWriter.end();

        // Read unlocked file
        const unlockedPdf = fs.readFileSync(outputPath);

        // Clean up temp files
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        // console.log(`✅ PDF unlocked successfully`);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="unlocked_${file.originalname}"`
        });
        res.send(unlockedPdf);

    } catch (error) {
        console.error('❌ PDF unlock error:', error.message);

        // Clean up
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        const isPasswordError = error.message && (error.message.includes('password') || error.message.includes('Wrong password'));

        res.status(isPasswordError ? 400 : 500).json({
            error: 'PDF unlock failed',
            message: isPasswordError ? 'Incorrect password. Please try again.' : error.message
        });
    }
});

module.exports = router;
