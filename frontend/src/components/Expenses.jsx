import React, { useState, useEffect } from 'react';
import { db, localDb } from '../db.js';
import { generateUUID, formatDate, formatCurrency } from '../utils.js';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const categories = ['Diesel', 'Repairs', 'Spare Parts', 'Engine Oil', 'Hydraulic Oil', 'Grease', 'Salary', 'Food', 'Transport', 'Other'];

  const [formData, setFormData] = useState({
    id: '',
    date: '',
    category: 'Diesel',
    amount: '',
    notes: '',
    ref_id: ''
  });

  const [categoryBreakdown, setCategoryBreakdown] = useState({});
  const [totalMonthCost, setTotalMonthCost] = useState(0);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    const list = await db.expenses.toArray();
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    setExpenses(list);
    calculateBreakdown(list);
  };

  const calculateBreakdown = (list) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter for current month
    const thisMonthExpenses = list.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const total = thisMonthExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    setTotalMonthCost(total);

    const breakdown = {};
    categories.forEach(cat => {
      breakdown[cat] = 0;
    });

    thisMonthExpenses.forEach(e => {
      if (breakdown[e.category] !== undefined) {
        breakdown[e.category] += (parseFloat(e.amount) || 0);
      } else {
        breakdown[e.category] = (parseFloat(e.amount) || 0);
      }
    });

    setCategoryBreakdown(breakdown);
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: generateUUID(),
      date: new Date().toISOString().split('T')[0],
      category: 'Diesel',
      amount: '',
      notes: '',
      ref_id: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (exp) => {
    setIsEditing(true);
    setFormData({ ...exp });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense record?')) {
      await localDb.deleteExpense(id);
      loadExpenses();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category || !formData.amount || !formData.date) {
      alert('Please fill out all required fields.');
      return;
    }

    const record = {
      ...formData,
      amount: parseFloat(formData.amount) || 0
    };

    await localDb.saveExpense(record);
    setShowModal(false);
    loadExpenses();
  };

  const filteredExpenses = expenses.filter(e => {
    return categoryFilter === 'All' || e.category === categoryFilter;
  });

  return (
    <div className="expenses-view">
      {/* Category Breakdown Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.5rem' }} className="charts-grid">
        <div className="stat-card" style={{ justifyContent: 'center', minHeight: '180px' }}>
          <span className="stat-title">This Month's Spending</span>
          <div className="stat-value text-danger" style={{ fontSize: '2.25rem', marginTop: '0.5rem' }}>
            {formatCurrency(totalMonthCost)}
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Accumulated expenses</span>
        </div>

        <div className="content-card" style={{ marginBottom: 0 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--primary-light)' }}>
            Category-wise Distribution (Current Month)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem 2rem' }}>
            {categories.map(cat => {
              const val = categoryBreakdown[cat] || 0;
              const percentage = totalMonthCost > 0 ? ((val / totalMonthCost) * 100).toFixed(0) : 0;
              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ fontWeight: '500' }}>{cat}</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(val)} ({percentage}%)</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${percentage}%`, height: '100%', background: cat === 'Diesel' ? 'var(--accent)' : 'var(--primary-light)', borderRadius: '3px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="content-card">
        {/* Filters and Actions */}
        <div className="filters-panel">
          <select 
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <button className="btn btn-primary" onClick={handleOpenAdd} style={{ marginLeft: 'auto' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Record Expense
          </button>
        </div>

        {/* Expenses List */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Notes / Details</th>
                <th>Amount Paid</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No expenses registered.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td style={{ fontWeight: '600' }}>{formatDate(exp.date)}</td>
                    <td>
                      <span className="badge badge-pending" style={{ textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {exp.notes || 'No description provided'}
                      {exp.ref_id && <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)' }}>Linked Log: {exp.ref_id.substring(0, 12)}</div>}
                    </td>
                    <td style={{ fontWeight: '700', color: 'var(--danger)', fontSize: '0.9375rem' }}>
                      {formatCurrency(exp.amount)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-circle" onClick={() => handleOpenEdit(exp)} title="Edit">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        </button>
                        <button className="btn btn-danger btn-circle" onClick={() => handleDelete(exp.id)} title="Delete" style={{ backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}>
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

      {/* Add / Edit Form Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Update Expense Log' : 'Record Business Expense'}</h3>
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
                    <label className="form-label">Category *</label>
                    <select 
                      className="form-control"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  
                  <div className="form-group form-group-full">
                    <label className="form-label">Amount Paid (₹) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="form-group form-group-full">
                    <label className="form-label">Notes</label>
                    <textarea 
                      className="form-control" 
                      rows="3"
                      placeholder="e.g. Engine belt replacement charges..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
