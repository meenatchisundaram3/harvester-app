import React, { useState, useEffect } from 'react';
import { db, localDb } from '../db.js';
import { generateUUID, formatDate } from '../utils.js';

export default function RunningHours() {
  const [logs, setLogs] = useState([]);
  const [harvesters, setHarvesters] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [summaries, setSummaries] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0
  });

  const [formData, setFormData] = useState({
    id: '',
    date: '',
    harvester_id: '',
    start_time: '08:00',
    stop_time: '17:00',
    running_hours: 8,
    idle_hours: 1,
    breakdown_hours: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const listLogs = await db.running_hours.toArray();
    const listHarvs = await db.harvesters.filter(h => h.status === 'Active').toArray();
    
    listLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setLogs(listLogs);
    setHarvesters(listHarvs);

    calculateSummaries(listLogs);
  };

  const calculateSummaries = (allLogs) => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Weekly calculation
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekStr = oneWeekAgo.toISOString().split('T')[0];

    // Monthly calculation
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const monthStr = oneMonthAgo.toISOString().split('T')[0];

    const dailySum = allLogs
      .filter(l => l.date === todayStr)
      .reduce((sum, l) => sum + (parseFloat(l.running_hours) || 0), 0);

    const weeklySum = allLogs
      .filter(l => l.date >= weekStr)
      .reduce((sum, l) => sum + (parseFloat(l.running_hours) || 0), 0);

    const monthlySum = allLogs
      .filter(l => l.date >= monthStr)
      .reduce((sum, l) => sum + (parseFloat(l.running_hours) || 0), 0);

    setSummaries({
      daily: dailySum,
      weekly: weeklySum,
      monthly: monthlySum
    });
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: generateUUID(),
      date: new Date().toISOString().split('T')[0],
      harvester_id: harvesters[0]?.id || '',
      start_time: '08:00',
      stop_time: '17:00',
      running_hours: 8,
      idle_hours: 1,
      breakdown_hours: 0
    });
    setShowModal(true);
  };

  const handleOpenEdit = (log) => {
    setIsEditing(true);
    setFormData({ ...log });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this running hours log?')) {
      await localDb.deleteRunningHours(id);
      loadData();
    }
  };

  const calculateHoursDiff = (start, stop) => {
    if (start && stop) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = stop.split(':').map(Number);
      
      let diffMins = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMins < 0) diffMins += 24 * 60; // crossover midnight
      
      const totalHrs = parseFloat((diffMins / 60).toFixed(2));
      
      // Auto fill Running Hours = Total - Idle - Breakdown (if positive)
      const idle = parseFloat(formData.idle_hours) || 0;
      const breakdown = parseFloat(formData.breakdown_hours) || 0;
      const running = totalHrs - idle - breakdown;
      
      setFormData({
        ...formData,
        start_time: start,
        stop_time: stop,
        running_hours: running > 0 ? parseFloat(running.toFixed(2)) : 0
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.harvester_id || !formData.date || !formData.running_hours) {
      alert('Please fill out all required fields.');
      return;
    }

    const record = {
      ...formData,
      running_hours: parseFloat(formData.running_hours) || 0,
      idle_hours: parseFloat(formData.idle_hours) || 0,
      breakdown_hours: parseFloat(formData.breakdown_hours) || 0
    };

    await localDb.saveRunningHours(record);
    setShowModal(false);
    loadData();
  };

  return (
    <div className="runninghours-view">
      {/* Metric Cards Banner */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ borderLeftColor: 'var(--accent)' }}>
          <div className="stat-header">
            <span className="stat-title">Running Hours Today</span>
          </div>
          <div className="stat-value">{summaries.daily} hrs</div>
          <div className="stat-footer">Logged today</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--primary)' }}>
          <div className="stat-header">
            <span className="stat-title">Weekly Running Hours</span>
          </div>
          <div className="stat-value">{summaries.weekly} hrs</div>
          <div className="stat-footer">Past 7 days accumulated</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
          <div className="stat-header">
            <span className="stat-title">Monthly Running Hours</span>
          </div>
          <div className="stat-value">{summaries.monthly} hrs</div>
          <div className="stat-footer">Past 30 days accumulated</div>
        </div>
      </div>

      <div className="content-card">
        <div className="filters-panel" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Log Machine Hours
          </button>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Harvester Machine</th>
                <th>Work Schedule</th>
                <th>Running Hours</th>
                <th>Idle Hours</th>
                <th>Breakdown Hours</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No operations logs registered.
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const harvName = harvesters.find(h => h.id === log.harvester_id)?.name || 'Harvester';
                  return (
                    <tr key={log.id}>
                      <td style={{ fontWeight: '600' }}>{formatDate(log.date)}</td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{harvName}</div>
                      </td>
                      <td>
                        <div>Start: {log.start_time || 'N/A'}</div>
                        <div>Stop: {log.stop_time || 'N/A'}</div>
                      </td>
                      <td style={{ fontWeight: '700', color: 'var(--primary-light)' }}>{log.running_hours} hrs</td>
                      <td>{log.idle_hours} hrs</td>
                      <td style={{ color: log.breakdown_hours > 0 ? 'var(--danger)' : 'inherit', fontWeight: log.breakdown_hours > 0 ? '600' : 'normal' }}>
                        {log.breakdown_hours} hrs
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-circle" onClick={() => handleOpenEdit(log)} title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </button>
                          <button className="btn btn-danger btn-circle" onClick={() => handleDelete(log.id)} title="Delete" style={{ backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Edit Operating Hours' : 'Log Harvester Hours'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Harvester *</label>
                    <select 
                      className="form-control"
                      value={formData.harvester_id}
                      onChange={(e) => setFormData({ ...formData, harvester_id: e.target.value })}
                      required
                    >
                      <option value="">Select Harvester</option>
                      {harvesters.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input 
                      type="time" 
                      className="form-control" 
                      value={formData.start_time}
                      onChange={(e) => calculateHoursDiff(e.target.value, formData.stop_time)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stop Time</label>
                    <input 
                      type="time" 
                      className="form-control" 
                      value={formData.stop_time}
                      onChange={(e) => calculateHoursDiff(formData.start_time, e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Idle Hours</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="form-control" 
                      value={formData.idle_hours}
                      onChange={(e) => setFormData({ ...formData, idle_hours: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Breakdown Hours</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="form-control" 
                      value={formData.breakdown_hours}
                      onChange={(e) => setFormData({ ...formData, breakdown_hours: e.target.value })}
                    />
                  </div>
                  
                  <div className="form-group form-group-full">
                    <label className="form-label">Net Running Hours * (Calculated automatically from shift times)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="form-control" 
                      value={formData.running_hours}
                      onChange={(e) => setFormData({ ...formData, running_hours: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Log</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
