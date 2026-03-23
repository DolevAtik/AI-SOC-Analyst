import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function FloatingAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello Analyst. I am monitoring the current incidents. What would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Only establish connection once
    const newSocket = io('/'); // Let socket.io connect to the same origin with Vite proxy, or wait - Vite proxies /socket.io correctly? Let's use the explicit target.
    // Actually the proxy target in Vite doesn't natively forward WS unless configured. Wait, earlier io('http://localhost:5000') was used.
    // Let's use standard URL logic: process.env or just hardcoded as before.
    const wsUrl = 'http://localhost:5000'; // Fallback for local dev through exposed docker port
    const s = io(wsUrl);
    setSocket(s);

    s.on('connect', () => console.log('Floating Agent connected to WebSocket'));

    const handleChatResponse = (data) => {
      setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);
      setIsTyping(false);
      setUnreadCount(prev => prev + 1);
    };

    s.on('chat_response', handleChatResponse);

    return () => {
      s.disconnect();
    };
  }, []);

  // Clear unread when opened
  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setIsTyping(true);
    
    // Fetch latest context directly from API to ensure fresh context across pages
    let context = [];
    try {
      const res = await fetch('/api/incidents?limit=10');
      if (res.ok) {
        const data = await res.json();
        context = (data.incidents || []).slice(0, 10).map(inc => ({
          timestamp: inc.timestamp,
          threat_type: inc.threat_type,
          severity: inc.severity,
          source_ip: inc.source_ip
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch context for chat", e);
    }

    socket.emit('chat_message', { 
      message: input, 
      context: context 
    });
    
    setInput('');
  };

  return (
    <div className={`floating-agent-wrapper ${isOpen ? 'open' : ''}`}>
      {isOpen && (
        <div className="glass-card floating-agent-window animate-fade-in-up">
          <div className="card-header floating-agent-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="agent-avatar">🤖</span>
              <h3>SOC AI Assistant</h3>
            </div>
            <button className="btn-icon" onClick={() => setIsOpen(false)}>✕</button>
          </div>
          
          <div className="chat-messages floating-chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.role === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                <span className="bubble-label">{msg.role === 'user' ? 'You' : 'SOC-AI'}</span>
                <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
              </div>
            ))}
            {isTyping && (
              <div className="chat-bubble ai-bubble typing-indicator">
                <span className="dot"></span><span className="dot"></span><span className="dot"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="chat-input-area" style={{ display: 'flex', gap: '8px', padding: '12px' }}>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="chat-input"
              style={{ flexGrow: 1, padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-glass-border)', background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: '0.9rem', outline: 'none' }}
              disabled={!socket || isTyping}
            />
            <button type="submit" className="btn btn-primary" style={{ borderRadius: 'var(--radius-lg)', padding: '0 16px' }} disabled={!socket || isTyping || !input.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}

      <button className="floating-agent-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '💬' : '🤖'}
        {!isOpen && unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </button>
    </div>
  );
}
