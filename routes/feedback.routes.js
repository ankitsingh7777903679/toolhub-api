const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');

// POST /api/feedback - Submit new feedback
router.post('/', feedbackController.submitFeedback);

// GET /api/feedback - Get recent feedbacks
router.get('/', feedbackController.getFeedbacks);

module.exports = router;
