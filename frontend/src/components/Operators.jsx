import React, { useState, useEffect } from 'react';
import { db, localDb } from '../db.js';
import { generateUUID, formatDate, formatCurrency } from '../utils.js';

export default function Operators() {
  const [operators, setOperators] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    mobile: '',
    address: '',
    aadhaar: '',
    license: '',
    joining_date: '',
    salary_type: 'Monthly',
    salary_amount: '',
    status: 'Active'
  });

  useEffect(() => {
    loadOperators();
  }, []);

  const loadOperators = async () => {
    const list = await db.operators.toArray();
    setOperators(list);
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: generateUUID(),
      name: '',
      mobile: '',
      address: '',
      aadhaar: '',
      license: '',
      joining_date: new Date().toISOString().split('T')[0],
      salary_type: 'Monthly',
      salary_amount: '',
      status: 'Active'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (op) => {
    setIsEditing(true);
    setFormData({ ...op });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this operator? All associated logs will be preserved but links may be affected.')) {
      await localDb.deleteOperator(id);
      loadOperators();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile || !formData.salary_amount) {
      alert('Please fill out all required fields.');
      return;
    }
    
    const record = {
      ...formData,
      salary_amount: parseFloat(formData.salary_amount) || 0
    };

    await localDb.saveOperator(record);
    setShowModal(false);
    loadOperators();
  };

  const filteredOperators = operators.filter(op => {
    const matchSearch = op.name.toLowerCase().includes(search.toLowerCase()) || 
                        op.mobile.includes(search) || 
                        (op.aadhaar && op.aadhaar.includes(search));
    const matchStatus = statusFilter === 'All' || op.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="operators-view">
      <div className="content-card">
        {/* Filter / Actions Bar */}
        <div className="filters-panel">
          <div className="search-input-wrapper">
            <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input 
              type="text" 
              placeholder="Search by name, phone, or Aadhaar..." 
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <select 
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add Operator
          </button>
        </div>

        {/* Table Area */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Joining Date</th>
                <th>Salary Structure</th>
                <th>Aadhaar / License</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No operators found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredOperators.map(op => (
                  <tr key={op.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{op.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {op.address || 'No address provided'}
                      </div>
                    </td>
                    <td>
                      <div>{op.mobile}</div>
                    </td>
                    <td>{formatDate(op.joining_date)}</td>
                    <td>
                      <div style={{ fontWeight: '500' }}>{formatCurrency(op.salary_amount)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Per {op.salary_type === 'Per Ton' ? 'Tons Harvested' : op.salary_type === 'Daily' ? 'Day' : 'Month'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem' }}>Aadhaar: {op.aadhaar || 'N/A'}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>License: {op.license || 'N/A'}</div>
                    </td>
                    <td>
                      <span className={`badge ${op.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                        {op.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-circle" onClick={() => handleOpenEdit(op)} title="Edit">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        </button>
                        <button className="btn btn-danger btn-circle" onClick={() => handleDelete(op.id)} title="Delete" style={{ backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Edit Operator Details' : 'Add New Operator'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mobile Number *</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Aadhaar Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.aadhaar}
                      onChange={(e) => setFormData({ ...formData, aadhaar: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">License Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.license}
                      onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Joining Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={formData.joining_date}
                      onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select 
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Salary Type *</label>
                    <select 
                      className="form-control"
                      value={formData.salary_type}
                      onChange={(e) => setFormData({ ...formData, salary_type: e.target.value })}
                    >
                      <option value="Monthly">Monthly Salary</option>
                      <option value="Daily">Daily Wages</option>
                      <option value="Per Ton">Per Ton Harvested</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Salary Amount (₹) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.salary_amount}
                      onChange={(e) => setFormData({ ...formData, salary_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group form-group-full">
                    <label className="form-label">Address</label>
                    <textarea 
                      className="form-control" 
                      rows="2"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Details</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
