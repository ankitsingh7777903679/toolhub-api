// Script to make the first user an admin
// Run with: node scripts/make-admin.js <email>

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
    console.log('Usage: node scripts/make-admin.js <email>');
    process.exit(1);
}

async function makeAdmin() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/toolhub';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const user = await User.findOneAndUpdate(
            { email },
            { role: 'admin' },
            { new: true }
        );

        if (!user) {
            console.log(`User with email "${email}" not found.`);
            console.log('Please signup first, then run this script.');
        } else {
            console.log(`✅ User "${user.username}" (${user.email}) is now an admin!`);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

makeAdmin();
