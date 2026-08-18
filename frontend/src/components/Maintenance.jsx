import React, { useState, useEffect } from 'react';
import { db, localDb } from '../db.js';
import { generateUUID, formatDate, formatCurrency } from '../utils.js';

export default function Maintenance() {
  const [schedules, setSchedules] = useState([]);
  const [harvesters, setHarvesters] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const serviceTypes = ['Engine Oil Change', 'Hydraulic Oil', 'Air Filter', 'Fuel Filter', 'Greasing', 'Battery Check', 'Insurance Expiry', 'RC Expiry'];

  const [formData, setFormData] = useState({
    id: '',
    harvester_id: '',
    date: '',
    service_type: 'Engine Oil Change',
    service_date: '',
    next_due_date: '',
    odometer: '',
    cost: '',
    notes: '',
    status: 'Pending'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const listSchedules = await db.maintenance.toArray();
    const listHarvs = await db.harvesters.filter(h => h.status === 'Active').toArray();
    
    // Sort schedules by next_due_date ascending (closest first)
    listSchedules.sort((a, b) => new Date(a.next_due_date) - new Date(b.next_due_date));
    
    setSchedules(listSchedules);
    setHarvesters(listHarvs);

    // Check for overdue items to trigger notifications
    checkAndCreateNotifications(listSchedules);
  };

  const checkAndCreateNotifications = async (list) => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    for (const item of list) {
      if (item.status === 'Pending' && item.next_due_date <= todayStr) {
        // Overdue! Verify if notification already exists
        const exists = await db.notifications
          .filter(n => n.title.includes(item.service_type) && n.message.includes(item.next_due_date))
          .toArray();

        if (exists.length === 0) {
          const harvesterName = harvesters.find(h => h.id === item.harvester_id)?.name || 'Harvester';
          const notificationRecord = {
            id: generateUUID(),
            type: 'Maintenance',
            title: `OVERDUE: ${item.service_type}`,
            message: `${harvesterName} requires ${item.service_type}. Was scheduled for ${formatDate(item.next_due_date)}.`,
            date: todayStr,
            is_read: 0,
            updated_at: new Date().toISOString()
          };
          await localDb.saveNotification(notificationRecord);
        }
      }
    }
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: generateUUID(),
      harvester_id: harvesters[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      service_type: 'Engine Oil Change',
      service_date: new Date().toISOString().split('T')[0],
      next_due_date: '',
      odometer: '',
      cost: '',
      notes: '',
      status: 'Pending'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (m) => {
    setIsEditing(true);
    setFormData({ ...m });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this maintenance schedule?')) {
      await localDb.deleteMaintenance(id);
      loadData();
    }
  };

  const handleServiceTypeChange = (type) => {
    const serviceDate = formData.service_date || new Date().toISOString().split('T')[0];
    const sDate = new Date(serviceDate);
    let nextDateStr = '';

    // Automatically calculate default intervals based on service type
    if (type === 'Engine Oil Change' || type === 'Fuel Filter') {
      sDate.setMonth(sDate.getMonth() + 6); // 6 months standard interval
      nextDateStr = sDate.toISOString().split('T')[0];
    } else if (type === 'Hydraulic Oil') {
      sDate.setMonth(sDate.getMonth() + 12); // 1 year standard
      nextDateStr = sDate.toISOString().split('T')[0];
    } else if (type === 'Air Filter' || type === 'Greasing') {
      sDate.setMonth(sDate.getMonth() + 2); // 2 months
      nextDateStr = sDate.toISOString().split('T')[0];
    } else if (type === 'Insurance Expiry' || type === 'RC Expiry') {
      sDate.setFullYear(sDate.getFullYear() + 1); // 1 year paperwork validity
      nextDateStr = sDate.toISOString().split('T')[0];
    }

    setFormData({
      ...formData,
      service_type: type,
      next_due_date: nextDateStr
    });
  };

  const markCompleted = async (item) => {
    const costStr = window.prompt(`Enter service charges / billing cost (₹) for ${item.service_type}:`, '0');
    if (costStr === null) return; // user cancelled

    const serviceCost = parseFloat(costStr) || 0;
    const todayStr = new Date().toISOString().split('T')[0];

    const updatedItem = {
      ...item,
      cost: serviceCost,
      status: 'Completed',
      service_date: todayStr
    };

    await localDb.saveMaintenance(updatedItem);

    // Save as Expense under Category Repairs or Other
    const expenseCategory = item.service_type.includes('Expiry') ? 'Other' : 'Repairs';
    const expenseRecord = {
      id: generateUUID(),
      date: todayStr,
      category: expenseCategory,
      amount: serviceCost,
      notes: `Completed Service: ${item.service_type} for machine. Notes: ${item.notes || 'None'}`,
      ref_id: item.id
    };
    await localDb.saveExpense(expenseRecord);

    alert(`Service marked completed and expenses logged successfully!`);
    loadData();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.harvester_id || !formData.service_type || !formData.next_due_date) {
      alert('Please fill out all required fields.');
      return;
    }

    const record = {
      ...formData,
      cost: parseFloat(formData.cost) || 0,
      odometer: parseFloat(formData.odometer) || 0
    };

    await localDb.saveMaintenance(record);
    setShowModal(false);
    loadData();
  };

  return (
    <div className="maintenance-view">
      <div className="content-card">
        {/* Actions header */}
        <div className="filters-panel" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Schedule Maintenance
          </button>
        </div>

        {/* Schedule Grid */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Machine</th>
                <th>Service Action</th>
                <th>Last Service Date</th>
                <th>Next Due Date</th>
                <th>Odometer</th>
                <th>Estimated Cost</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No maintenance schedules logged.
                  </td>
                </tr>
              ) : (
                schedules.map(item => {
                  const harvName = harvesters.find(h => h.id === item.harvester_id)?.name || 'Harvester';
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isOverdue = item.status === 'Pending' && item.next_due_date <= todayStr;
                  return (
                    <tr key={item.id} style={{ backgroundColor: isOverdue ? 'rgba(229, 62, 98, 0.03)' : 'inherit' }}>
                      <td style={{ fontWeight: '600' }}>{harvName}</td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{item.service_type}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px' }}>{item.notes || 'No description'}</div>
                      </td>
                      <td>{formatDate(item.service_date)}</td>
                      <td style={{ fontWeight: '700', color: isOverdue ? 'var(--danger)' : 'var(--primary-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {formatDate(item.next_due_date)}
                          {isOverdue && <span style={{ fontSize: '0.625rem', backgroundColor: 'var(--danger)', color: '#fff', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>Overdue</span>}
                        </div>
                      </td>
                      <td>{item.odometer ? `${item.odometer} km` : 'N/A'}</td>
                      <td style={{ fontWeight: '600' }}>{item.cost ? formatCurrency(item.cost) : 'N/A'}</td>
                      <td>
                        <span className={`badge ${item.status === 'Completed' ? 'badge-success' : 'badge-pending'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          {item.status === 'Pending' && (
                            <button className="btn btn-primary" onClick={() => markCompleted(item)} style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }}>
                              Done
                            </button>
                          )}
                          <button className="btn btn-secondary btn-circle" onClick={() => handleOpenEdit(item)} title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </button>
                          <button className="btn btn-danger btn-circle" onClick={() => handleDelete(item.id)} title="Delete" style={{ backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}>
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

      {/* Form Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Edit Maintenance Task' : 'Schedule Machine Maintenance'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Harvester Machine *</label>
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
                    <label className="form-label">Service Type *</label>
                    <select 
                      className="form-control"
                      value={formData.service_type}
                      onChange={(e) => handleServiceTypeChange(e.target.value)}
                      required
                    >
                      {serviceTypes.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Service Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={formData.service_date}
                      onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next Due Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={formData.next_due_date}
                      onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Odometer (km)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={formData.odometer}
                      onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost (₹)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select 
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  
                  <div className="form-group form-group-full">
                    <label className="form-label">Service Notes</label>
                    <textarea 
                      className="form-control" 
                      rows="3"
                      placeholder="Specify spare parts replaced or reasons for maintenance..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
