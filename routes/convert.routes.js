const express = require('express');
const router = express.Router();
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../temp/uploads');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}.pdf`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

// LibreOffice path (adjust based on installation)
const LIBREOFFICE_PATH = process.env.LIBREOFFICE_PATH ||
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

/**
 * POST /api/convert/pdf-to-word
 * Convert PDF to Word document using LibreOffice
 */
router.post('/pdf-to-word', upload.single('pdf'), async (req, res) => {
    let pdfPath = null;
    let outputDir = null;

    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                message: 'Please provide a PDF file'
            });
        }

        pdfPath = req.file.path;
        outputDir = path.join(__dirname, '../temp/output', uuidv4());
        await fs.mkdir(outputDir, { recursive: true });

        // console.log(`📄 Converting PDF: ${pdfPath}`);
        // console.log(`📁 Output directory: ${outputDir}`);

        // Build LibreOffice command
        const command = `"${LIBREOFFICE_PATH}" --headless --convert-to docx --outdir "${outputDir}" "${pdfPath}"`;

        // console.log(`🔧 Running: ${command}`);

        // Execute LibreOffice conversion
        await new Promise((resolve, reject) => {
            exec(command, { timeout: 120000 }, (error, stdout, stderr) => {
                if (error) {
                    // console.error('LibreOffice error:', error.message);
                    // console.error('stderr:', stderr);
                    reject(new Error(`Conversion failed: ${error.message}`));
                    return;
                }
                // console.log('LibreOffice output:', stdout);
                resolve(stdout);
            });
        });

        // Find the output file
        const files = await fs.readdir(outputDir);
        const docxFile = files.find(f => f.endsWith('.docx'));

        if (!docxFile) {
            throw new Error('Conversion completed but no DOCX file was generated');
        }

        const docxPath = path.join(outputDir, docxFile);
        const docxBuffer = await fs.readFile(docxPath);

        // console.log(`✅ Conversion successful: ${docxFile} (${docxBuffer.length} bytes)`);

        // Send the file
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${req.file.originalname.replace('.pdf', '.docx')}"`,
            'Content-Length': docxBuffer.length
        });

        res.send(docxBuffer);

    } catch (error) {
        // console.error('❌ PDF to Word conversion error:', error.message);
        res.status(500).json({
            error: 'Conversion failed',
            message: error.message
        });
    } finally {
        // Cleanup temp files
        try {
            if (pdfPath) await fs.unlink(pdfPath).catch(() => { });
            if (outputDir) await fs.rm(outputDir, { recursive: true, force: true }).catch(() => { });
        } catch (e) {
            // console.log('Cleanup error:', e.message);
            throw new Error(`Cleanup failed: ${e.message}`);
        }
    }
});

/**
 * GET /api/convert/status
 * Check if LibreOffice is available
 */
router.get('/status', async (req, res) => {
    try {
        // Check if LibreOffice exists
        await fs.access(LIBREOFFICE_PATH);

        res.json({
            status: 'ready',
            libreoffice: true,
            path: LIBREOFFICE_PATH
        });
    } catch (error) {
        res.json({
            status: 'unavailable',
            libreoffice: false,
            message: 'LibreOffice not found. Please install it from https://www.libreoffice.org/download/',
            expectedPath: LIBREOFFICE_PATH
        });
    }
});

module.exports = router;
