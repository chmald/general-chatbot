const express = require('express');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { getConversations, deleteConversation } = require('../utils/chatStorage');

const router = express.Router();

// GET /api/sessions - Get all conversations for current session
router.get('/', async (req, res) => {
  try {
    const sessionId = req.session.id;
    const conversations = await getConversations(sessionId);
    
    res.json({
      conversations,
      currentSession: sessionId.substring(0, 8),
      count: conversations.length,
    });

  } catch (error) {
    logger.error('Failed to retrieve conversations:', {
      error: error.message,
      sessionId: req.session.id?.substring(0, 8),
    });

    res.status(500).json({ 
      error: 'Failed to retrieve conversations' 
    });
  }
});

// POST /api/sessions - Create a new conversation
router.post('/', (req, res) => {
  try {
    const newConversationId = uuidv4();
    req.session.conversationId = newConversationId;
    
    res.json({
      conversationId: newConversationId,
      message: 'New conversation created',
      timestamp: new Date().toISOString(),
    });

    logger.info('New conversation created', {
      sessionId: req.session.id.substring(0, 8),
      conversationId: newConversationId.substring(0, 8),
    });

  } catch (error) {
    logger.error('Failed to create new conversation:', {
      error: error.message,
      sessionId: req.session.id?.substring(0, 8),
    });

    res.status(500).json({ 
      error: 'Failed to create new conversation' 
    });
  }
});

// DELETE /api/sessions/:conversationId - Delete a specific conversation
router.delete('/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const sessionId = req.session.id;

    if (!conversationId) {
      return res.status(400).json({ 
        error: 'Conversation ID is required' 
      });
    }

    await deleteConversation(sessionId, conversationId);

    // If this was the current conversation, clear it from session
    if (req.session.conversationId === conversationId) {
      req.session.conversationId = null;
    }

    res.json({
      message: 'Conversation deleted successfully',
      conversationId,
    });

    logger.info('Conversation deleted', {
      sessionId: sessionId.substring(0, 8),
      conversationId: conversationId.substring(0, 8),
    });

  } catch (error) {
    logger.error('Failed to delete conversation:', {
      error: error.message,
      sessionId: req.session.id?.substring(0, 8),
      conversationId: req.params.conversationId?.substring(0, 8),
    });

    res.status(500).json({ 
      error: 'Failed to delete conversation' 
    });
  }
});

// GET /api/sessions/current - Get current session info
router.get('/current', (req, res) => {
  res.json({
    sessionId: req.session.id.substring(0, 8),
    conversationId: req.session.conversationId || null,
    isNew: !req.session.conversationId,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
