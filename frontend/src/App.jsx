import { useState } from 'react';
import Dashboard from './components/Dashboard';
import LiveMonitor from './components/LiveMonitor';
import Reports from './components/Reports';
import Settings from './components/Settings';
import FloatingAgent from './components/FloatingAgent';
import './index.css';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '🛡️', label: 'Dashboard Simulation' },
  { id: 'monitor', icon: '📡', label: 'Live Monitor' },
  { id: 'reports', icon: '📄', label: 'Reports' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  return (
    <div className="app-layout">
      {/* Sidebar */}
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

        {/* Status indicator */}
        <div style={{
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
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'monitor' && <LiveMonitor />}
        {activePage === 'reports' && <Reports />}
        {activePage === 'settings' && <Settings />}
      </main>

      {/* Floating AI Agent */}
      <FloatingAgent />
    </div>
  );
}
