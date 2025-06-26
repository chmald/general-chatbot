import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  withCredentials: true, // Important for session cookies
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and error handling
api.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching issues
    config.params = {
      ...config.params,
      _t: Date.now(),
    };
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url,
      });
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error:', error.message);
    } else {
      // Something else happened
      console.error('Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

class ChatService {
  /**
   * Send a message to the AI assistant
   * @param {Object} data - Message data
   * @param {string} data.message - The message text
   * @param {string} [data.conversationId] - Optional conversation ID
   * @returns {Promise<Object>} AI response
   */
  static async sendMessage(data) {
    try {
      const response = await api.post('/chat', {
        message: data.message,
        conversationId: data.conversationId,
      });
      return response.data;
    } catch (error) {
      // Enhanced error handling for chat messages
      if (error.response?.status === 429) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      } else if (error.response?.status === 503) {
        throw new Error('AI service is temporarily unavailable. Please try again later.');
      } else if (error.response?.status >= 500) {
        throw new Error('Server error. Please try again later.');
      }
      throw error;
    }
  }

  /**
   * Get chat history for current conversation
   * @param {string} [conversationId] - Optional conversation ID
   * @returns {Promise<Object>} Chat history
   */
  static async getChatHistory(conversationId) {
    try {
      const params = conversationId ? { conversationId } : {};
      const response = await api.get('/chat/history', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to get chat history:', error);
      throw error;
    }
  }

  /**
   * Clear chat history for current conversation
   * @param {string} [conversationId] - Optional conversation ID
   * @returns {Promise<Object>} Success response
   */
  static async clearChatHistory(conversationId) {
    try {
      const params = conversationId ? { conversationId } : {};
      const response = await api.delete('/chat/history', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      throw error;
    }
  }

  /**
   * Get current session information
   * @returns {Promise<Object>} Session info
   */
  static async getCurrentSession() {
    try {
      const response = await api.get('/sessions/current');
      return response.data;
    } catch (error) {
      console.error('Failed to get current session:', error);
      throw error;
    }
  }

  /**
   * Create a new conversation
   * @returns {Promise<Object>} New conversation data
   */
  static async createNewConversation() {
    try {
      const response = await api.post('/sessions');
      return response.data;
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      throw error;
    }
  }

  /**
   * Get all conversations for current session
   * @returns {Promise<Object>} Conversations list
   */
  static async getConversations() {
    try {
      const response = await api.get('/sessions');
      return response.data;
    } catch (error) {
      console.error('Failed to get conversations:', error);
      throw error;
    }
  }

  /**
   * Delete a specific conversation
   * @param {string} conversationId - Conversation ID to delete
   * @returns {Promise<Object>} Success response
   */
  static async deleteConversation(conversationId) {
    try {
      const response = await api.delete(`/sessions/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  }

  /**
   * Check API health
   * @returns {Promise<Object>} Health status
   */
  static async checkHealth() {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }
}

export default ChatService;
