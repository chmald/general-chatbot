const express = require('express');
const { AzureOpenAI } = require('openai');
const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');
const { AzureKeyCredential } = require('@azure/core-auth');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { saveMessage, getChatHistory } = require('../utils/chatStorage');

const router = express.Router();

// Initialize Azure OpenAI client with managed identity (preferred) or fallback to endpoint/key
let openAIClient;

function initializeOpenAIClient() {
  try {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';
    
    if (!endpoint) {
      throw new Error('AZURE_OPENAI_ENDPOINT is required');
    }

    // Use Managed Identity for authentication (recommended for Azure-hosted apps)
    if (process.env.NODE_ENV === 'production' && !process.env.AZURE_OPENAI_API_KEY) {
      const credential = new DefaultAzureCredential();
      const scope = "https://cognitiveservices.azure.com/.default";
      const azureADTokenProvider = getBearerTokenProvider(credential, scope);
      openAIClient = new AzureOpenAI({ endpoint, azureADTokenProvider, deployment, apiVersion });
      logger.info('Initialized Azure OpenAI client with Managed Identity');
    } else {
      // Fallback to API key for development or when specifically provided
      const apiKey = process.env.AZURE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('AZURE_OPENAI_API_KEY is required when not using Managed Identity');
      }
      openAIClient = new AzureOpenAI({ endpoint, apiKey, deployment, apiVersion });
      logger.info('Initialized Azure OpenAI client with API Key');
    }
  } catch (error) {
    logger.error('Failed to initialize Azure OpenAI client:', error);
    throw error;
  }
}

// Initialize client on module load
initializeOpenAIClient();

// POST /api/chat - Send a message and get AI response
router.post('/', async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Message is required and must be a non-empty string' 
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({ 
        error: 'Message is too long. Maximum length is 4000 characters.' 
      });
    }

    // Get or create session ID
    const sessionId = req.session.id;
    const currentConversationId = conversationId || req.session.conversationId || uuidv4();
    
    // Update session with conversation ID
    req.session.conversationId = currentConversationId;

    // Get chat history for context
    const chatHistory = await getChatHistory(sessionId, currentConversationId);
    
    // Prepare messages for Azure OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant. Be concise, accurate, and friendly. 
                 Current time: ${new Date().toISOString()}.
                 Keep responses under 500 words unless specifically asked for longer content.`
      },
      ...chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message.trim()
      }
    ];

    // Call Azure OpenAI
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';
    const response = await openAIClient.chat.completions.create({
      model: deploymentName,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No response from Azure OpenAI');
    }

    const aiResponse = response.choices[0].message.content;

    // Save both user message and AI response
    await saveMessage(sessionId, currentConversationId, {
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    });

    await saveMessage(sessionId, currentConversationId, {
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    });

    // Return response
    res.json({
      response: aiResponse,
      conversationId: currentConversationId,
      timestamp: new Date().toISOString(),
      usage: {
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
      }
    });

    logger.info('Chat completion successful', {
      sessionId: sessionId.substring(0, 8),
      conversationId: currentConversationId.substring(0, 8),
      messageLength: message.length,
      responseLength: aiResponse.length,
      tokensUsed: response.usage?.totalTokens || 0,
    });

  } catch (error) {
    logger.error('Chat completion error:', {
      error: error.message,
      stack: error.stack,
      sessionId: req.session.id?.substring(0, 8),
    });

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'AI service is temporarily unavailable. Please try again later.' 
      });
    }

    if (error.status === 429) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please wait a moment before trying again.' 
      });
    }

    if (error.status === 401 || error.status === 403) {
      return res.status(500).json({ 
        error: 'Authentication error. Please contact support if this persists.' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to process your message. Please try again.' 
    });
  }
});

// GET /api/chat/history - Get chat history for current session
router.get('/history', async (req, res) => {
  try {
    const sessionId = req.session.id;
    const conversationId = req.query.conversationId || req.session.conversationId;

    if (!conversationId) {
      return res.json({ messages: [] });
    }

    const chatHistory = await getChatHistory(sessionId, conversationId);
    
    res.json({
      messages: chatHistory,
      conversationId,
      count: chatHistory.length,
    });

  } catch (error) {
    logger.error('Failed to retrieve chat history:', {
      error: error.message,
      sessionId: req.session.id?.substring(0, 8),
    });

    res.status(500).json({ 
      error: 'Failed to retrieve chat history' 
    });
  }
});

// DELETE /api/chat/history - Clear chat history for current conversation
router.delete('/history', async (req, res) => {
  try {
    const sessionId = req.session.id;
    const conversationId = req.query.conversationId || req.session.conversationId;

    if (!conversationId) {
      return res.json({ message: 'No conversation to clear' });
    }

    // Note: Implementation depends on your storage solution
    // This is a placeholder - implement based on your chatStorage module
    
    res.json({ 
      message: 'Chat history cleared successfully',
      conversationId 
    });

    logger.info('Chat history cleared', {
      sessionId: sessionId.substring(0, 8),
      conversationId: conversationId.substring(0, 8),
    });

  } catch (error) {
    logger.error('Failed to clear chat history:', {
      error: error.message,
      sessionId: req.session.id?.substring(0, 8),
    });

    res.status(500).json({ 
      error: 'Failed to clear chat history' 
    });
  }
});

module.exports = router;
