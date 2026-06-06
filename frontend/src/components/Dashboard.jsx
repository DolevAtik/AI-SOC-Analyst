import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import StatsCharts from './StatsCharts';
import LogViewer from './LogViewer';
import IncidentTable from './IncidentTable';
import AnalysisPanel from './AnalysisPanel';
import ManualLogInput from './ManualLogInput';
import { getStats, getIncidents, clearIncidents, getAuthToken } from '../api';
import { useToast } from './Toast';
import ScenarioPanel from './ScenarioPanel';

const SOCKET_SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ total_incidents: 0, last_hour: 0, by_severity: {}, by_type: {} });
  const [isStreaming, setIsStreaming] = useState(false);
  const [attackRatio, setAttackRatio] = useState(0.3);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [socket, setSocket] = useState(null);
  const toast = useToast();
  const notifiedIPs = useRef(new Set());
  const [currentScenario, setCurrentScenario] = useState('random');
  const [phaseInfo, setPhaseInfo] = useState(null);
  const [activeSeverity, setActiveSeverity] = useState(null);
  const [activeType, setActiveType] = useState(null);

  useEffect(() => {
    loadStats();
    loadIncidents();

    // Initialize Socket Connection
    const token = getAuthToken();
    const newSocket = io(SOCKET_SERVER_URL, token ? { query: { token } } : {});
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
        const newIncidents = data.incidents.map(i => ({ ...i, incident_detected: true }));

        // Fire toasts for Critical / High incidents (once per IP+type combo)
        newIncidents.forEach(inc => {
          const key = `${inc.source_ip}-${inc.threat_type}`;
          if ((inc.severity === 'Critical' || inc.severity === 'High') && !notifiedIPs.current.has(key)) {
            notifiedIPs.current.add(key);
            const type = inc.severity === 'Critical' ? 'critical' : 'high';
            toast?.(`${inc.threat_type} from ${inc.source_ip}`, type, 7000);
          }
        });

        setIncidents(prevIncidents => {
          return [...newIncidents, ...prevIncidents].slice(0, 100);
        });
      }
    });

    newSocket.on('stats_update', (data) => {
      if (data.stats) setStats(data.stats);
    });

    newSocket.on('scenario_update', (data) => {
      setCurrentScenario(data.scenario || 'random');
      if (data.phase_info) setPhaseInfo(data.phase_info);
    });

    newSocket.on('scenario_phase_update', (data) => {
      setPhaseInfo(data);
      if (data.next_phase_name) {
        toast?.(`Phase: ${data.next_phase_name}`, 'info', 5000);
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
          {currentScenario === 'random' && (
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
          )}
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

      {/* Scenario Panel */}
      <ScenarioPanel
        socket={socket}
        isStreaming={isStreaming}
        currentScenario={currentScenario}
        phaseInfo={phaseInfo}
        onScenarioChange={setCurrentScenario}
      />

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

      {/* Charts — interactive, click-to-filter */}
      <StatsCharts
        stats={stats}
        activeSeverity={activeSeverity}
        activeType={activeType}
        onSeverityClick={sev => { setActiveSeverity(sev); setActiveType(null); setActiveTab('analysis'); }}
        onTypeClick={type => { setActiveType(type); setActiveSeverity(null); setActiveTab('analysis'); }}
      />

      {/* Active filter chips */}
      {(activeSeverity || activeType) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Active filter:</span>
          {activeSeverity && (
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.3)',
              color: '#ff2d55', cursor: 'pointer',
            }} onClick={() => setActiveSeverity(null)}>
              {activeSeverity} ✕
            </span>
          )}
          {activeType && (
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)',
              color: 'var(--accent-cyan)', cursor: 'pointer',
            }} onClick={() => setActiveType(null)}>
              {activeType} ✕
            </span>
          )}
          <button onClick={() => { setActiveSeverity(null); setActiveType(null); }} style={{
            fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}>Clear all</button>
        </div>
      )}

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
      {activeTab === 'analysis' && <AnalysisPanel incidents={incidents} loading={isStreaming && incidents.length === 0} activeSeverity={activeSeverity} activeType={activeType} />}
      {activeTab === 'manual' && <ManualLogInput />}
      {activeTab === 'logs' && <LogViewer logs={logs} />}
      {activeTab === 'incidents' && <IncidentTable incidents={incidents} />}
    </div>
  );
}
