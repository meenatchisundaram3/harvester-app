import React, { useState, useEffect } from 'react';
import { db, localDb } from '../db.js';
import { generateUUID, formatDate, formatCurrency, fileToBase64 } from '../utils.js';

export default function FieldWork() {
  const [logs, setLogs] = useState([]);
  const [operators, setOperators] = useState([]);
  const [harvesters, setHarvesters] = useState([]);
  const [search, setSearch] = useState('');
  const [villageFilter, setVillageFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '',
    date: '',
    village: '',
    farmer_name: '',
    farmer_mobile: '',
    sugar_mill: '',
    work_order_number: '',
    harvester_id: '',
    operator_id: '',
    start_time: '08:00',
    end_time: '18:00',
    running_hours: 8,
    idle_hours: 1,
    breakdown_hours: 0,
    distance_travelled: 0,
    tons_harvested: 0,
    rate_per_ton: 350, // default rate for income calculations
    notes: '',
    photo_url: ''
  });

  useEffect(() => {
    loadData();
    preseedHarvestersIfEmpty();
  }, []);

  const preseedHarvestersIfEmpty = async () => {
    const list = await db.harvesters.toArray();
    const defaultFleet = [
      { id: 'TN32BF8500', name: 'Case IH Austoft 4010 Maxx (TN 32 BF 8500)', model: 'CASE IH AUSTOFT 4010 MAXX', serial_number: 'PNEY4010LR2EB0435', purchase_date: '2024-07-05', status: 'Active', updated_at: new Date().toISOString() },
      { id: 'TN32BF8451', name: 'New Holland 3630 TX Tractor (TN 32 BF 8451)', model: 'NH 3630 TX A1', serial_number: 'NHN36300ZRC686589', purchase_date: '2024-07-05', status: 'Active', updated_at: new Date().toISOString() },
      { id: 'TN32BF8438', name: 'New Holland 3630 TX Tractor (TN 32 BF 8438)', model: 'NH 3630 TX A1', serial_number: 'NHN36300ZRC686593', purchase_date: '2024-07-05', status: 'Active', updated_at: new Date().toISOString() }
    ];
    for (const veh of defaultFleet) {
      const exists = await db.harvesters.get(veh.id);
      if (!exists) {
        await db.harvesters.put(veh);
      }
    }
  };

  const loadData = async () => {
    const listLogs = await db.field_work.toArray();
    const listOps = await db.operators.filter(o => o.status === 'Active').toArray();
    const listHarvs = await db.harvesters.filter(h => h.status === 'Active').toArray();
    
    // Sort logs by date descending
    listLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setLogs(listLogs);
    setOperators(listOps);
    setHarvesters(listHarvs);
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: generateUUID(),
      date: new Date().toISOString().split('T')[0],
      village: '',
      farmer_name: '',
      farmer_mobile: '',
      sugar_mill: '',
      work_order_number: '',
      harvester_id: harvesters[0]?.id || '',
      operator_id: operators[0]?.id || '',
      start_time: '08:00',
      end_time: '18:00',
      running_hours: 8,
      idle_hours: 1,
      breakdown_hours: 0,
      distance_travelled: '',
      tons_harvested: '',
      rate_per_ton: 350,
      notes: '',
      photo_url: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (log) => {
    setIsEditing(true);
    setFormData({ 
      ...log,
      // For backwards compatibility or mapping rates
      rate_per_ton: log.rate_per_ton || 350 
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this field work entry?')) {
      await localDb.deleteFieldWork(id);
      const paymentId = `pay-${id}`;
      const exists = await db.payments.get(paymentId);
      if (exists) {
        await localDb.deletePayment(paymentId);
      }
      loadData();
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setFormData({ ...formData, photo_url: base64 });
      } catch (err) {
        console.error('Photo conversion failed:', err);
        alert('Could not process photo file.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.village || !formData.farmer_name || !formData.harvester_id || !formData.operator_id || !formData.tons_harvested) {
      alert('Please fill out all required fields.');
      return;
    }

    const tons = parseFloat(formData.tons_harvested) || 0;
    const rate = parseFloat(formData.rate_per_ton) || 350;
    const running = parseFloat(formData.running_hours) || 1;
    const calculatedIncome = tons * rate;

    const record = {
      ...formData,
      running_hours: parseFloat(formData.running_hours) || 0,
      idle_hours: parseFloat(formData.idle_hours) || 0,
      breakdown_hours: parseFloat(formData.breakdown_hours) || 0,
      distance_travelled: parseFloat(formData.distance_travelled) || 0,
      tons_harvested: tons,
      rate_per_ton: rate,
      income: calculatedIncome
    };

    // Calculate productivity locally to match generated column output format
    record.productivity = running > 0 ? parseFloat((tons / running).toFixed(2)) : 0;

    await localDb.saveFieldWork(record);
    
    // Also dynamically synchronize this transaction under Payments invoices!
    const paymentId = `pay-${record.id}`;
    const existingPayment = await db.payments.get(paymentId);
    const existingAdvance = existingPayment ? (parseFloat(existingPayment.advance) || 0) : 0;
    const newBalance = Math.max(0, calculatedIncome - existingAdvance);

    const paymentRecord = {
      id: paymentId,
      mill_name: record.sugar_mill || 'Private Sugar Mill',
      date: record.date,
      farmer: record.farmer_name,
      village: record.village,
      tons: record.tons_harvested,
      rate_per_ton: record.rate_per_ton,
      gross_amount: calculatedIncome,
      advance: existingAdvance,
      balance: newBalance,
      payment_date: existingPayment?.payment_date || '',
      payment_mode: existingPayment?.payment_mode || 'Bank Transfer / NEFT',
      reference_no: existingPayment?.reference_no || '',
      status: newBalance <= 0 && calculatedIncome > 0 ? 'Paid' : (existingAdvance > 0 ? 'Partial' : 'Pending')
    };
    await localDb.savePayment(paymentRecord);

    setShowModal(false);
    loadData();
  };

  // Get distinct villages for quick-select filtering
  const distinctVillages = [...new Set(logs.map(l => l.village))];

  const filteredLogs = logs.filter(log => {
    const matchSearch = log.village.toLowerCase().includes(search.toLowerCase()) ||
                        log.farmer_name.toLowerCase().includes(search.toLowerCase()) ||
                        log.sugar_mill.toLowerCase().includes(search.toLowerCase());
    const matchVillage = villageFilter === 'All' || log.village === villageFilter;
    return matchSearch && matchVillage;
  });

  return (
    <div className="fieldwork-view">
      <div className="content-card">
        {/* Actions panel */}
        <div className="filters-panel">
          <div className="search-input-wrapper">
            <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input 
              type="text" 
              placeholder="Search by farmer name, village, or sugar mill..." 
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select 
            className="filter-select"
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
          >
            <option value="All">All Villages</option>
            {distinctVillages.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Log Daily Field Work
          </button>
        </div>

        {/* Table Area */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date / Mill</th>
                <th>Location & Farmer</th>
                <th>Operator & Harvester</th>
                <th>Hours (Run/Idle/Break)</th>
                <th>Tons Harvested</th>
                <th>Productivity (Tons/Hr)</th>
                <th>Est. Income</th>
                <th>Photo</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No field work entries registered.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const opName = operators.find(o => o.id === log.operator_id)?.name || 'Unknown Operator';
                  const harvName = harvesters.find(h => h.id === log.harvester_id)?.name || 'Harvester';
                  return (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{formatDate(log.date)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mill: {log.sugar_mill}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{log.farmer_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Village: {log.village} | Mobile: {log.farmer_mobile || 'N/A'}</div>
                      </td>
                      <td>
                        <div>{opName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{harvName}</div>
                      </td>
                      <td>
                        <div>Run: {log.running_hours} hrs</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Idle: {log.idle_hours}h | Breakdown: {log.breakdown_hours}h</div>
                      </td>
                      <td style={{ fontWeight: '600' }}>{log.tons_harvested} Tons</td>
                      <td>
                        <span className="badge badge-success" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {(log.productivity || 0).toFixed(2)} t/h
                        </span>
                      </td>
                      <td style={{ fontWeight: '700', color: 'var(--success)' }}>
                        {formatCurrency(log.income)}
                      </td>
                      <td>
                        {log.photo_url ? (
                          <a href={log.photo_url} target="_blank" rel="noreferrer">
                            <img 
                              src={log.photo_url} 
                              alt="Log Receipt" 
                              style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                            />
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No Photo</span>
                        )}
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

      {/* Modal form */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Edit Field Work Record' : 'Log Daily Field Work'}</h3>
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
                    <label className="form-label">Village *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Melur"
                      value={formData.village}
                      onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Farmer Name *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.farmer_name}
                      onChange={(e) => setFormData({ ...formData, farmer_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Farmer Mobile</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      value={formData.farmer_mobile}
                      onChange={(e) => setFormData({ ...formData, farmer_mobile: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sugar Mill Name *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Sakthi Sugars"
                      value={formData.sugar_mill}
                      onChange={(e) => setFormData({ ...formData, sugar_mill: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Work Order Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.work_order_number}
                      onChange={(e) => setFormData({ ...formData, work_order_number: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Harvester Used *</label>
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
                    <label className="form-label">Operator *</label>
                    <select 
                      className="form-control"
                      value={formData.operator_id}
                      onChange={(e) => setFormData({ ...formData, operator_id: e.target.value })}
                      required
                    >
                      <option value="">Select Operator</option>
                      {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input 
                      type="time" 
                      className="form-control" 
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input 
                      type="time" 
                      className="form-control" 
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Running Hours *</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="form-control" 
                      value={formData.running_hours}
                      onChange={(e) => setFormData({ ...formData, running_hours: e.target.value })}
                      required
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
                  <div className="form-group">
                    <label className="form-label">Distance Travelled (km)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="form-control" 
                      value={formData.distance_travelled}
                      onChange={(e) => setFormData({ ...formData, distance_travelled: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Sugarcane Harvested (Tons) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.tons_harvested}
                      onChange={(e) => setFormData({ ...formData, tons_harvested: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate Per Ton (₹) *</label>
                    <input 
                      type="number" 
                      step="1"
                      className="form-control" 
                      value={formData.rate_per_ton}
                      onChange={(e) => setFormData({ ...formData, rate_per_ton: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group form-group-full">
                    <label className="form-label">Worksite Photo (Receipt / Delivery Slip)</label>
                    <div className="photo-uploader">
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="camera-capture" 
                        onChange={handlePhotoUpload} 
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="camera-capture" style={{ cursor: 'pointer', display: 'block' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 0.5rem auto' }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <span>Click to Capture or Select Worksite Image</span>
                      </label>
                      {formData.photo_url && (
                        <div>
                          <img src={formData.photo_url} className="photo-preview" alt="Field Preview" />
                          <button type="button" className="btn btn-danger" onClick={() => setFormData({ ...formData, photo_url: '' })} style={{ display: 'block', margin: '0.5rem auto 0 auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                            Remove Image
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group form-group-full">
                    <label className="form-label">Notes</label>
                    <textarea 
                      className="form-control" 
                      rows="2"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
