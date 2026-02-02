const Feedback = require('../models/Feedback');
const { FeedbackAgent } = require('../agents/feedback.agent');

const feedbackAgent = new FeedbackAgent();

exports.submitFeedback = async (req, res) => {
    try {
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Feedback content is required' });
        }

        // 1. Analyze content with AI Agent
        const analysis = await feedbackAgent.analyze(content);
        // console.log('📝 Feedback Analysis Result:', analysis);

        // 2. Check for abusive content
        if (analysis.isAbusive) {
            return res.status(400).json({
                error: 'Moderation Warning',
                message: 'Your feedback contains inappropriate language and was not posted. Please keep the community respectful.',
                isAbusive: true
            });
        }

        // 3. Save to database if safe
        const newFeedback = new Feedback({
            content,
            sentiment: analysis.sentiment,
            isAbusive: false
        });

        await newFeedback.save();

        res.status(201).json({
            message: 'Feedback submitted successfully',
            feedback: newFeedback,
            sentiment: analysis.sentiment
        });

    } catch (error) {
        // console.error('Error submitting feedback:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getFeedbacks = async (req, res) => {
    try {
        // Fetch last 50 non-abusive feedbacks, sorted by newest
        const feedbacks = await Feedback.find({ isAbusive: false })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(feedbacks);
    } catch (error) {
        // console.error('Error fetching feedbacks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
