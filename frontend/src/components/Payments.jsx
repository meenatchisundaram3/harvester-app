import React, { useState, useEffect } from 'react';
import { db, localDb } from '../db.js';
import { generateUUID, formatDate, formatCurrency } from '../utils.js';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [millFilter, setMillFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [settlingInvoice, setSettlingInvoice] = useState(null);

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
    payment_mode: 'Bank Transfer / NEFT',
    reference_no: '',
    status: 'Pending'
  });

  const [settleData, setSettleData] = useState({
    amount: '',
    date: '',
    payment_mode: 'Bank Transfer / NEFT',
    reference_no: '',
    notes: ''
  });

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    const list = await db.payments.toArray();
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    setPayments(list);
  };

  // Distinct list of sugar mills for filtering
  const distinctMills = [...new Set(payments.map(p => p.mill_name).filter(Boolean))];

  // Financial KPI totals (Amount Basis)
  const totalBilled = payments.reduce((sum, p) => sum + (parseFloat(p.gross_amount) || 0), 0);
  const totalSettled = payments.reduce((sum, p) => sum + (parseFloat(p.advance) || 0), 0);
  const totalOutstanding = payments.reduce((sum, p) => sum + (parseFloat(p.balance) || 0), 0);
  const settledCount = payments.filter(p => p.status === 'Paid').length;
  const settlementRate = totalBilled > 0 ? ((totalSettled / totalBilled) * 100).toFixed(1) : 0;

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
      payment_mode: 'Bank Transfer / NEFT',
      reference_no: '',
      status: 'Pending'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p) => {
    setIsEditing(true);
    setFormData({
      ...p,
      payment_mode: p.payment_mode || 'Bank Transfer / NEFT',
      reference_no: p.reference_no || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this mill payment log?')) {
      await localDb.deletePayment(id);
      loadPayments();
    }
  };

  // Calculation when Tons or Rate are modified
  const handleTonsOrRateChange = (tonsVal, rateVal, advanceVal) => {
    const tons = parseFloat(tonsVal) || 0;
    const rate = parseFloat(rateVal) || 0;
    const advance = parseFloat(advanceVal) || 0;
    
    const gross = tons > 0 && rate > 0 ? parseFloat((tons * rate).toFixed(2)) : (parseFloat(formData.gross_amount) || 0);
    const bal = parseFloat((gross - advance).toFixed(2));
    
    let status = 'Pending';
    if (advance > 0 && bal > 0) status = 'Partial';
    if (gross > 0 && bal <= 0) status = 'Paid';

    setFormData(prev => ({
      ...prev,
      tons: tonsVal,
      rate_per_ton: rateVal,
      advance: advanceVal,
      gross_amount: gross > 0 ? gross : prev.gross_amount,
      balance: bal,
      status
    }));
  };

  // Direct Amount-based editing (Gross Amount or Settled Amount changed)
  const handleAmountChange = (grossVal, advanceVal) => {
    const gross = parseFloat(grossVal) || 0;
    const advance = parseFloat(advanceVal) || 0;
    const bal = parseFloat((gross - advance).toFixed(2));

    let status = 'Pending';
    if (advance > 0 && bal > 0) status = 'Partial';
    if (gross > 0 && bal <= 0) status = 'Paid';

    setFormData(prev => ({
      ...prev,
      gross_amount: grossVal,
      advance: advanceVal,
      balance: bal,
      status
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.mill_name || !formData.farmer || !formData.gross_amount) {
      alert('Please fill out Sugar Mill Name, Farmer Name, and Gross Billing Amount.');
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

  // Open Quick Settle Modal
  const openSettleModal = (payment) => {
    setSettlingInvoice(payment);
    const remainingBalance = Math.max(0, parseFloat(payment.balance) || (parseFloat(payment.gross_amount) - (parseFloat(payment.advance) || 0)));
    setSettleData({
      amount: remainingBalance > 0 ? remainingBalance : '',
      date: new Date().toISOString().split('T')[0],
      payment_mode: 'Bank Transfer / NEFT',
      reference_no: '',
      notes: ''
    });
    setShowSettleModal(true);
  };

  // Submit Settlement Amount
  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!settlingInvoice || !settleData.amount) return;

    const settlingAmount = parseFloat(settleData.amount) || 0;
    if (settlingAmount <= 0) {
      alert('Please enter a valid settlement amount.');
      return;
    }

    const currentGross = parseFloat(settlingInvoice.gross_amount) || 0;
    const previousSettled = parseFloat(settlingInvoice.advance) || 0;
    const newTotalSettled = parseFloat((previousSettled + settlingAmount).toFixed(2));
    const newBalance = parseFloat(Math.max(0, currentGross - newTotalSettled).toFixed(2));

    const updatedRecord = {
      ...settlingInvoice,
      advance: newTotalSettled,
      balance: newBalance,
      status: newBalance <= 0 ? 'Paid' : 'Partial',
      payment_date: settleData.date || new Date().toISOString().split('T')[0],
      payment_mode: settleData.payment_mode,
      reference_no: settleData.reference_no || settlingInvoice.reference_no,
      updated_at: new Date().toISOString()
    };

    await localDb.savePayment(updatedRecord);
    setShowSettleModal(false);
    setSettlingInvoice(null);
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
                        (p.village && p.village.toLowerCase().includes(search.toLowerCase())) ||
                        (p.reference_no && p.reference_no.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchMill = millFilter === 'All' || p.mill_name === millFilter;
    return matchSearch && matchStatus && matchMill;
  });

  return (
    <div className="payments-view">
      {/* Mill Settlement Financial KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Total Billed Amount</span>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(45, 106, 79, 0.1)', color: 'var(--primary)' }}>
              <span style={{ fontWeight: 'bold' }}>₹</span>
            </div>
          </div>
          <div className="stat-value">{formatCurrency(totalBilled)}</div>
          <div className="stat-footer">Gross invoices to sugar mills</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'var(--success)' }}>
          <div className="stat-header">
            <span className="stat-title">Total Amount Settled</span>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(56, 161, 105, 0.1)', color: 'var(--success)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
          </div>
          <div className="stat-value text-success">{formatCurrency(totalSettled)}</div>
          <div className="stat-footer">{settlementRate}% of total billed collected</div>
        </div>

        <div className="stat-card" style={{ borderColor: totalOutstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
          <div className="stat-header">
            <span className="stat-title">Outstanding Mill Balance</span>
            <div className="stat-icon-wrapper" style={{ backgroundColor: totalOutstanding > 0 ? 'rgba(221, 107, 32, 0.1)' : 'rgba(56, 161, 105, 0.1)', color: totalOutstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
          </div>
          <div className="stat-value text-warning">{formatCurrency(totalOutstanding)}</div>
          <div className="stat-footer">Amount pending mill settlement</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Settlement Progress</span>
            <div className="stat-icon-wrapper">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            </div>
          </div>
          <div className="stat-value">{settledCount} / {payments.length}</div>
          <div className="stat-footer">Invoices completely settled</div>
        </div>
      </div>

      <div className="content-card">
        {/* Filters and Actions */}
        <div className="filters-panel">
          <div className="search-input-wrapper">
            <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input 
              type="text" 
              placeholder="Search by mill, farmer, village, or ref no..." 
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select 
            className="filter-select"
            value={millFilter}
            onChange={(e) => setMillFilter(e.target.value)}
          >
            <option value="All">All Sugar Mills</option>
            {distinctMills.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select 
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending (Unpaid)</option>
            <option value="Partial">Partial Settled</option>
            <option value="Paid">Fully Settled (Paid)</option>
          </select>

          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            New Mill Invoice / Bill
          </button>
        </div>

        {/* Invoices & Settlements List */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date / Mill Name</th>
                <th>Farmer & Village</th>
                <th>Tons Logged</th>
                <th>Billed Amount (₹)</th>
                <th>Settled Amount (₹)</th>
                <th>Outstanding Balance (₹)</th>
                <th>Settled Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No payment or settlement records found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{formatDate(p.date)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: '500' }}>{p.mill_name}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{p.farmer}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Village: {p.village || 'N/A'}</div>
                    </td>
                    <td>{p.tons ? `${p.tons} t` : '—'}</td>
                    <td style={{ fontWeight: '600' }}>{formatCurrency(p.gross_amount)}</td>
                    <td style={{ color: 'var(--success)', fontWeight: '600' }}>
                      {formatCurrency(p.advance)}
                    </td>
                    <td style={{ fontWeight: '700', color: p.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      {formatCurrency(p.balance)}
                    </td>
                    <td>
                      {p.payment_date ? (
                        <div>
                          <div style={{ fontWeight: '500' }}>{formatDate(p.payment_date)}</div>
                          {p.payment_mode && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.payment_mode}</div>}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${p.status === 'Paid' ? 'badge-success' : p.status === 'Partial' ? 'badge-warning' : 'badge-pending'}`}>
                        {p.status === 'Paid' ? 'Settled' : p.status === 'Partial' ? 'Partial Settled' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {p.balance > 0 && (
                          <button 
                            className="btn btn-primary btn-circle" 
                            onClick={() => openSettleModal(p)} 
                            title="Settle Amount (Receive Mill Payment)"
                            style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)', width: '32px', height: '32px' }}
                          >
                            <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>₹</span>
                          </button>
                        )}
                        <button className="btn btn-secondary btn-circle" onClick={() => openInvoice(p)} title="View Bill/Invoice">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                        </button>
                        <button className="btn btn-secondary btn-circle" onClick={() => handleOpenEdit(p)} title="Edit Record">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        </button>
                        <button className="btn btn-danger btn-circle" onClick={() => handleDelete(p.id)} title="Delete Record" style={{ backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
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

      {/* Quick Settlement Amount Modal */}
      {showSettleModal && settlingInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Record Mill Settlement</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {settlingInvoice.mill_name} • Farmer: {settlingInvoice.farmer}
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowSettleModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSettleSubmit}>
              <div className="modal-body">
                {/* Outstanding summary card */}
                <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Total Billed:</span>
                      <div style={{ fontWeight: '700' }}>{formatCurrency(settlingInvoice.gross_amount)}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Previously Settled:</span>
                      <div style={{ fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(settlingInvoice.advance)}</div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: 'var(--warning)' }}>Current Outstanding Balance:</span>
                    <span style={{ fontWeight: '800', fontSize: '1.125rem', color: 'var(--warning)' }}>{formatCurrency(settlingInvoice.balance)}</span>
                  </div>
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="form-group">
                    <label className="form-label">Settlement Amount to Receive (₹) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      placeholder="Enter amount settled by mill"
                      value={settleData.amount}
                      onChange={(e) => setSettleData({ ...settleData, amount: e.target.value })}
                      required
                      autoFocus
                    />
                    {/* Quick amount buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        onClick={() => setSettleData({ ...settleData, amount: settlingInvoice.balance })}
                      >
                        Full Balance ({formatCurrency(settlingInvoice.balance)})
                      </button>
                      {parseFloat(settlingInvoice.balance) > 1000 && (
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => setSettleData({ ...settleData, amount: (parseFloat(settlingInvoice.balance) / 2).toFixed(2) })}
                        >
                          50% ({formatCurrency(parseFloat(settlingInvoice.balance) / 2)})
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Settlement Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={settleData.date}
                      onChange={(e) => setSettleData({ ...settleData, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select 
                      className="form-control"
                      value={settleData.payment_mode}
                      onChange={(e) => setSettleData({ ...settleData, payment_mode: e.target.value })}
                    >
                      <option value="Bank Transfer / NEFT">Bank Transfer / NEFT / RTGS</option>
                      <option value="Cheque">Cheque</option>
                      <option value="UPI / Online">UPI / Online Transfer</option>
                      <option value="Cash">Cash Settlement</option>
                      <option value="Mill Credit Adjustment">Mill Credit Adjustment</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Reference No. / UTR / Cheque No.</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. UTR12839103 or CHQ-9281"
                      value={settleData.reference_no}
                      onChange={(e) => setSettleData({ ...settleData, reference_no: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
                  Confirm Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal (Amount-Centric) */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Update Mill Payment / Invoice' : 'New Sugar Mill Invoice'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Billing Date *</label>
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

                  {/* Financial Settlement Basis */}
                  <div className="form-group form-group-full" style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold' }}>₹</span>
                      Billing & Settlement Amounts
                    </div>

                    <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                      <div className="form-group">
                        <label className="form-label">Gross Billing Amount (₹) *</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control" 
                          placeholder="e.g. 50000"
                          value={formData.gross_amount}
                          onChange={(e) => handleAmountChange(e.target.value, formData.advance)}
                          required
                          style={{ fontWeight: '600' }}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Amount Settled / Paid (₹)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control" 
                          value={formData.advance}
                          onChange={(e) => handleAmountChange(formData.gross_amount, e.target.value)}
                          style={{ color: 'var(--success)', fontWeight: '600' }}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Outstanding Balance (₹)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control" 
                          value={formData.balance}
                          disabled
                          style={{ fontWeight: '700', color: formData.balance > 0 ? 'var(--warning)' : 'var(--success)', background: 'rgba(0,0,0,0.03)' }}
                        />
                      </div>
                    </div>

                    {/* Optional Tons calculation helper */}
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        Optional: Auto-calculate from Harvested Tons & Rate
                      </div>
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <input 
                            type="number" 
                            step="0.01"
                            className="form-control" 
                            placeholder="Tons (Optional)"
                            value={formData.tons}
                            onChange={(e) => handleTonsOrRateChange(e.target.value, formData.rate_per_ton, formData.advance)}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <input 
                            type="number" 
                            step="0.01"
                            className="form-control" 
                            placeholder="Rate/Ton (₹)"
                            value={formData.rate_per_ton}
                            onChange={(e) => handleTonsOrRateChange(formData.tons, e.target.value, formData.advance)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Invoice Status</label>
                    <select 
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Pending">Pending (Unpaid)</option>
                      <option value="Partial">Partial Settled</option>
                      <option value="Paid">Fully Settled (Paid)</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Settlement Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={formData.payment_date}
                      onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select 
                      className="form-control"
                      value={formData.payment_mode}
                      onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                    >
                      <option value="Bank Transfer / NEFT">Bank Transfer / NEFT / RTGS</option>
                      <option value="Cheque">Cheque</option>
                      <option value="UPI / Online">UPI / Online Transfer</option>
                      <option value="Cash">Cash Settlement</option>
                      <option value="Mill Credit Adjustment">Mill Credit Adjustment</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ref No. / UTR / Cheque No.</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. UTR8912301"
                      value={formData.reference_no}
                      onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Invoice & Settlement</button>
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
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#555' }}>BILLING INVOICE</h3>
                  <p style={{ fontSize: '0.875rem' }}><strong>Invoice #:</strong> INV-{selectedInvoice.id.substring(0, 8).toUpperCase()}</p>
                  <p style={{ fontSize: '0.875rem' }}><strong>Date:</strong> {formatDate(selectedInvoice.date)}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <h4 style={{ color: '#2d6a4f', borderBottom: '1px solid #ddd', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>BILLED TO SUGAR MILL:</h4>
                  <p style={{ fontSize: '0.9375rem', fontWeight: '600' }}>{selectedInvoice.mill_name}</p>
                  <p style={{ fontSize: '0.875rem', color: '#555' }}>Village: {selectedInvoice.village || 'N/A'}</p>
                </div>
                <div>
                  <h4 style={{ color: '#2d6a4f', borderBottom: '1px solid #ddd', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>FARMER DETAILS:</h4>
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
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.875rem' }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      Sugarcane Harvesting Service charges for farmer <strong>{selectedInvoice.farmer}</strong>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem' }}>{selectedInvoice.tons ? `${selectedInvoice.tons} Tons` : '—'}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem' }}>{selectedInvoice.rate_per_ton ? `${formatCurrency(selectedInvoice.rate_per_ton)}/t` : '—'}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600' }}>{formatCurrency(selectedInvoice.gross_amount)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Totals Box */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span>Gross Billed Amount:</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(selectedInvoice.gross_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#1b4332' }}>
                    <span>Amount Settled / Received:</span>
                    <span style={{ fontWeight: '600' }}>- {formatCurrency(selectedInvoice.advance)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', borderTop: '1px solid #ccc', paddingTop: '0.5rem', color: selectedInvoice.balance > 0 ? '#c53030' : '#2d6a4f' }}>
                    <span>Outstanding Due:</span>
                    <span>{formatCurrency(selectedInvoice.balance)}</span>
                  </div>
                </div>
              </div>

              {/* Status and Signature */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '3rem' }}>
                <div>
                  <p style={{ fontSize: '0.8125rem' }}><strong>Settlement Status:</strong> {selectedInvoice.status.toUpperCase()}</p>
                  {selectedInvoice.payment_date && <p style={{ fontSize: '0.8125rem', color: '#555' }}>Settled on: {formatDate(selectedInvoice.payment_date)}</p>}
                  {selectedInvoice.payment_mode && <p style={{ fontSize: '0.8125rem', color: '#555' }}>Mode: {selectedInvoice.payment_mode}</p>}
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

