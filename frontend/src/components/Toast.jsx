import { useState, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const STYLES = {
  critical: { border: 'var(--color-critical)', icon: '🔴', label: 'CRITICAL' },
  high:     { border: 'var(--color-high)',     icon: '🟠', label: 'HIGH' },
  success:  { border: 'var(--color-low)',      icon: '✅', label: 'OK' },
  info:     { border: 'var(--accent-cyan)',    icon: 'ℹ️', label: 'INFO' },
};

function ToastItem({ toast, onRemove }) {
  const s = STYLES[toast.type] || STYLES.info;
  return (
    <div style={{
      background: 'rgba(10,15,30,0.97)',
      border: `1px solid ${s.border}`,
      borderLeft: `3px solid ${s.border}`,
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      maxWidth: 360,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      animation: 'toast-slide-in 0.25s ease',
    }}>
      <span style={{ fontSize: '1rem', marginTop: 1 }}>{s.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: s.border, letterSpacing: '0.08em', marginBottom: 3 }}>
          {s.label}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
          {toast.message}
        </div>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', fontSize: '0.9rem', marginTop: -2 }}
      >✕</button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'info', duration = 6000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const remove = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
