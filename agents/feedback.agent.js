const { ChatGroq } = require('@langchain/groq');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

class FeedbackAgent {
    constructor() {
        this.model = new ChatGroq({
            apiKey: process.env.GROQ_API_KEY,
            model: 'moonshotai/kimi-k2-instruct-0905',
            temperature: 0, // Deterministic for moderation
            maxTokens: 1024
        });

        this.systemPrompt = `You are a Content Moderation and Sentiment Analysis Agent. Your task is to analyze user feedback for a tool website.

        **Instructions:**
        1. **Abuse Detection**: Check if the text contains severe profanity, hate speech, abusive language, or extreme insults ("gali") in English or Hindi/Hinglish.
           - If YES, set "isAbusive" to true.
           - If NO (e.g., mild criticism or constructive negative feedback), set "isAbusive" to false.
        
        2. **Sentiment Analysis**: Determine if the feedback is "Positive", "Negative", or "Neutral".
        
        3. **Output Format**: Return ONLY a valid JSON object. Do not include markdown code blocks or explanations outside the JSON.
        
        **JSON Schema:**
        {
            "sentiment": "Positive" | "Negative" | "Neutral",
            "isAbusive": boolean,
            "reason": "Brief explanation if abusive, otherwise null"
        }

        **Examples:**
        - Input: "Great tool, very helpful!" -> {"sentiment": "Positive", "isAbusive": false, "reason": null}
        - Input: "This tool is trash, it doesn't work." -> {"sentiment": "Negative", "isAbusive": false, "reason": null} (Constructive negative)
        - Input: "You are an idiot, f*** this app." -> {"sentiment": "Negative", "isAbusive": true, "reason": "Contains profanity and insults"}
        `;
    }

    async analyze(text) {
        try {
            // console.log('🔍 Analyzing feedback:', text);

            const messages = [
                new SystemMessage(this.systemPrompt),
                new HumanMessage(text)
            ];

            const response = await this.model.invoke(messages);
            const content = response.content.trim();

            // Attempt to parse JSON
            // Sometimes models return markdown blocks like \`\`\`json ... \`\`\`
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            } else {
                return JSON.parse(content);
            }
        } catch (error) {
            console.error('Feedback Agent Error:', error);
            // Default safe fallback if AI fails
            return { sentiment: 'Neutral', isAbusive: false, reason: null };
        }
    }
}

module.exports = { FeedbackAgent };
