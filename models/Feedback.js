const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    sentiment: {
        type: String,
        enum: ['Positive', 'Negative', 'Neutral'],
        default: 'Neutral'
    },
    isAbusive: {
        type: Boolean,
        default: false
    },
    moderationReason: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Feedback', feedbackSchema);
