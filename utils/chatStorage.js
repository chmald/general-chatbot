const mongoose = require('mongoose');
const logger = require('./logger');

// Message schema for individual chat messages
const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant', 'system'],
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

// Conversation schema to group messages
const conversationSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  conversationId: {
    type: String,
    required: true,
    index: true,
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  title: {
    type: String,
    maxlength: 100,
  },
}, {
  timestamps: true,
});

// Compound index for efficient queries
conversationSchema.index({ sessionId: 1, conversationId: 1 }, { unique: true });

// Auto-delete conversations after 30 days (configurable)
conversationSchema.index(
  { createdAt: 1 }, 
  { 
    expireAfterSeconds: parseInt(process.env.CONVERSATION_TTL) || 30 * 24 * 60 * 60 // 30 days
  }
);

// Middleware to update the updatedAt field
conversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static methods
conversationSchema.statics.findBySession = function(sessionId) {
  return this.find({ sessionId }).sort({ updatedAt: -1 });
};

conversationSchema.statics.findConversation = function(sessionId, conversationId) {
  return this.findOne({ sessionId, conversationId });
};

const Conversation = mongoose.model('Conversation', conversationSchema);

// Helper functions for chat storage operations

/**
 * Save a message to a conversation
 */
async function saveMessage(sessionId, conversationId, messageData) {
  try {
    const maxMessages = parseInt(process.env.MAX_CHAT_HISTORY) || 50;
    
    let conversation = await Conversation.findConversation(sessionId, conversationId);
    
    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        sessionId,
        conversationId,
        messages: [messageData],
        title: generateConversationTitle(messageData.content),
      });
    } else {
      // Add message to existing conversation
      conversation.messages.push(messageData);
      
      // Trim messages if exceeding max limit (keep recent messages)
      if (conversation.messages.length > maxMessages) {
        const systemMessages = conversation.messages.filter(msg => msg.role === 'system');
        const otherMessages = conversation.messages.filter(msg => msg.role !== 'system');
        
        // Keep system messages and most recent other messages
        const recentMessages = otherMessages.slice(-maxMessages + systemMessages.length);
        conversation.messages = [...systemMessages, ...recentMessages];
      }
      
      // Update title if this is the first user message and no title exists
      if (!conversation.title && messageData.role === 'user') {
        conversation.title = generateConversationTitle(messageData.content);
      }
    }
    
    await conversation.save();
    return conversation;
    
  } catch (error) {
    logger.error('Failed to save message:', {
      error: error.message,
      sessionId: sessionId.substring(0, 8),
      conversationId: conversationId.substring(0, 8),
    });
    throw error;
  }
}

/**
 * Get chat history for a conversation
 */
async function getChatHistory(sessionId, conversationId, limit = null) {
  try {
    const conversation = await Conversation.findConversation(sessionId, conversationId);
    
    if (!conversation) {
      return [];
    }
    
    let messages = conversation.messages.sort((a, b) => a.timestamp - b.timestamp);
    
    if (limit && messages.length > limit) {
      messages = messages.slice(-limit);
    }
    
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));
    
  } catch (error) {
    logger.error('Failed to get chat history:', {
      error: error.message,
      sessionId: sessionId.substring(0, 8),
      conversationId: conversationId.substring(0, 8),
    });
    throw error;
  }
}

/**
 * Get all conversations for a session
 */
async function getConversations(sessionId) {
  try {
    const conversations = await Conversation.findBySession(sessionId)
      .select('conversationId title createdAt updatedAt messages')
      .lean();
    
    return conversations.map(conv => ({
      conversationId: conv.conversationId,
      title: conv.title || 'Untitled Conversation',
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv.messages.length,
      lastMessage: conv.messages.length > 0 
        ? conv.messages[conv.messages.length - 1].content.substring(0, 100) + '...'
        : 'No messages',
    }));
    
  } catch (error) {
    logger.error('Failed to get conversations:', {
      error: error.message,
      sessionId: sessionId.substring(0, 8),
    });
    throw error;
  }
}

/**
 * Delete a conversation
 */
async function deleteConversation(sessionId, conversationId) {
  try {
    const result = await Conversation.deleteOne({ sessionId, conversationId });
    
    if (result.deletedCount === 0) {
      throw new Error('Conversation not found');
    }
    
    return result;
    
  } catch (error) {
    logger.error('Failed to delete conversation:', {
      error: error.message,
      sessionId: sessionId.substring(0, 8),
      conversationId: conversationId.substring(0, 8),
    });
    throw error;
  }
}

/**
 * Clear all conversations for a session
 */
async function clearSessionConversations(sessionId) {
  try {
    const result = await Conversation.deleteMany({ sessionId });
    return result;
    
  } catch (error) {
    logger.error('Failed to clear session conversations:', {
      error: error.message,
      sessionId: sessionId.substring(0, 8),
    });
    throw error;
  }
}

/**
 * Generate a conversation title from the first message
 */
function generateConversationTitle(content) {
  const cleanContent = content.trim();
  
  if (cleanContent.length <= 50) {
    return cleanContent;
  }
  
  // Try to find a sentence break
  const sentences = cleanContent.split(/[.!?]/);
  if (sentences[0] && sentences[0].length <= 50) {
    return sentences[0].trim();
  }
  
  // Fall back to truncating at word boundary
  const words = cleanContent.split(' ');
  let title = '';
  
  for (const word of words) {
    if ((title + ' ' + word).length > 50) {
      break;
    }
    title += (title ? ' ' : '') + word;
  }
  
  return title || 'New Conversation';
}

module.exports = {
  Conversation,
  saveMessage,
  getChatHistory,
  getConversations,
  deleteConversation,
  clearSessionConversations,
};
