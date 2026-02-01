const mongoose = require('mongoose');

const deletedUserSchema = new mongoose.Schema({
    originalId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin']
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'pending']
    },
    originalCreatedAt: {
        type: Date
    },
    deletedAt: {
        type: Date,
        default: Date.now
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reason: {
        type: String,
        default: 'Deleted by admin'
    }
});

module.exports = mongoose.model('DeletedUser', deletedUserSchema);
