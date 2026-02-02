const express = require('express');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();

const connectDB = require('./config/db');
const aiRoutes = require('./routes/ai.routes');
const imageRoutes = require('./routes/image.routes');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const ocrRoutes = require('./routes/ocr.routes');
const pdfRoutes = require('./routes/pdf.routes');
const enhanceRoutes = require('./routes/enhance.routes');
const rembgRoutes = require('./routes/rembg.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const fileRoutes = require('./routes/file.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(compression());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200').split(',').map(origin => origin.trim().replace(/\/$/, ''));

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const cleanOrigin = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            // console.log('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files (generated images)
app.use('/generated-images', express.static('public/generated-images'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/image', imageRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/enhance', enhanceRoutes);
app.use('/api/rembg', rembgRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/file', fileRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'ToolHub API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    // console.error('Error:', err.message);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

app.listen(PORT, () => {
    // console.log(`🚀 ToolHub API running on http://localhost:${PORT}`);
    // console.log(`📝 AI endpoint: http://localhost:${PORT}/api/ai/generate`);
    // console.log(`🎨 Image endpoint: http://localhost:${PORT}/api/image/generate`);
});
