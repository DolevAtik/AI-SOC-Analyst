import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import StatsCharts from './StatsCharts';
import LogViewer from './LogViewer';
import IncidentTable from './IncidentTable';
import AnalysisPanel from './AnalysisPanel';
import ManualLogInput from './ManualLogInput';
import { getStats, getIncidents, clearIncidents } from '../api';

const SOCKET_SERVER_URL = 'http://localhost:5000';

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ total_incidents: 0, last_hour: 0, by_severity: {}, by_type: {} });
  const [isStreaming, setIsStreaming] = useState(false);
  const [attackRatio, setAttackRatio] = useState(0.3);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    loadStats();
    loadIncidents();

    // Initialize Socket Connection
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setError(null);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Failed to connect to real-time server. Make sure the Flask API is running on port 5000.');
      setIsStreaming(false);
    });

    newSocket.on('new_logs', (data) => {
      if (data.logs) {
        setLogs(prevLogs => [...data.logs, ...prevLogs].slice(0, 500)); // Keep last 500 logs
      }
    });

    newSocket.on('new_incidents', (data) => {
      if (data.incidents) {
         setIncidents(prevIncidents => {
           const newIncidents = data.incidents.map(i => ({ ...i, incident_detected: true }));
           return [...newIncidents, ...prevIncidents].slice(0, 100); // Keep last 100 incidents
         });
      }
    });

    newSocket.on('stats_update', (data) => {
      if (data.stats) {
        setStats(data.stats);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const loadStats = async () => {
    try {
      const res = await getStats();
      setStats(res.stats);
    } catch (err) {
      /* stats may fail if backend is not running */
    }
  };

  const loadIncidents = async () => {
    try {
      const res = await getIncidents();
      if (res.incidents && res.incidents.length > 0) {
        setIncidents(res.incidents.map(i => ({ ...i, incident_detected: true })));
      }
    } catch (err) {
      /* incidents may fail if backend is not running */
    }
  };

  const toggleStream = () => {
    if (!socket) return;
    
    const newState = !isStreaming;
    socket.emit('toggle_stream', { active: newState, attack_ratio: attackRatio });
    setIsStreaming(newState);
  };

  const handleAttackRatioChange = (e) => {
    const newRatio = Number(e.target.value);
    setAttackRatio(newRatio);
    if (socket && isStreaming) {
      socket.emit('toggle_stream', { active: true, attack_ratio: newRatio });
    }
  };

  const handleClear = async () => {
    try {
      await clearIncidents();
      setLogs([]);
      setIncidents([]);
      await loadStats();
    } catch (err) {
      console.error(err);
    }
  };

  const bySeverity = stats?.by_severity || {};

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2>🛡️ Dashboard Simulation</h2>
            {isStreaming && (
              <span className="live-indicator">
                <span className="pulse-dot"></span> LIVE
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Real-time security monitoring & analysis stream
          </p>
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Attack%:</label>
            <select
              className="filter-select"
              value={attackRatio}
              onChange={handleAttackRatioChange}
            >
              <option value={0.1}>10%</option>
              <option value={0.2}>20%</option>
              <option value={0.3}>30%</option>
              <option value={0.5}>50%</option>
              <option value={0.7}>70%</option>
            </select>
          </div>
          <button 
            className={`btn ${isStreaming ? 'btn-danger' : 'btn-primary'}`} 
            onClick={toggleStream} 
            id="btn-toggle-stream"
          >
            {isStreaming ? '⏹️ Stop Stream' : '▶️ Start Live Stream'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleClear} id="btn-clear" disabled={isStreaming}>
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: 'var(--color-critical-bg)',
          border: '1px solid rgba(255,45,85,0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '20px',
          color: 'var(--color-critical)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid stagger-children">
        <div className="glass-card stat-card stat-total">
          <div className="stat-icon">📊</div>
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{stats.total_incidents}</div>
          <div className="stat-label">Total Incidents</div>
        </div>
        <div className="glass-card stat-card stat-critical">
          <div className="stat-icon">🔴</div>
          <div className="stat-value">{bySeverity.Critical || 0}</div>
          <div className="stat-label">Critical</div>
        </div>
        <div className="glass-card stat-card stat-high">
          <div className="stat-icon">🟠</div>
          <div className="stat-value">{bySeverity.High || 0}</div>
          <div className="stat-label">High Severity</div>
        </div>
        <div className="glass-card stat-card stat-recent">
          <div className="stat-icon">⏱️</div>
          <div className="stat-value">{stats.last_hour}</div>
          <div className="stat-label">Last Hour</div>
        </div>
      </div>

      {/* Charts */}
      <StatsCharts stats={stats} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        {[
          { id: 'analysis', label: '🧠 Analysis', icon: '' },
          { id: 'manual', label: '🔍 Investigate', icon: '' },
          { id: 'logs', label: '📋 Logs', icon: '' },
          { id: 'incidents', label: '📋 History', icon: '' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab.id)}
            id={`tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'analysis' && <AnalysisPanel incidents={incidents} loading={isStreaming && incidents.length === 0} socket={socket} />}
      {activeTab === 'manual' && <ManualLogInput />}
      {activeTab === 'logs' && <LogViewer logs={logs} />}
      {activeTab === 'incidents' && <IncidentTable incidents={incidents} />}
    </div>
  );
}
