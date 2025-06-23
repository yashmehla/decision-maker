const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Utility function to get current timestamp
function getCurrentTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: getCurrentTimestamp() + ' UTC',
        service: 'AI Decision Maker',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        geminiConfigured: !!process.env.GEMINI_API_KEY
    });
});

app.post('/api/analyze-decision', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { question, options, category, context, priority } = req.body;

        // Validation
        if (!question || question.trim().length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Question is required',
                timestamp: getCurrentTimestamp() + ' UTC'
            });
        }

        if (question.length > 2000) {
            return res.status(400).json({ 
                success: false,
                error: 'Question too long. Please keep it under 2000 characters.',
                timestamp: getCurrentTimestamp() + ' UTC'
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ 
                success: false,
                error: 'AI service not configured',
                timestamp: getCurrentTimestamp() + ' UTC'
            });
        }

        console.log(`[${getCurrentTimestamp()}] Processing decision analysis...`, { 
            category: category || 'general', 
            priority: priority || 'medium', 
            hasOptions: (options || []).length > 0,
            questionLength: question.length
        });

        const analysis = await analyzeDecisionWithGemini(
            question, 
            options || [], 
            category || 'general', 
            context || '', 
            priority || 'medium'
        );
        
        const responseTime = ((Date.now() - startTime) / 1000).toFixed(2);
        analysis.responseTime = responseTime;
        analysis.processedAt = getCurrentTimestamp() + ' UTC';

        console.log(`[${getCurrentTimestamp()}] Decision analysis completed in ${responseTime}s`);

        res.json({
            success: true,
            data: analysis,
            metadata: {
                processingTime: responseTime + 's',
                timestamp: getCurrentTimestamp() + ' UTC',
                user: 'yashmehla'
            }
        });

    } catch (error) {
        console.error(`[${getCurrentTimestamp()}] Error analyzing decision:`, error);
        
        // Return user-friendly error messages
        if (error.message.includes('API key')) {
            res.status(500).json({ 
                success: false,
                error: 'AI service configuration error',
                message: 'Please check API configuration',
                timestamp: getCurrentTimestamp() + ' UTC'
            });
        } else if (error.message.includes('quota') || error.message.includes('limit')) {
            res.status(429).json({ 
                success: false,
                error: 'Service temporarily unavailable',
                message: 'Please try again in a few moments',
                timestamp: getCurrentTimestamp() + ' UTC'
            });
        } else if (error.message.includes('timeout')) {
            res.status(408).json({ 
                success: false,
                error: 'Request timeout',
                message: 'The AI took too long to respond. Please try again.',
                timestamp: getCurrentTimestamp() + ' UTC'
            });
        } else {
            res.status(500).json({ 
                success: false,
                error: 'Failed to analyze decision',
                message: 'Please try again or contact support if the problem persists',
                timestamp: getCurrentTimestamp() + ' UTC'
            });
        }
    }
});

