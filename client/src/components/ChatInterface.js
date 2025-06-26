import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, RotateCcw, Send, User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChatService from '../services/ChatService';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat and load history
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const session = await ChatService.getCurrentSession();
        setConversationId(session.conversationId);
        setIsConnected(true);
        
        if (session.conversationId) {
          await loadChatHistory(session.conversationId);
        }
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        setError('Failed to connect to chat service');
      }
    };

    initializeChat();
  }, []);

  // Load chat history
  const loadChatHistory = async (convId) => {
    try {
      const history = await ChatService.getChatHistory(convId);
      setMessages(history.messages || []);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      setError('Failed to load chat history');
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setError(null);

    // Add user message to UI immediately
    const userMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await ChatService.sendMessage({
        message: userMessage,
        conversationId,
      });

      // Update conversation ID if new
      if (response.conversationId && response.conversationId !== conversationId) {
        setConversationId(response.conversationId);
      }

      // Add AI response to messages
      const aiMsg = {
        role: 'assistant',
        content: response.response,
        timestamp: response.timestamp,
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error('Failed to send message:', error);
      setError(
        error.response?.data?.error || 
        'Failed to send message. Please try again.'
      );
      
      // Remove the user message if sending failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press in input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Start new conversation
  const handleNewConversation = async () => {
    try {
      const newSession = await ChatService.createNewConversation();
      setConversationId(newSession.conversationId);
      setMessages([]);
      setError(null);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to start new conversation:', error);
      setError('Failed to start new conversation');
    }
  };

  // Clear current conversation
  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear this conversation?')) {
      try {
        if (conversationId) {
          await ChatService.clearChatHistory(conversationId);
        }
        setMessages([]);
        setError(null);
        inputRef.current?.focus();
      } catch (error) {
        console.error('Failed to clear chat:', error);
        setError('Failed to clear chat history');
      }
    }
  };

  // Format timestamp for display
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div>
          <h1 className="chat-title">AI Assistant</h1>
          <p className="chat-subtitle">
            {isConnected ? 'Connected to Azure AI Foundry' : 'Connecting...'}
          </p>
        </div>
        <div className="header-controls">
          <button
            className="control-button"
            onClick={handleNewConversation}
            disabled={isLoading}
            title="New conversation"
          >
            <MessageSquare size={18} />
          </button>
          <button
            className="control-button"
            onClick={handleClearChat}
            disabled={isLoading || messages.length === 0}
            title="Clear conversation"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Bot />
            </div>
            <h3>Welcome to AI Assistant</h3>
            <p>
              Start a conversation by typing a message below. 
              I'm here to help with questions, tasks, and provide information.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-avatar">
                {message.role === 'user' ? <User /> : <Bot />}
              </div>
              <div className="message-content">
                <div className="message-text">
                  {message.role === 'assistant' ? (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Custom components for better styling
                        code({node, inline, className, children, ...props}) {
                          return inline ? (
                            <code className="inline-code" {...props}>
                              {children}
                            </code>
                          ) : (
                            <pre className="code-block">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          );
                        },
                        blockquote({children, ...props}) {
                          return (
                            <blockquote className="markdown-blockquote" {...props}>
                              {children}
                            </blockquote>
                          );
                        },
                        table({children, ...props}) {
                          return (
                            <div className="table-wrapper">
                              <table className="markdown-table" {...props}>
                                {children}
                              </table>
                            </div>
                          );
                        },
                        ul({children, ...props}) {
                          return (
                            <ul className="markdown-list" {...props}>
                              {children}
                            </ul>
                          );
                        },
                        ol({children, ...props}) {
                          return (
                            <ol className="markdown-list ordered" {...props}>
                              {children}
                            </ol>
                          );
                        }
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <div className="user-message">{message.content}</div>
                  )}
                </div>
                <div className="message-time">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar">
              <Bot />
            </div>
            <div className="typing-indicator">
              <span>AI is thinking</span>
              <div className="typing-dots">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            disabled={isLoading || !isConnected}
            rows={1}
            style={{ 
              height: 'auto',
              minHeight: '44px',
              maxHeight: '120px',
            }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />
          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || !isConnected}
            title="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
