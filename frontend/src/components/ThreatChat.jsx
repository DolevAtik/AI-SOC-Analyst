import { useState, useEffect, useRef } from 'react';

export default function ThreatChat({ socket, context }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello Analyst. I am monitoring the current incidents. What would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleChatResponse = (data) => {
      setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);
      setIsTyping(false);
    };

    socket.on('chat_response', handleChatResponse);

    return () => {
      socket.off('chat_response', handleChatResponse);
    };
  }, [socket]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setIsTyping(true);
    
    // Only send the most relevant/recent context to avoid payload size limits
    const simplifiedContext = context.slice(0, 10).map(inc => ({
      timestamp: inc.timestamp,
      threat_type: inc.threat_type,
      severity: inc.severity,
      src_ip: inc.src_ip
    }));

    socket.emit('chat_message', { 
      message: input, 
      context: simplifiedContext 
    });
    
    setInput('');
  };

  return (
    <div className="glass-card threat-chat-container flex-col">
      <div className="card-header">
        <h3>💬 AI Threat Hunting Assistant</h3>
      </div>
      
      <div className="chat-messages" style={{ flexGrow: 1, overflowY: 'auto', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '300px', maxHeight: '400px' }}>
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

      <form onSubmit={handleSend} className="chat-input-area" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Has this IP attacked us before?"
          className="chat-input"
          style={{ flexGrow: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
          disabled={!socket || isTyping}
        />
        <button type="submit" className="btn btn-primary" disabled={!socket || isTyping || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
