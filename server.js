const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'AI Decision Maker'
    });
});

// Decision analysis endpoint
app.post('/api/analyze-decision', async (req, res) => {
    try {
        const { question, options, category, context, priority } = req.body;

        if (!question || question.trim().length === 0) {
            return res.status(400).json({ error: 'Question is required' });
        }

        if (question.length > 1000) {
            return res.status(400).json({ error: 'Question too long. Please keep it under 1000 characters.' });
        }

        console.log('Processing decision analysis...', { category, priority, hasOptions: options.length > 0 });

        const analysis = await analyzeDecisionWithGemini(question, options, category, context, priority);
        
        res.json({
            success: true,
            data: analysis
        });

    } catch (error) {
        console.error('Error analyzing decision:', error);
        
        // Return user-friendly error messages
        if (error.message.includes('API key')) {
            res.status(500).json({ 
                error: 'AI service configuration error',
                message: 'Please check API configuration' 
            });
        } else if (error.message.includes('quota')) {
            res.status(429).json({ 
                error: 'Service temporarily unavailable',
                message: 'Please try again in a few moments' 
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to analyze decision',
                message: 'Please try again or contact support if the problem persists' 
            });
        }
    }
});

async function analyzeDecisionWithGemini(question, options = [], category = 'general', context = '', priority = 'medium') {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const priorityContext = {
        low: 'This is a low-priority decision where the user has plenty of time to consider options.',
        medium: 'This is a medium-priority decision that should be made within a reasonable timeframe.',
        high: 'This is a high-priority decision that needs to be made relatively soon.',
        critical: 'This is a critical decision that requires urgent attention and quick resolution.'
    };

    let prompt = `You are an expert decision-making advisor with expertise in ${category} decisions. Analyze this decision scenario and provide structured guidance.

DECISION QUESTION: ${question}

CATEGORY: ${category}
PRIORITY: ${priority} - ${priorityContext[priority]}

${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

${options.length > 0 ? `OPTIONS TO COMPARE:
${options.map((option, index) => `${index + 1}. ${option}`).join('\n')}` : ''}

Please provide your analysis in the following JSON format (respond with ONLY valid JSON, no additional text):

{
  "quickRecommendation": "A single, clear sentence stating your preferred choice/recommendation",
  "confidence": 85,
  "reasoning": "Brief explanation of why this is the best choice based on the context and priority level",
  "detailedAnalysis": [
    {
      "option": "Option name or 'Recommended Approach'",
      "isRecommended": true,
      "pros": ["Advantage 1", "Advantage 2", "Advantage 3"],
      "cons": ["Disadvantage 1", "Disadvantage 2", "Disadvantage 3"],
      "riskLevel": "Low/Medium/High",
      "timeToResults": "Short/Medium/Long term"
    }
  ],
  "additionalConsiderations": ["Important factor 1", "Important factor 2"],
  "alternativeApproach": "If applicable, suggest an alternative approach not mentioned in options"
}

IMPORTANT GUIDELINES:
- Give ONE clear preference in quickRecommendation 
- Confidence should be 65-95% (be realistic, consider uncertainty)
- Provide exactly 3 pros and 3 cons for each option
- Be practical and actionable, considering the ${priority} priority level
- For ${priority} priority decisions, factor in time constraints appropriately
- Consider real-world implementation challenges
- If comparing multiple options, clearly state which ONE you prefer most
- Base recommendations on logical analysis of risks, benefits, and constraints
- Consider the category context (${category}) in your analysis

Respond with valid JSON only.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
        // Clean the response text to ensure it's valid JSON
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const analysis = JSON.parse(cleanedText);
        
        // Validate and format the response
        return {
            recommendation: analysis.quickRecommendation || "I recommend taking time to carefully analyze all factors before deciding.",
            confidence: Math.min(Math.max(analysis.confidence || 75, 65), 95),
            reasoning: analysis.reasoning || "This decision requires careful consideration of multiple factors.",
            prosAndCons: (analysis.detailedAnalysis || []).map(item => ({
                option: item.option || "Analysis Option",
                isRecommended: item.isRecommended || false,
                pros: (item.pros || []).slice(0, 3),
                cons: (item.cons || []).slice(0, 3),
                riskLevel: item.riskLevel || 'Medium',
                timeToResults: item.timeToResults || 'Medium term'
            })),
            additionalConsiderations: (analysis.additionalConsiderations || []).slice(0, 5),
            alternativeApproach: analysis.alternativeApproach || null,
            timestamp: new Date().toISOString(),
            category: category,
            priority: priority
        };

    } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError);
        console.log('Raw response:', text);
        
        // Fallback response if JSON parsing fails
        return {
            recommendation: `For this ${priority} priority ${category} decision, I recommend taking a structured approach to evaluate your options.`,
            confidence: 75,
            reasoning: "A systematic evaluation approach reduces decision-making errors and increases satisfaction with outcomes.",
            prosAndCons: [{
                option: "Structured Decision Approach",
                isRecommended: true,
                pros: [
                    "Reduces emotional bias in decision-making",
                    "Ensures all important factors are considered", 
                    "Provides a clear framework for evaluation"
                ],
                cons: [
                    "May take more time than intuitive decisions",
                    "Could lead to analysis paralysis if overthought",
                    "May not account for gut feelings and intuition"
                ],
                riskLevel: "Low",
                timeToResults: priority === 'critical' ? 'Short term' : priority === 'low' ? 'Long term' : 'Medium term'
            }],
            additionalConsiderations: [
                "Consider seeking input from trusted advisors",
                "Evaluate alignment with your long-term goals",
                "Assess the reversibility of the decision"
            ],
            alternativeApproach: "Consider using a decision matrix to score each option against your key criteria.",
            timestamp: new Date().toISOString(),
            category: category,
            priority: priority
        };
    }
}

// Serve the React app for any non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: 'Something went wrong on our end. Please try again.' 
    });
});

app.listen(PORT, () => {
    console.log(`🚀 AI Decision Maker server running on port ${PORT}`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🔑 Gemini API configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
});

module.exports = app;