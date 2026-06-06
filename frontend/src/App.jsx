import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Dashboard from './components/Dashboard';
import LiveMonitor from './components/LiveMonitor';
import Reports from './components/Reports';
import Settings from './components/Settings';
import FloatingAgent from './components/FloatingAgent';
import { setAuthToken } from './api';
import { ToastProvider } from './components/Toast';
import './index.css';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '🛡️', label: 'Dashboard Simulation' },
  { id: 'monitor', icon: '📡', label: 'Live Monitor' },
  { id: 'reports', icon: '📄', label: 'Reports' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage('Check your email for a confirmation link.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-cyan)', letterSpacing: '-1px' }}>
            AI SOC Analyst
          </div>
          <div style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '0.9rem' }}>
            {isSignUp ? 'Create an account' : 'Sign in to access the threat detection dashboard'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              color: 'var(--color-critical)',
              fontSize: '0.82rem',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
            }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{
              color: 'var(--color-low)',
              fontSize: '0.82rem',
              background: 'rgba(52,211,153,0.08)',
              border: '1px solid rgba(52,211,153,0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--accent-cyan)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '11px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: '4px',
            }}
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }} />
          </div>

          <button
            type="button"
            onClick={() => supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin },
            })}
            style={{
              background: 'none',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '11px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <img src="https://www.google.com/favicon.ico" width="16" height="16" alt="" />
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-cyan)',
              cursor: 'pointer',
              fontSize: '0.82rem',
              textAlign: 'center',
            }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AuthenticatedApp({ session }) {
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    setAuthToken(session.access_token);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) setAuthToken(s.access_token);
    });

    return () => subscription.unsubscribe();
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">AI</div>
          <div>
            <h1>SOC Analyst</h1>
            <div className="subtitle">Threat Detection</div>
          </div>
        </div>

        <nav>
          <ul className="nav-items">
            {NAV_ITEMS.map(item => (
              <li key={item.id}>
                <button
                  className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => setActivePage(item.id)}
                  id={`nav-${item.id}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-status" style={{
          marginTop: 'auto',
          padding: '14px',
          background: 'rgba(52, 211, 153, 0.06)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(52, 211, 153, 0.1)',
          fontSize: '0.78rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--color-low)',
              animation: 'pulse-dot 2s ease-in-out infinite',
            }}></div>
            <span style={{ color: 'var(--color-low)', fontWeight: 600 }}>System Online</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            AI Engine Active · v1.0
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.75rem', marginTop: '8px', fontWeight: 600, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Developed by</span> <span style={{ color: 'var(--accent-cyan)' }}>Dolev Atik</span>
          </div>
        </div>

        <div className="sidebar-user" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
              {session.user.email}
            </span>
            <button
              onClick={handleSignOut}
              title="Sign out"
              style={{
                background: 'none',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '0.72rem',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'monitor' && <LiveMonitor />}
        {activePage === 'reports' && <Reports />}
        {activePage === 'settings' && <Settings />}
      </main>

      <FloatingAgent />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;

  return (
    <ToastProvider>
      {session ? <AuthenticatedApp session={session} /> : <LoginPage />}
    </ToastProvider>
  );
}
