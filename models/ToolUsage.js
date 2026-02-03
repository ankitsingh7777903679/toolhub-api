const mongoose = require('mongoose');

const toolUsageSchema = new mongoose.Schema({
    toolId: {
        type: String,
        required: true,
        index: true
    },
    toolName: {
        type: String,
        required: true
    },
    category: {
        type: String,
        default: 'other'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Create compound index for efficient aggregation
toolUsageSchema.index({ toolId: 1, timestamp: -1 });

module.exports = mongoose.model('ToolUsage', toolUsageSchema);
