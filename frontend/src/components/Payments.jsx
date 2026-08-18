import React, { useState, useEffect } from 'react';
import { db, localDb } from '../db.js';
import { generateUUID, formatDate, formatCurrency } from '../utils.js';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [formData, setFormData] = useState({
    id: '',
    mill_name: '',
    date: '',
    farmer: '',
    village: '',
    tons: '',
    rate_per_ton: 350,
    gross_amount: '',
    advance: 0,
    balance: '',
    payment_date: '',
    status: 'Pending'
  });

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    const list = await db.payments.toArray();
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    setPayments(list);
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: generateUUID(),
      mill_name: '',
      date: new Date().toISOString().split('T')[0],
      farmer: '',
      village: '',
      tons: '',
      rate_per_ton: 350,
      gross_amount: '',
      advance: 0,
      balance: '',
      payment_date: '',
      status: 'Pending'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p) => {
    setIsEditing(true);
    setFormData({ ...p });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this payment log?')) {
      await localDb.deletePayment(id);
      loadPayments();
    }
  };

  const handleCalculation = (tonsVal, rateVal, advanceVal) => {
    const tons = parseFloat(tonsVal) || 0;
    const rate = parseFloat(rateVal) || 0;
    const advance = parseFloat(advanceVal) || 0;
    
    const gross = parseFloat((tons * rate).toFixed(2));
    const bal = parseFloat((gross - advance).toFixed(2));
    
    let status = 'Pending';
    if (advance > 0 && bal > 0) status = 'Partial';
    if (bal <= 0) status = 'Paid';

    setFormData({
      ...formData,
      tons: tonsVal,
      rate_per_ton: rateVal,
      advance: advanceVal,
      gross_amount: gross,
      balance: bal,
      status
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.mill_name || !formData.farmer || !formData.tons || !formData.gross_amount) {
      alert('Please fill out all required fields.');
      return;
    }

    const record = {
      ...formData,
      tons: parseFloat(formData.tons) || 0,
      rate_per_ton: parseFloat(formData.rate_per_ton) || 0,
      gross_amount: parseFloat(formData.gross_amount) || 0,
      advance: parseFloat(formData.advance) || 0,
      balance: parseFloat(formData.balance) || 0
    };

    if (record.status === 'Paid' && !record.payment_date) {
      record.payment_date = new Date().toISOString().split('T')[0];
    }

    await localDb.savePayment(record);
    setShowModal(false);
    loadPayments();
  };

  const openInvoice = (payment) => {
    setSelectedInvoice(payment);
    setShowInvoiceModal(true);
  };

  const printInvoice = () => {
    window.print();
  };

  const filteredPayments = payments.filter(p => {
    const matchSearch = p.mill_name.toLowerCase().includes(search.toLowerCase()) ||
                        p.farmer.toLowerCase().includes(search.toLowerCase()) ||
                        (p.village && p.village.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="payments-view">
      <div className="content-card">
        {/* Filters and Actions */}
        <div className="filters-panel">
          <div className="search-input-wrapper">
            <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input 
              type="text" 
              placeholder="Search by mill, farmer, or village..." 
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
            <option value="All">All Invoices</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial Paid</option>
            <option value="Paid">Fully Paid</option>
          </select>

          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            New Mill Invoice
          </button>
        </div>

        {/* Invoices List */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date / Mill Name</th>
                <th>Farmer & Village</th>
                <th>Tons Logged</th>
                <th>Gross Amount</th>
                <th>Advance Paid</th>
                <th>Outstanding Balance</th>
                <th>Payment Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No payment invoices registered.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{formatDate(p.date)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.mill_name}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{p.farmer}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Village: {p.village || 'N/A'}</div>
                    </td>
                    <td>{p.tons} Tons</td>
                    <td style={{ fontWeight: '600' }}>{formatCurrency(p.gross_amount)}</td>
                    <td style={{ color: 'var(--primary-light)' }}>{formatCurrency(p.advance)}</td>
                    <td style={{ fontWeight: '700', color: p.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      {formatCurrency(p.balance)}
                    </td>
                    <td>{p.payment_date ? formatDate(p.payment_date) : 'N/A'}</td>
                    <td>
                      <span className={`badge ${p.status === 'Paid' ? 'badge-success' : p.status === 'Partial' ? 'badge-warning' : 'badge-pending'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-circle" onClick={() => openInvoice(p)} title="View Bill/Invoice">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                        </button>
                        <button className="btn btn-secondary btn-circle" onClick={() => handleOpenEdit(p)} title="Edit Record">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        </button>
                        <button className="btn btn-danger btn-circle" onClick={() => handleDelete(p.id)} title="Delete Record" style={{ backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}>
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
              <h3 className="modal-title">{isEditing ? 'Update Mill Payment' : 'New Sugar Mill Invoice'}</h3>
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
                    <label className="form-label">Sugar Mill Name *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Sakthi Sugar Mills"
                      value={formData.mill_name}
                      onChange={(e) => setFormData({ ...formData, mill_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Farmer Name *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.farmer}
                      onChange={(e) => setFormData({ ...formData, farmer: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Village</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.village}
                      onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Sugarcane Harvested (Tons) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.tons}
                      onChange={(e) => handleCalculation(e.target.value, formData.rate_per_ton, formData.advance)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate Per Ton (₹) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.rate_per_ton}
                      onChange={(e) => handleCalculation(formData.tons, e.target.value, formData.advance)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Gross Billing Amount (₹) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.gross_amount}
                      onChange={(e) => setFormData({ ...formData, gross_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Advance Paid (₹)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.advance}
                      onChange={(e) => handleCalculation(formData.tons, formData.rate_per_ton, e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Outstanding Balance (₹)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Invoice Status</label>
                    <select 
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Partial">Partial Paid</option>
                      <option value="Paid">Fully Paid</option>
                    </select>
                  </div>
                  
                  <div className="form-group form-group-full">
                    <label className="form-label">Payment Settled Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={formData.payment_date}
                      onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="modal-overlay print-modal-overlay">
          <div className="modal-content print-invoice-card" style={{ maxWidth: '650px', background: '#fff', color: '#1a1a1a' }}>
            <div className="modal-header no-print">
              <h3 className="modal-title">Billing Invoice</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={printInvoice}>Print Invoice</button>
                <button className="modal-close" onClick={() => setShowInvoiceModal(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            
            <div className="modal-body print-area" style={{ padding: '2rem' }}>
              {/* Invoice Layout */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2d6a4f', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ color: '#1b4332', fontSize: '1.5rem', fontWeight: '800' }}>HARVESTER OWNER</h2>
                  <p style={{ fontSize: '0.8125rem', color: '#555' }}>Sugarcane Harvesting Service Provider</p>
                  <p style={{ fontSize: '0.8125rem', color: '#555' }}>Tamil Nadu, India</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#555' }}>INVOICE</h3>
                  <p style={{ fontSize: '0.875rem' }}><strong>Invoice #:</strong> INV-{selectedInvoice.id.substring(0, 8).toUpperCase()}</p>
                  <p style={{ fontSize: '0.875rem' }}><strong>Date:</strong> {formatDate(selectedInvoice.date)}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <h4 style={{ color: '#2d6a4f', borderBottom: '1px solid #ddd', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>BILLED TO:</h4>
                  <p style={{ fontSize: '0.9375rem', fontWeight: '600' }}>{selectedInvoice.mill_name}</p>
                  <p style={{ fontSize: '0.875rem', color: '#555' }}>Village: {selectedInvoice.village || 'N/A'}</p>
                </div>
                <div>
                  <h4 style={{ color: '#2d6a4f', borderBottom: '1px solid #ddd', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>HARVEST DETAILS:</h4>
                  <p style={{ fontSize: '0.9375rem' }}><strong>Farmer:</strong> {selectedInvoice.farmer}</p>
                  <p style={{ fontSize: '0.875rem', color: '#555' }}>Village: {selectedInvoice.village || 'N/A'}</p>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ background: '#f4f9f6', borderBottom: '1px solid #ccc' }}>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.875rem' }}>Description</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.875rem' }}>Quantity</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.875rem' }}>Rate</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.875rem' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      Sugarcane Harvesting Service charges for farmer <strong>{selectedInvoice.farmer}</strong>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem' }}>{selectedInvoice.tons} Tons</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem' }}>{formatCurrency(selectedInvoice.rate_per_ton)}/t</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600' }}>{formatCurrency(selectedInvoice.gross_amount)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Totals Box */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span>Gross Amount:</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(selectedInvoice.gross_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#1b4332' }}>
                    <span>Advance Received:</span>
                    <span style={{ fontWeight: '600' }}>- {formatCurrency(selectedInvoice.advance)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', borderTop: '1px solid #ccc', paddingTop: '0.5rem', color: '#c53030' }}>
                    <span>Total Due:</span>
                    <span>{formatCurrency(selectedInvoice.balance)}</span>
                  </div>
                </div>
              </div>

              {/* Status and Signature */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '3rem' }}>
                <div>
                  <p style={{ fontSize: '0.8125rem' }}><strong>Payment Status:</strong> {selectedInvoice.status.toUpperCase()}</p>
                  {selectedInvoice.payment_date && <p style={{ fontSize: '0.8125rem', color: '#555' }}>Settled on: {formatDate(selectedInvoice.payment_date)}</p>}
                </div>
                <div style={{ textAlign: 'center', borderTop: '1px solid #ccc', width: '150px', paddingTop: '0.25rem', fontSize: '0.8125rem' }}>
                  Authorized Signatory
                </div>
              </div>
            </div>
            
            <div className="modal-footer no-print">
              <button type="button" className="btn btn-secondary" onClick={() => setShowInvoiceModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Styles for printing invoices */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            background: #fff !important;
            color: #000 !important;
          }
          .print-modal-overlay {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: none !important;
            backdrop-filter: none !important;
            display: block !important;
          }
          .print-invoice-card {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
