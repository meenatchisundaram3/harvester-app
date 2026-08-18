import React, { useState, useEffect } from 'react';
import { triggerSync } from './sync.js';
import Dashboard from './components/Dashboard.jsx';
import Operators from './components/Operators.jsx';
import Attendance from './components/Attendance.jsx';
import FieldWork from './components/FieldWork.jsx';
import Diesel from './components/Diesel.jsx';
import RunningHours from './components/RunningHours.jsx';
import Payments from './components/Payments.jsx';
import Expenses from './components/Expenses.jsx';
import Maintenance from './components/Maintenance.jsx';
import Reports from './components/Reports.jsx';
import QuickAdd from './components/QuickAdd.jsx';

export default function App() {
  const API_BASE = '';

  // App navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  // Network and Sync statuses
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'offline' | 'error'
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    // Theme setup
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  useEffect(() => {
    // Ensure default token exists
    localStorage.setItem('harvester_owner_token', 'direct-owner-token');

    // Auto sync on start
    triggerSync();

    // Listeners for network status
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('syncing');
      setSyncMsg('Restoring network. Syncing logs...');
      triggerSync().then(res => {
        if (res.success) {
          setSyncStatus('synced');
          setSyncMsg('Data synchronized.');
        } else {
          setSyncStatus('error');
          setSyncMsg('Sync error: ' + (res.message || 'Server error'));
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
      setSyncMsg('Working offline. Changes are saved locally.');
    };

    const handleSyncComplete = (e) => {
      if (e.detail.status === 'success') {
        setSyncStatus('synced');
        setSyncMsg('Data synchronized.');
      } else {
        setSyncStatus('error');
        setSyncMsg('Sync failed: ' + e.detail.error);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-completed', handleSyncComplete);

    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-completed', handleSyncComplete);
    };
  }, []);

  const toggleDarkMode = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    localStorage.setItem('theme', nextMode ? 'dark' : 'light');
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'operators': return <Operators />;
      case 'attendance': return <Attendance />;
      case 'fieldwork': return <FieldWork />;
      case 'diesel': return <Diesel />;
      case 'runninghours': return <RunningHours />;
      case 'payments': return <Payments />;
      case 'expenses': return <Expenses />;
      case 'maintenance': return <Maintenance />;
      case 'reports': return <Reports />;
      default: return <Dashboard />;
    }
  };

  const forceSync = () => {
    setSyncStatus('syncing');
    setSyncMsg('Syncing database...');
    triggerSync().then(res => {
      if (res.success) {
        setSyncStatus('synced');
        setSyncMsg('Data synchronized.');
        setActiveTab(prev => prev);
      } else {
        setSyncStatus('error');
        setSyncMsg('Sync failed: ' + (res.message || 'Server error'));
      }
    });
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="logo-container">
          <div className="logo-img">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
              <circle cx="12" cy="12" r="11" fill="#40916c" />
              <path d="M12 4 C15 7, 18 12, 17 18 C15 17, 13 14, 12 11 C11 14, 9 17, 7 18 C6 12, 9 7, 12 4 Z" fill="#d8f3dc" />
            </svg>
          </div>
          <span className="logo-text">Harvester Owner</span>
        </div>

        <ul className="nav-links">
          <li>
            <a className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}>
              <svg className="nav-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Dashboard
            </a>
          </li>
          <li>
            <a className={`nav-item ${activeTab === 'operators' ? 'active' : ''}`} onClick={() => { setActiveTab('operators'); setIsMobileMenuOpen(false); }}>
              <svg className="nav-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Operators
            </a>
          </li>
          <li>
            <a className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => { setActiveTab('attendance'); setIsMobileMenuOpen(false); }}>
              <svg className="nav-icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Attendance
            </a>
          </li>
          <li>
            <a className={`nav-item ${activeTab === 'fieldwork' ? 'active' : ''}`} onClick={() => { setActiveTab('fieldwork'); setIsMobileMenuOpen(false); }}>
              <svg className="nav-icon" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              Daily Field Work
            </a>
          </li>
          <li>
            <a className={`nav-item ${activeTab === 'diesel' ? 'active' : ''}`} onClick={() => { setActiveTab('diesel'); setIsMobileMenuOpen(false); }}>
              <svg className="nav-icon" viewBox="0 0 24 24"><path d="M3 2v20M21 21v-4a4 4 0 0 0-3-3.87M16 2v4M6 14h10M6 18h10M6 10h10" /></svg>
              Diesel Refills
            </a>
          </li>
          <li>
            <a className={`nav-item ${activeTab === 'runninghours' ? 'active' : ''}`} onClick={() => { setActiveTab('runninghours'); setIsMobileMenuOpen(false); }}>
              <svg className="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Running Hours
            </a>
          </li>
          <li>
            <a className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => { setActiveTab('payments'); setIsMobileMenuOpen(false); }}>
              <svg className="nav-icon" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8c3 0 5-1.5 5-3H7c0 1.5 2 3 5 3z"/></svg>
              Sugar Mill Payments
            </a>
          </li>
          <li>
            <a className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => { setActiveTab('expenses'); setIsMobileMenuOpen(false); }}>
              <svg className="nav-icon" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Expenses
            </a>
          </li>
          <li>
            <a className={`nav-item ${activeTab === 'maintenance' ? 'active' : ''}`} onClick={() => { setActiveTab('maintenance'); setIsMobileMenuOpen(false); }}>
              <svg className="nav-icon" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              Maintenance
            </a>
          </li>
          <li>
            <a className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}>
              <svg className="nav-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Reports
            </a>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">O</div>
            <div className="user-details">
              <span className="user-name">Owner</span>
              <span className="user-role">Single-Owner Private App</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        {/* Sync Status Banner */}
        {syncStatus !== 'synced' && (
          <div className={`sync-banner ${syncStatus === 'offline' ? 'offline' : syncStatus === 'error' ? 'error' : ''}`}>
            {syncStatus === 'syncing' && <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />}
            <span>{syncMsg}</span>
          </div>
        )}

        {/* Header Bar */}
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div className="page-title-container">
              <h2 className="page-title" style={{ textTransform: 'capitalize' }}>
                {activeTab === 'fieldwork' ? 'Daily Field Work' : activeTab === 'runninghours' ? 'Machine Hours' : activeTab === 'payments' ? 'Mill Payments' : activeTab}
              </h2>
              <span className="page-subtitle">Sugarcane Harvester Management System</span>
            </div>
          </div>

          <div className="header-actions">
            {isOnline && (
              <button className="btn btn-secondary btn-circle" onClick={forceSync} title="Force Sync Database">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              </button>
            )}

            <button className="btn btn-secondary btn-circle" onClick={toggleDarkMode} title="Toggle Color Theme">
              {darkMode ? (
                /* Sun icon */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              ) : (
                /* Moon icon */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
          </div>
        </header>

        {/* Dynamic content rendering */}
        {renderActiveTab()}

        {/* Floating action Quick Add button */}
        <QuickAdd onSaveSuccess={() => {
          const currentTab = activeTab;
          setActiveTab('');
          setTimeout(() => setActiveTab(currentTab), 10);
        }} />
      </main>

      {/* Embedded pulses animations */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