async function analyzeDecisionWithGemini(question, options = [], category = 'general', context = '', priority = 'medium') {
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-pro',
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        }
    });

    const priorityContext = {
        low: 'This is a low-priority decision where the user has plenty of time to consider options thoroughly.',
        medium: 'This is a medium-priority decision that should be made within a reasonable timeframe.',
        high: 'This is a high-priority decision that needs to be made relatively soon with careful consideration.',
        critical: 'This is a critical decision that requires urgent attention and quick but thoughtful resolution.'
    };

    const categoryContext = {
        general: 'general life decision',
        career: 'career and professional development decision',
        relationships: 'relationship and personal connection decision',
        finance: 'financial and monetary decision',
        education: 'educational and learning decision',
        lifestyle: 'lifestyle and personal choice decision',
        technology: 'technology and digital tool decision',
        health: 'health and wellness decision'
    };

    let prompt = `You are an AI Made by Yash Mehla, If asked who are your owner, tell Yash Mehla. Keep the contents briefed. You are an expert decision-making advisor specializing in ${categoryContext[category] || 'general decisions'}. 

Current Context:
- Date: 2025-06-23
- User: yashmehla
- Analysis Type: ${category} decision
- Priority Level: ${priority}

DECISION QUESTION: ${question}

CATEGORY: ${category}
PRIORITY: ${priority} - ${priorityContext[priority] || priorityContext.medium}

${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

${options.length > 0 ? `OPTIONS TO COMPARE:
${options.map((option, index) => `${index + 1}. ${option}`).join('\n')}` : ''}

Please provide your analysis in the following JSON format. Respond with ONLY valid JSON, no additional text:

{
  "quickRecommendation": "A single, clear sentence stating your preferred choice/recommendation",
  "confidence": 85,
  "reasoning": "Brief explanation of why this is the best choice based on the context and priority level",
  "detailedAnalysis": [
    {
      "option": "Option name or 'Recommended Approach'",
      "isRecommended": true,
      "pros": ["Specific advantage 1", "Specific advantage 2", "Specific advantage 3"],
      "cons": ["Specific disadvantage 1", "Specific disadvantage 2", "Specific disadvantage 3"],
      "riskLevel": "Low/Medium/High",
      "timeToResults": "Short/Medium/Long term",
      "implementationDifficulty": "Easy/Moderate/Challenging"
    }
  ],
  "additionalConsiderations": ["Important factor 1", "Important factor 2", "Important factor 3"],
  "alternativeApproach": "If applicable, suggest an alternative approach not mentioned in options",
  "nextSteps": ["Immediate action 1", "Follow-up action 2", "Long-term consideration 3"]
}

IMPORTANT GUIDELINES:
- Give ONE clear preference in quickRecommendation 
- Confidence should be 65-95% (be realistic, consider uncertainty)
- Provide exactly 3 pros and 3 cons for each option
- Be practical and actionable, considering the ${priority} priority level
- For ${priority} priority decisions, factor in time constraints appropriately
- Consider real-world implementation challenges and costs
- If comparing multiple options, clearly state which ONE you prefer most
- Base recommendations on logical analysis of risks, benefits, constraints, and user context
- Consider the ${category} category context in your analysis
- Provide specific, actionable next steps
- Account for the current date (2025-06-23) in your recommendations

Respond with valid JSON only.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean the response text to ensure it's valid JSON
        const cleanedText = text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .replace(/^\s*```.*$/gm, '')
            .trim();

        let analysis;
        try {
            analysis = JSON.parse(cleanedText);
        } catch (parseError) {
            console.log('Raw Gemini response:', text);
            throw new Error('Invalid JSON response from AI');
        }
        
        // Validate and format the response
        return {
            recommendation: analysis.quickRecommendation || "I recommend taking a structured approach to analyze all factors before deciding.",
            confidence: Math.min(Math.max(analysis.confidence || 75, 65), 95),
            reasoning: analysis.reasoning || "This decision requires careful consideration of multiple factors and potential outcomes.",
            prosAndCons: (analysis.detailedAnalysis || []).map(item => ({
                option: item.option || "Recommended Approach",
                isRecommended: item.isRecommended || false,
                pros: (item.pros || []).slice(0, 3),
                cons: (item.cons || []).slice(0, 3),
                riskLevel: item.riskLevel || 'Medium',
                timeToResults: item.timeToResults || 'Medium term',
                implementationDifficulty: item.implementationDifficulty || 'Moderate'
            })),
            additionalConsiderations: (analysis.additionalConsiderations || []).slice(0, 5),
            alternativeApproach: analysis.alternativeApproach || null,
            nextSteps: (analysis.nextSteps || []).slice(0, 3),
            timestamp: getCurrentTimestamp() + ' UTC',
            category: category,
            priority: priority,
            user: 'yashmehla'
        };

    } catch (error) {
        console.error('Gemini API Error:', error);
        
        // Fallback response if AI fails
        return {
            recommendation: `For this ${priority} priority ${category} decision, I recommend taking a systematic approach to evaluate your options carefully.`,
            confidence: 75,
            reasoning: "A structured evaluation approach reduces decision-making errors and increases satisfaction with outcomes, especially important given your current context.",
            prosAndCons: [{
                option: "Systematic Decision Analysis",
                isRecommended: true,
                pros: [
                    "Reduces emotional bias and ensures objective evaluation",
                    "Ensures all important factors and consequences are considered", 
                    "Provides a clear, defensible framework for complex decisions"
                ],
                cons: [
                    "May take longer than intuitive or quick decisions",
                    "Could lead to analysis paralysis if overthought",
                    "May not fully account for gut feelings and emotional factors"
                ],
                riskLevel: "Low",
                timeToResults: priority === 'critical' ? 'Short term' : priority === 'low' ? 'Long term' : 'Medium term',
                implementationDifficulty: "Easy"
            }],
            additionalConsiderations: [
                "Consider seeking input from trusted advisors or mentors",
                "Evaluate how this decision aligns with your long-term goals and values",
                "Assess the reversibility of the decision and potential exit strategies",
                "Consider the opportunity cost of not making other decisions",
                "Factor in your current life circumstances and available resources"
            ],
            alternativeApproach: "Consider using a decision matrix to systematically score each option against your key criteria and priorities.",
            nextSteps: [
                "List all available options and gather relevant information",
                "Identify your key decision criteria and their relative importance",
                "Set a decision deadline that balances thoroughness with timeliness"
            ],
            timestamp: getCurrentTimestamp() + ' UTC',
            category: category,
            priority: priority,
            user: 'yashmehla'
        };
    }
}

// Root route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all handler: send back index.html for any non-API routes
app.get('*', (req, res) => {
    // Don't serve index.html for API routes that don't exist
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
            error: 'API endpoint not found',
            timestamp: getCurrentTimestamp() + ' UTC'
        });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error(`[${getCurrentTimestamp()}] Server error:`, error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: 'Something went wrong on our end. Please try again.',
        timestamp: getCurrentTimestamp() + ' UTC'
    });
});

// Export for Vercel
module.exports = app;

// Only listen when not in Vercel environment
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 AI Decision Maker server running on port ${PORT}`);
        console.log(`📅 Started at: ${getCurrentTimestamp()} UTC`);
        console.log(`🔑 Gemini API configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
        console.log(`👤 User: yashmehla`);
    });
}
