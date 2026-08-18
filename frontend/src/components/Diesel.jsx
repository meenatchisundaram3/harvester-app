import React, { useState, useEffect } from 'react';
import { db, localDb } from '../db.js';
import { generateUUID, formatDate, formatCurrency, fileToBase64 } from '../utils.js';

export default function Diesel() {
  const [refills, setRefills] = useState([]);
  const [operators, setOperators] = useState([]);
  const [harvesters, setHarvesters] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Statistics
  const [metrics, setMetrics] = useState({
    monthlyLiters: 0,
    monthlyCost: 0,
    litersPerHour: 0,
    litersPerTon: 0
  });

  const [formData, setFormData] = useState({
    id: '',
    date: '',
    harvester_id: '',
    operator_id: '',
    fuel_station: '',
    liters: '',
    price_per_liter: '',
    total_cost: '',
    odometer: '',
    receipt_photo_url: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const listRefills = await db.diesel_refills.toArray();
    const listOps = await db.operators.filter(o => o.status === 'Active').toArray();
    const listHarvs = await db.harvesters.filter(h => h.status === 'Active').toArray();
    
    // Sort refills by date descending
    listRefills.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setRefills(listRefills);
    setOperators(listOps);
    setHarvesters(listHarvs);

    // Calculate metrics for the current month
    calculateFuelMetrics(listRefills);
  };

  const calculateFuelMetrics = async (refillList) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter refills for this month
    const thisMonthRefills = refillList.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalLiters = thisMonthRefills.reduce((sum, r) => sum + (parseFloat(r.liters) || 0), 0);
    const totalCost = thisMonthRefills.reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0);

    // Fetch this month's running hours
    const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const endStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const mHours = await db.running_hours
      .filter(h => h.date >= startStr && h.date <= endStr)
      .toArray();
    const totalHours = mHours.reduce((sum, h) => sum + (parseFloat(h.running_hours) || 0), 0);

    // Fetch this month's field work tons
    const mField = await db.field_work
      .filter(f => f.date >= startStr && f.date <= endStr)
      .toArray();
    const totalTons = mField.reduce((sum, f) => sum + (parseFloat(f.tons_harvested) || 0), 0);

    setMetrics({
      monthlyLiters: totalLiters,
      monthlyCost: totalCost,
      litersPerHour: totalHours > 0 ? parseFloat((totalLiters / totalHours).toFixed(2)) : 0,
      litersPerTon: totalTons > 0 ? parseFloat((totalLiters / totalTons).toFixed(2)) : 0
    });
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: generateUUID(),
      date: new Date().toISOString().split('T')[0],
      harvester_id: harvesters[0]?.id || '',
      operator_id: operators[0]?.id || '',
      fuel_station: '',
      liters: '',
      price_per_liter: '',
      total_cost: '',
      odometer: '',
      receipt_photo_url: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (refill) => {
    setIsEditing(true);
    setFormData({ ...refill });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this diesel refill entry?')) {
      await localDb.deleteDieselRefill(id);
      loadData();
    }
  };

  const handlePriceChange = (litersVal, priceVal) => {
    const lits = parseFloat(litersVal) || 0;
    const price = parseFloat(priceVal) || 0;
    setFormData({
      ...formData,
      liters: litersVal,
      price_per_liter: priceVal,
      total_cost: lits > 0 && price > 0 ? (lits * price).toFixed(2) : formData.total_cost
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setFormData({ ...formData, receipt_photo_url: base64 });
      } catch (err) {
        console.error(err);
        alert('Could not convert receipt photo.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.harvester_id || !formData.operator_id || !formData.liters || !formData.total_cost) {
      alert('Please fill out all required fields.');
      return;
    }

    const record = {
      ...formData,
      liters: parseFloat(formData.liters) || 0,
      price_per_liter: parseFloat(formData.price_per_liter) || 0,
      total_cost: parseFloat(formData.total_cost) || 0,
      odometer: parseFloat(formData.odometer) || 0
    };

    // Save refill log
    await localDb.saveDieselRefill(record);

    // Automatically record this under Expenses as category 'Diesel'!
    const expenseId = `exp-fuel-${record.id}`;
    const expenseRecord = {
      id: expenseId,
      date: record.date,
      category: 'Diesel',
      amount: record.total_cost,
      notes: `Diesel Refill (${record.liters}L) for harvester at ${record.fuel_station || 'Station'}`,
      ref_id: record.id
    };
    await localDb.saveExpense(expenseRecord);

    setShowModal(false);
    loadData();
  };

  return (
    <div className="diesel-view">
      {/* Metric Cards Banner */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ borderLeftColor: 'var(--accent)' }}>
          <div className="stat-header">
            <span className="stat-title">This Month's Fuel Used</span>
          </div>
          <div className="stat-value">{metrics.monthlyLiters} L</div>
          <div className="stat-footer">Total accumulated liters</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
          <div className="stat-header">
            <span className="stat-title">This Month's Cost</span>
          </div>
          <div className="stat-value text-success">{formatCurrency(metrics.monthlyCost)}</div>
          <div className="stat-footer">Total diesel expenses</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--primary)' }}>
          <div className="stat-header">
            <span className="stat-title">Fuel Consumption Rate</span>
          </div>
          <div className="stat-value">{metrics.litersPerHour} L/hr</div>
          <div className="stat-footer">Liters per running hour</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
          <div className="stat-header">
            <span className="stat-title">Harvest Efficiency</span>
          </div>
          <div className="stat-value">{metrics.litersPerTon} L/Ton</div>
          <div className="stat-footer">Liters per ton harvested</div>
        </div>
      </div>

      <div className="content-card">
        <div className="filters-panel" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Log Diesel Refill
          </button>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Harvester & Operator</th>
                <th>Station</th>
                <th>Volume (Liters)</th>
                <th>Rate (Per Liter)</th>
                <th>Total Cost</th>
                <th>Odometer</th>
                <th>Receipt</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {refills.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No diesel refills registered.
                  </td>
                </tr>
              ) : (
                refills.map(ref => {
                  const opName = operators.find(o => o.id === ref.operator_id)?.name || 'Unknown Operator';
                  const harvName = harvesters.find(h => h.id === ref.harvester_id)?.name || 'Harvester';
                  return (
                    <tr key={ref.id}>
                      <td style={{ fontWeight: '600' }}>{formatDate(ref.date)}</td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{harvName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Crew: {opName}</div>
                      </td>
                      <td>{ref.fuel_station || 'N/A'}</td>
                      <td style={{ fontWeight: '600' }}>{ref.liters} L</td>
                      <td>{formatCurrency(ref.price_per_liter)}</td>
                      <td style={{ fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(ref.total_cost)}</td>
                      <td>{ref.odometer ? `${ref.odometer} km` : 'N/A'}</td>
                      <td>
                        {ref.receipt_photo_url ? (
                          <a href={ref.receipt_photo_url} target="_blank" rel="noreferrer">
                            <img 
                              src={ref.receipt_photo_url} 
                              alt="Receipt" 
                              style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                            />
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No Photo</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-circle" onClick={() => handleOpenEdit(ref)} title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </button>
                          <button className="btn btn-danger btn-circle" onClick={() => handleDelete(ref.id)} title="Delete" style={{ backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}>
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
              <h3 className="modal-title">{isEditing ? 'Edit Refill Record' : 'Record Diesel Refill'}</h3>
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
                    <label className="form-label">Fuel Station</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. HP Refills"
                      value={formData.fuel_station}
                      onChange={(e) => setFormData({ ...formData, fuel_station: e.target.value })}
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
                    <label className="form-label">Liters Refilled *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.liters}
                      onChange={(e) => handlePriceChange(e.target.value, formData.price_per_liter)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price Per Liter (₹)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.price_per_liter}
                      onChange={(e) => handlePriceChange(formData.liters, e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Cost (₹) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.total_cost}
                      onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Odometer Reading (km)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={formData.odometer}
                      onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                    />
                  </div>

                  <div className="form-group form-group-full">
                    <label className="form-label">Receipt Picture</label>
                    <div className="photo-uploader">
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="fuel-receipt-capture" 
                        onChange={handlePhotoUpload} 
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="fuel-receipt-capture" style={{ cursor: 'pointer', display: 'block' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 0.5rem auto' }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <span>Click to Capture or Select Receipt Image</span>
                      </label>
                      {formData.receipt_photo_url && (
                        <div>
                          <img src={formData.receipt_photo_url} className="photo-preview" alt="Receipt Preview" />
                          <button type="button" className="btn btn-danger" onClick={() => setFormData({ ...formData, receipt_photo_url: '' })} style={{ display: 'block', margin: '0.5rem auto 0 auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                            Remove Image
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Refill</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
