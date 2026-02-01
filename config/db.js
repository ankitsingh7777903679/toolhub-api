const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            throw new Error('MONGODB_URI environment variable is not defined');
        }

        await mongoose.connect(mongoUri);
        // console.log('📦 MongoDB Atlas connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        // Do not exit process in dev mode to allow API to run without DB if needed
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

module.exports = connectDB;
