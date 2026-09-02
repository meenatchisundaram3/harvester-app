import React, { useState, useEffect } from 'react';
import { db, localDb, BANNARI_SUGARS_STATEMENTS } from '../db.js';
import { generateUUID, formatDate, formatCurrency, fileToBase64 } from '../utils.js';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [millFilter, setMillFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('statements'); // 'statements' | 'all_cuts'
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementViewMode, setStatementViewMode] = useState('digital'); // 'digital' | 'original'
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [settlingInvoice, setSettlingInvoice] = useState(null);

  const [formData, setFormData] = useState({
    id: '',
    bill_no: '',
    mill_name: 'Bannari Amman Sugars Limited, Tirukoilur',
    division: 'ANDAMPALLAM',
    gang_leader_no: 'H038',
    gang_leader_name: 'SIVAKOZHUNDHU',
    date: new Date().toISOString().split('T')[0],
    period_from: '',
    period_to: '',
    farmer: '',
    village: 'Andampallam',
    tons: '',
    rate_per_ton: 600,
    gross_amount: '',
    deductions: 0,
    net_payable: '',
    advance: '',
    balance: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'Received Payment thru Bank (SBI)',
    bank_details: 'SBI0005-42805345508',
    reference_no: '',
    pdf_url: '',
    pdf_name: '',
    status: 'Paid',
    items: []
  });

  const [uploadData, setUploadData] = useState({
    file: null,
    pdf_url: '',
    pdf_name: '',
    bill_no: '',
    mill_name: 'Bannari Amman Sugars Limited, Tirukoilur',
    division: 'ANDAMPALLAM',
    gang_leader_no: 'H038',
    gang_leader_name: 'SIVAKOZHUNDHU',
    date: new Date().toISOString().split('T')[0],
    period_from: new Date().toISOString().split('T')[0],
    period_to: new Date().toISOString().split('T')[0],
    tons: '',
    rate_per_ton: 600,
    gross_amount: '',
    deductions: 0,
    net_payable: '',
    bank_details: 'SBI0005-42805345508',
    notes: ''
  });

  const [settleData, setSettleData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    payment_mode: 'Received Payment thru Bank (SBI)',
    reference_no: '',
    notes: ''
  });

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    // Ensure verified Bannari Statements are updated in DB
    for (const stmt of BANNARI_SUGARS_STATEMENTS) {
      await db.payments.put(stmt);
    }
    const list = await db.payments.toArray();
    list.sort((a, b) => new Date(b.date || b.period_to) - new Date(a.date || a.period_to));
    setPayments(list);
  };

  // Distinct list of sugar mills for filtering
  const distinctMills = [...new Set(payments.map(p => p.mill_name).filter(Boolean))];

  // Financial KPI totals (Amount Basis)
  const totalTons = payments.reduce((sum, p) => sum + (parseFloat(p.tons) || 0), 0);
  const totalBilled = payments.reduce((sum, p) => sum + (parseFloat(p.gross_amount) || 0), 0);
  const totalDeductions = payments.reduce((sum, p) => sum + (parseFloat(p.deductions) || 0), 0);
  const totalSettled = payments.reduce((sum, p) => sum + (parseFloat(p.advance || p.net_payable) || 0), 0);
  const totalOutstanding = payments.reduce((sum, p) => sum + (parseFloat(p.balance) || 0), 0);

  // Statements list (items with bill_no or multiple cuts) sorted Slip 1 -> Slip 4
  const statementsList = payments.filter(p => p.bill_no || (p.items && p.items.length > 0));
  statementsList.sort((a, b) => new Date(a.period_from || a.date) - new Date(b.period_from || b.date));
  const individualInvoices = payments.filter(p => !p.bill_no && (!p.items || p.items.length === 0));

  // Flattened cuts from all statements + individual invoices
  const allCuts = [];
  payments.forEach(p => {
    if (p.items && p.items.length > 0) {
      p.items.forEach(item => {
        allCuts.push({
          ...item,
          bill_no: p.bill_no || 'N/A',
          mill_name: p.mill_name,
          parent_id: p.id,
          status: p.status
        });
      });
    } else {
      allCuts.push({
        s_no: 1,
        r_no: p.reference_no || '—',
        p_no: '—',
        farmer: p.farmer,
        div: p.division || '010',
        date: p.date,
        rate: p.rate_per_ton || 600,
        tons: p.tons,
        amount: p.gross_amount,
        bill_no: p.bill_no || '—',
        mill_name: p.mill_name,
        parent_id: p.id,
        status: p.status
      });
    }
  });

  const handleOpenAdd = () => {
    setIsEditing(false);
    const todayStr = new Date().toISOString().split('T')[0];
    setFormData({
      id: generateUUID(),
      bill_no: '',
      mill_name: 'Bannari Amman Sugars Limited, Tirukoilur',
      division: 'ANDAMPALLAM',
      gang_leader_no: 'H038',
      gang_leader_name: 'SIVAKOZHUNDHU',
      date: todayStr,
      period_from: todayStr,
      period_to: todayStr,
      farmer: '',
      village: 'Andampallam',
      tons: '',
      rate_per_ton: 600,
      gross_amount: '',
      deductions: 0,
      net_payable: '',
      advance: '',
      balance: 0,
      payment_date: todayStr,
      payment_mode: 'Received Payment thru Bank (SBI)',
      bank_details: 'SBI0005-42805345508',
      reference_no: '',
      pdf_url: '',
      pdf_name: '',
      status: 'Paid',
      items: []
    });
    setShowModal(true);
  };

  const handleOpenUpload = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setUploadData({
      file: null,
      pdf_url: '',
      pdf_name: '',
      bill_no: '',
      mill_name: 'Bannari Amman Sugars Limited, Tirukoilur',
      division: 'ANDAMPALLAM',
      gang_leader_no: 'H038',
      gang_leader_name: 'SIVAKOZHUNDHU',
      date: todayStr,
      period_from: todayStr,
      period_to: todayStr,
      tons: '',
      rate_per_ton: 600,
      gross_amount: '',
      deductions: 0,
      net_payable: '',
      bank_details: 'SBI0005-42805345508',
      notes: ''
    });
    setShowUploadModal(true);
  };

  const handleOpenEdit = (p) => {
    setIsEditing(true);
    setFormData({
      ...p,
      rate_per_ton: p.rate_per_ton || 600,
      division: p.division || 'ANDAMPALLAM',
      gang_leader_no: p.gang_leader_no || 'H038',
      gang_leader_name: p.gang_leader_name || 'SIVAKOZHUNDHU',
      bank_details: p.bank_details || 'SBI0005-42805345508',
      payment_mode: p.payment_mode || 'Received Payment thru Bank (SBI)',
      pdf_url: p.pdf_url || '',
      pdf_name: p.pdf_name || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this mill payment record?')) {
      await localDb.deletePayment(id);
      loadPayments();
    }
  };

  // Recalculate settlement amounts
  const handleCalcChange = (tonsVal, rateVal, dedVal) => {
    const t = parseFloat(tonsVal) || 0;
    const r = parseFloat(rateVal) || 600;
    const d = parseFloat(dedVal) || 0;
    const gross = parseFloat((t * r).toFixed(2));
    const net = Math.max(0, parseFloat((gross - d).toFixed(2)));

    setFormData(prev => ({
      ...prev,
      tons: tonsVal,
      rate_per_ton: rateVal,
      gross_amount: gross,
      deductions: dedVal,
      net_payable: net,
      advance: net,
      balance: 0
    }));
  };

  const handleUploadCalcChange = (tonsVal, rateVal, dedVal) => {
    const t = parseFloat(tonsVal) || 0;
    const r = parseFloat(rateVal) || 600;
    const d = parseFloat(dedVal) || 0;
    const gross = parseFloat((t * r).toFixed(2));
    const net = Math.max(0, parseFloat((gross - d).toFixed(2)));

    setUploadData(prev => ({
      ...prev,
      tons: tonsVal,
      rate_per_ton: rateVal,
      gross_amount: gross,
      deductions: dedVal,
      net_payable: net
    }));
  };

  // Handle PDF / file selection in Form
  const handleFormPdfUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setFormData(prev => ({
          ...prev,
          pdf_url: base64,
          pdf_name: file.name
        }));
      } catch (err) {
        console.error('File reading failed:', err);
        alert('Could not read selected document.');
      }
    }
  };

  // Handle PDF / file selection in Quick Upload Modal
  const handleQuickPdfUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setUploadData(prev => ({
          ...prev,
          file,
          pdf_url: base64,
          pdf_name: file.name,
          bill_no: prev.bill_no || file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-\/]/g, ' ')
        }));
      } catch (err) {
        console.error('File reading failed:', err);
        alert('Could not read uploaded file.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.mill_name || !formData.gross_amount) {
      alert('Please enter Sugar Mill Name and Gross Billing Amount.');
      return;
    }

    const gross = parseFloat(formData.gross_amount) || 0;
    const ded = parseFloat(formData.deductions) || 0;
    const net = parseFloat(formData.net_payable) || Math.max(0, gross - ded);
    const adv = parseFloat(formData.advance) || net;
    const bal = Math.max(0, parseFloat((gross - ded - adv).toFixed(2)));

    const record = {
      ...formData,
      tons: parseFloat(formData.tons) || 0,
      rate_per_ton: parseFloat(formData.rate_per_ton) || 600,
      gross_amount: gross,
      deductions: ded,
      net_payable: net,
      advance: adv,
      balance: bal,
      status: bal <= 0 ? 'Paid' : (adv > 0 ? 'Partial' : 'Pending')
    };

    await localDb.savePayment(record);
    setShowModal(false);
    loadPayments();
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadData.bill_no) {
      alert('Please enter a Bill Number for this statement.');
      return;
    }

    const gross = parseFloat(uploadData.gross_amount) || 0;
    const ded = parseFloat(uploadData.deductions) || 0;
    const net = parseFloat(uploadData.net_payable) || Math.max(0, gross - ded);

    const record = {
      id: generateUUID(),
      bill_no: uploadData.bill_no,
      mill_name: uploadData.mill_name,
      division: uploadData.division,
      gang_leader_no: uploadData.gang_leader_no,
      gang_leader_name: uploadData.gang_leader_name,
      date: uploadData.date,
      period_from: uploadData.period_from,
      period_to: uploadData.period_to,
      tons: parseFloat(uploadData.tons) || 0,
      rate_per_ton: parseFloat(uploadData.rate_per_ton) || 600,
      gross_amount: gross,
      deductions: ded,
      net_payable: net,
      advance: net,
      balance: 0,
      payment_date: uploadData.date,
      payment_mode: 'Received Payment thru Bank (SBI)',
      bank_details: uploadData.bank_details,
      pdf_url: uploadData.pdf_url,
      pdf_name: uploadData.pdf_name,
      status: 'Paid',
      farmer: `Uploaded Statement: ${uploadData.bill_no}`,
      items: []
    };

    await localDb.savePayment(record);
    setShowUploadModal(false);
    loadPayments();
  };

  const openSettleModal = (payment) => {
    setSettlingInvoice(payment);
    const remainingBalance = Math.max(0, parseFloat(payment.balance) || (parseFloat(payment.gross_amount) - (parseFloat(payment.advance) || 0)));
    setSettleData({
      amount: remainingBalance > 0 ? remainingBalance : '',
      date: new Date().toISOString().split('T')[0],
      payment_mode: 'Received Payment thru Bank (SBI)',
      reference_no: payment.bank_details || 'SBI0005-42805345508',
      notes: ''
    });
    setShowSettleModal(true);
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!settlingInvoice || !settleData.amount) return;

    const settlingAmount = parseFloat(settleData.amount) || 0;
    const currentGross = parseFloat(settlingInvoice.gross_amount) || 0;
    const currentDed = parseFloat(settlingInvoice.deductions) || 0;
    const previousSettled = parseFloat(settlingInvoice.advance) || 0;
    const newTotalSettled = parseFloat((previousSettled + settlingAmount).toFixed(2));
    const newBalance = Math.max(0, parseFloat((currentGross - currentDed - newTotalSettled).toFixed(2)));

    const updatedRecord = {
      ...settlingInvoice,
      advance: newTotalSettled,
      balance: newBalance,
      status: newBalance <= 0 ? 'Paid' : 'Partial',
      payment_date: settleData.date,
      payment_mode: settleData.payment_mode,
      reference_no: settleData.reference_no,
      updated_at: new Date().toISOString()
    };

    await localDb.savePayment(updatedRecord);
    setShowSettleModal(false);
    setSettlingInvoice(null);
    loadPayments();
  };

  const openStatement = (payment) => {
    setSelectedStatement(payment);
    setStatementViewMode('digital');
    setShowStatementModal(true);
  };

  // Filter statements
  const filteredStatements = statementsList.filter(p => {
    const matchSearch = (p.farmer && p.farmer.toLowerCase().includes(search.toLowerCase())) ||
                        (p.mill_name && p.mill_name.toLowerCase().includes(search.toLowerCase())) ||
                        (p.bill_no && p.bill_no.toLowerCase().includes(search.toLowerCase())) ||
                        (p.division && p.division.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchMill = millFilter === 'All' || p.mill_name === millFilter;
    return matchSearch && matchStatus && matchMill;
  });

  const filteredCuts = allCuts.filter(c => {
    const matchSearch = (c.farmer && c.farmer.toLowerCase().includes(search.toLowerCase())) ||
                        (c.r_no && c.r_no.toLowerCase().includes(search.toLowerCase())) ||
                        (c.p_no && c.p_no.toLowerCase().includes(search.toLowerCase())) ||
                        (c.bill_no && c.bill_no.toLowerCase().includes(search.toLowerCase()));
    return matchSearch;
  });

  return (
    <div className="content-container">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 className="page-title">Sugar Mill Payments & Statements</h2>
          <p className="page-subtitle">
            Bannari Amman Sugars Limited Harvesting Charges Statements, Gross Billing, Mill Deductions & Bank Settlements
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleOpenUpload}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            📤 Upload Statement PDF / Slip
          </button>

          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            + Add Mill Statement / Bill
          </button>
        </div>
      </div>

      {/* Official Gang Leader & Mill Badge */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(45, 106, 79, 0.12) 0%, rgba(82, 183, 136, 0.08) 100%)',
        border: '1px solid rgba(45, 106, 79, 0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'var(--primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '800',
            fontSize: '1.1rem'
          }}>
            BA
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>
              Bannari Amman Sugars Limited, Tirukoilur
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Gang Leader No: <strong style={{ color: 'var(--primary)' }}>H038</strong> • Name: <strong style={{ color: 'var(--text-main)' }}>SIVAKOZHUNDHU</strong> • Division: <strong>ANDAMPALLAM</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bank Direct Credit A/C</div>
            <div style={{ fontWeight: '700', fontSize: '0.9375rem', color: 'var(--primary-dark)' }}>
              SBI0005-42805345508
            </div>
          </div>
          <span className="badge badge-success" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}>
            ● Active Contract
          </span>
        </div>
      </div>

      {/* 4 KPI Summary Cards (Real Domain Metrics) */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total Cane Harvested</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {totalTons.toFixed(3)} <span style={{ fontSize: '1rem', fontWeight: '500' }}>Tons</span>
          </div>
          <div className="stat-desc">4 Official Weekly Statements @ ₹600/T</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Gross Billed (A)</div>
          <div className="stat-value" style={{ color: 'var(--text-main)' }}>
            {formatCurrency(totalBilled)}
          </div>
          <div className="stat-desc">Gross harvesting revenue from mill</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Mill Deductions (B)</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {formatCurrency(totalDeductions)}
          </div>
          <div className="stat-desc">Diesel & advance recovery deductions</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(56, 161, 105, 0.4)', background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(56, 161, 105, 0.05) 100%)' }}>
          <div className="stat-label">Net Bank Settled (A - B)</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {formatCurrency(totalSettled)}
          </div>
          <div className="stat-desc">Received directly into SBI A/c</div>
        </div>
      </div>

      {/* View Switcher Tabs & Filters */}
      <div className="card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`btn ${activeTab === 'statements' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('statements')}
              style={{ fontSize: '0.875rem' }}
            >
              📑 Mill Harvesting Statements ({statementsList.length})
            </button>
            <button 
              className={`btn ${activeTab === 'all_cuts' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('all_cuts')}
              style={{ fontSize: '0.875rem' }}
            >
              🌾 All Harvesting Cuts ({allCuts.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search Bill #, Farmer, Ryot #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '220px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            />
            <select 
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '130px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            >
              <option value="All">All Status</option>
              <option value="Paid">Settled (Paid)</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* TAB 1: Mill Harvesting Statements (Official Bills) */}
      {activeTab === 'statements' && (
        <div className="card" style={{ padding: '0' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Bill No. & Period</th>
                  <th>Sugar Mill & Division</th>
                  <th style={{ textAlign: 'right' }}>Cane Qty (Tons)</th>
                  <th style={{ textAlign: 'right' }}>Gross Amount (A)</th>
                  <th style={{ textAlign: 'right' }}>Deductions (B)</th>
                  <th style={{ textAlign: 'right' }}>Net Bank Payout (A-B)</th>
                  <th>Bank Settlement</th>
                  <th>Document</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStatements.map((p, idx) => (
                  <tr key={p.id} style={{ background: p.bill_no ? 'rgba(45, 106, 79, 0.02)' : 'transparent' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                          Slip #{idx + 1}
                        </span>
                        <div style={{ fontWeight: '700', fontSize: '0.9375rem', color: 'var(--primary)' }}>
                          Bill #{p.bill_no || 'INV-' + p.id.substring(0, 6)}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {p.period_from && p.period_to ? (
                          <span>{formatDate(p.period_from)} → {formatDate(p.period_to)}</span>
                        ) : (
                          <span>Date: {formatDate(p.date)}</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: '600' }}>{p.mill_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Div: <strong>{p.division || 'ANDAMPALLAM'}</strong> • {p.farmer || (p.items ? `${p.items.length} Cuts` : '—')}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                      {parseFloat(p.tons || 0).toFixed(3)} t
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>@ ₹{p.rate_per_ton || 600}/t</div>
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: '700' }}>
                      {formatCurrency(p.gross_amount)}
                    </td>

                    <td style={{ textAlign: 'right', color: 'var(--warning)', fontWeight: '600' }}>
                      {p.deductions > 0 ? `- ${formatCurrency(p.deductions)}` : 'NIL'}
                    </td>

                    <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '800', fontSize: '0.95rem' }}>
                      {formatCurrency(p.net_payable || p.advance)}
                    </td>

                    <td>
                      <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--primary-dark)' }}>
                        {p.payment_mode || 'Received thru Bank'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {p.bank_details || 'SBI A/c 42805345508'}
                      </div>
                    </td>

                    <td>
                      {p.pdf_url ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                          PDF Attached
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Digital Slip</span>
                      )}
                    </td>

                    <td>
                      <span className={`badge ${p.status === 'Paid' ? 'badge-success' : p.status === 'Partial' ? 'badge-warning' : 'badge-pending'}`}>
                        {p.status === 'Paid' ? 'Bank Settled' : p.status === 'Partial' ? 'Partial' : 'Pending'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button 
                          className="btn btn-primary" 
                          onClick={() => openStatement(p)}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          title="View Official Mill Statement"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                          Statement
                        </button>
                        
                        {p.balance > 0 && (
                          <button 
                            className="btn btn-primary btn-circle" 
                            onClick={() => openSettleModal(p)} 
                            title="Record Settlement"
                            style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)', width: '30px', height: '30px' }}
                          >
                            <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>₹</span>
                          </button>
                        )}

                        <button className="btn btn-secondary btn-circle" onClick={() => handleOpenEdit(p)} title="Edit Statement" style={{ width: '30px', height: '30px' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        </button>

                        <button className="btn btn-danger btn-circle" onClick={() => handleDelete(p.id)} title="Delete" style={{ width: '30px', height: '30px', backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: All Harvesting Cuts / Line Items */}
      {activeTab === 'all_cuts' && (
        <div className="card" style={{ padding: '0' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ryot # (R.No)</th>
                  <th>Plot # (P.No)</th>
                  <th>Ryot / Farmer Name</th>
                  <th>Div</th>
                  <th>Bill No.</th>
                  <th style={{ textAlign: 'right' }}>Harvest Rate</th>
                  <th style={{ textAlign: 'right' }}>Cane Qty (Tons)</th>
                  <th style={{ textAlign: 'right' }}>Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {filteredCuts.map((cut, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: '500' }}>{formatDate(cut.date)}</td>
                    <td><span className="badge badge-pending" style={{ fontSize: '0.75rem' }}>{cut.r_no || '—'}</span></td>
                    <td><span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>{cut.p_no || '—'}</span></td>
                    <td style={{ fontWeight: '600' }}>{cut.farmer}</td>
                    <td>{cut.div || '010'}</td>
                    <td>
                      <span style={{ fontWeight: '600', color: 'var(--primary)' }}>
                        {cut.bill_no ? `Bill #${cut.bill_no}` : 'Direct'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>₹{cut.rate || 600}.00</td>
                    <td style={{ textAlign: 'right', fontWeight: '700' }}>{parseFloat(cut.tons || 0).toFixed(3)} t</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>
                      {formatCurrency(cut.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEDICATED UPLOAD STATEMENT PDF MODAL */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Upload Sugar Mill Statement (PDF / Slip)</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Upload official statement PDF or photo scan received from Bannari Amman Sugars
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div className="modal-body">
                {/* File Upload Zone */}
                <div style={{
                  border: '2px dashed var(--primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: 'rgba(45, 106, 79, 0.04)',
                  marginBottom: '1.25rem',
                  cursor: 'pointer'
                }}>
                  <input 
                    type="file" 
                    id="statement-pdf-input"
                    accept=".pdf,image/*" 
                    onChange={handleQuickPdfUpload}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="statement-pdf-input" style={{ cursor: 'pointer', display: 'block' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'rgba(45, 106, 79, 0.1)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 0.75rem'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    </div>
                    {uploadData.pdf_name ? (
                      <div>
                        <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{uploadData.pdf_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem' }}>✓ File Attached Successfully (Click to replace)</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>Click or Drag & Drop Statement PDF / Slip Scan</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Supports .pdf, .jpg, .png (Max 15MB)</div>
                      </div>
                    )}
                  </label>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Bill No. *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. 415/36 or 420/38"
                      value={uploadData.bill_no}
                      onChange={(e) => setUploadData({ ...uploadData, bill_no: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Statement Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={uploadData.date}
                      onChange={(e) => setUploadData({ ...uploadData, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Period From</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={uploadData.period_from}
                      onChange={(e) => setUploadData({ ...uploadData, period_from: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Period To</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={uploadData.period_to}
                      onChange={(e) => setUploadData({ ...uploadData, period_to: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Cane Quantity (Tons)</label>
                    <input 
                      type="number" 
                      step="0.001" 
                      className="form-control" 
                      placeholder="e.g. 183.675"
                      value={uploadData.tons}
                      onChange={(e) => handleUploadCalcChange(e.target.value, uploadData.rate_per_ton, uploadData.deductions)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Harvest Rate / Ton (₹)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={uploadData.rate_per_ton}
                      onChange={(e) => handleUploadCalcChange(uploadData.tons, e.target.value, uploadData.deductions)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gross Amount Payable (A) (₹) *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      placeholder="e.g. 110205.00"
                      value={uploadData.gross_amount}
                      onChange={(e) => setUploadData({ ...uploadData, gross_amount: e.target.value })}
                      required
                      style={{ fontWeight: '700' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mill Deductions (B) (₹)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      placeholder="e.g. 60816.00"
                      value={uploadData.deductions}
                      onChange={(e) => handleUploadCalcChange(uploadData.tons, uploadData.rate_per_ton, e.target.value)}
                      style={{ color: 'var(--warning)', fontWeight: '600' }}
                    />
                  </div>

                  <div className="form-group form-group-full">
                    <label className="form-label">Net Bank Payout Received (A - B) (₹)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      value={uploadData.net_payable}
                      onChange={(e) => setUploadData({ ...uploadData, net_payable: e.target.value })}
                      style={{ color: 'var(--success)', fontWeight: '800', fontSize: '1.125rem' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  Save & Attach Statement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL BANNARI AMMAN SUGARS STATEMENT MODAL */}
      {showStatementModal && selectedStatement && (
        <div className="modal-overlay print-modal-overlay">
          <div className="modal-content print-invoice-card" style={{ maxWidth: '880px', background: '#fff', color: '#111', padding: '2rem' }}>
            <div className="modal-header no-print" style={{ borderBottom: '1px solid #eee', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h3 className="modal-title" style={{ color: '#111' }}>
                  Bill #{selectedStatement.bill_no || 'N/A'}
                </h3>
                {selectedStatement.pdf_url && (
                  <div style={{ display: 'flex', gap: '0.35rem', background: '#f0f0f0', padding: '0.2rem', borderRadius: '6px' }}>
                    <button 
                      type="button"
                      className="btn"
                      onClick={() => setStatementViewMode('digital')}
                      style={{
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.75rem',
                        background: statementViewMode === 'digital' ? '#1b4332' : 'transparent',
                        color: statementViewMode === 'digital' ? '#fff' : '#444',
                        borderRadius: '4px'
                      }}
                    >
                      📑 Digital Slip
                    </button>
                    <button 
                      type="button"
                      className="btn"
                      onClick={() => setStatementViewMode('original')}
                      style={{
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.75rem',
                        background: statementViewMode === 'original' ? '#1b4332' : 'transparent',
                        color: statementViewMode === 'original' ? '#fff' : '#444',
                        borderRadius: '4px'
                      }}
                    >
                      📎 Attached PDF / Scan
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedStatement.pdf_url && (
                  <a 
                    href={selectedStatement.pdf_url} 
                    download={`Bannari_Statement_${selectedStatement.bill_no || 'bill'}.pdf`}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#111', borderColor: '#ccc' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Download PDF
                  </a>
                )}
                <button 
                  className="btn btn-primary" 
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#1b4332' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
                  Print Official Slip
                </button>
                <button className="modal-close" onClick={() => setShowStatementModal(false)} style={{ color: '#111' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* IF ATTACHED PDF VIEW MODE */}
            {statementViewMode === 'original' && selectedStatement.pdf_url ? (
              <div style={{ height: '70vh', background: '#333', borderRadius: '8px', overflow: 'hidden' }}>
                <iframe 
                  src={selectedStatement.pdf_url} 
                  title={`Statement ${selectedStatement.bill_no}`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            ) : (
              /* DIGITAL REPLICA OF BANNARI AMMAN SUGARS SLIP */
              <div className="print-area" style={{ fontFamily: 'monospace, Arial, sans-serif', color: '#000' }}>
                {/* Mill Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: '900', letterSpacing: '0.5px' }}>
                    BANNARI AMMAN SUGARS LIMITED, TIRUKOILUR
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.1rem' }}>
                    CIN: L15421TZ1983PLC001358 • Website: www.bannari.com
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '800', marginTop: '0.35rem', textTransform: 'uppercase' }}>
                    HARVESTING CHARGES STATEMENT FOR THE PERIOD
                  </div>
                </div>

                {/* Gang Leader & Bill Period Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem', fontSize: '0.8125rem', borderBottom: '1px solid #000', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div><strong>Gang Leader No. :</strong> {selectedStatement.gang_leader_no || 'H038'}</div>
                    <div><strong>Gang Leader Name:</strong> {selectedStatement.gang_leader_name || 'SIVAKOZHUNDHU'}</div>
                    <div><strong>Division :</strong> {selectedStatement.division || 'ANDAMPALLAM'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>
                      <strong>FROM:</strong> {selectedStatement.period_from ? formatDate(selectedStatement.period_from) : '—'} &nbsp;
                      <strong>TO:</strong> {selectedStatement.period_to ? formatDate(selectedStatement.period_to) : '—'}
                    </div>
                    <div><strong>Run Date:</strong> {selectedStatement.date ? formatDate(selectedStatement.date) : '—'}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '800' }}><strong>Bill No. :</strong> {selectedStatement.bill_no || 'N/A'}</div>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: '1rem', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000', background: '#fafafa' }}>
                      <th style={{ padding: '0.35rem 0.25rem', textAlign: 'center', borderRight: '1px solid #000' }}>S.No.</th>
                      <th style={{ padding: '0.35rem 0.25rem', textAlign: 'center', borderRight: '1px solid #000' }}>R.No.</th>
                      <th style={{ padding: '0.35rem 0.25rem', textAlign: 'center', borderRight: '1px solid #000' }}>P.No.</th>
                      <th style={{ padding: '0.35rem 0.5rem', textAlign: 'left', borderRight: '1px solid #000' }}>R. Name</th>
                      <th style={{ padding: '0.35rem 0.25rem', textAlign: 'center', borderRight: '1px solid #000' }}>Div.</th>
                      <th style={{ padding: '0.35rem 0.25rem', textAlign: 'center', borderRight: '1px solid #000' }}>Date</th>
                      <th style={{ padding: '0.35rem 0.25rem', textAlign: 'right', borderRight: '1px solid #000' }}>H.Rate</th>
                      <th style={{ padding: '0.35rem 0.25rem', textAlign: 'right', borderRight: '1px solid #000' }}>Cane Qty</th>
                      <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStatement.items && selectedStatement.items.length > 0 ? (
                      selectedStatement.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                          <td style={{ padding: '0.25rem', textAlign: 'center', borderRight: '1px solid #000' }}>{it.s_no || idx + 1}</td>
                          <td style={{ padding: '0.25rem', textAlign: 'center', borderRight: '1px solid #000' }}>{it.r_no}</td>
                          <td style={{ padding: '0.25rem', textAlign: 'center', borderRight: '1px solid #000' }}>{it.p_no}</td>
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'left', borderRight: '1px solid #000', fontWeight: 'bold' }}>{it.farmer}</td>
                          <td style={{ padding: '0.25rem', textAlign: 'center', borderRight: '1px solid #000' }}>{it.div || '010'}</td>
                          <td style={{ padding: '0.25rem', textAlign: 'center', borderRight: '1px solid #000' }}>{it.date}</td>
                          <td style={{ padding: '0.25rem', textAlign: 'right', borderRight: '1px solid #000' }}>{(it.rate || 600).toFixed(2)}</td>
                          <td style={{ padding: '0.25rem', textAlign: 'right', borderRight: '1px solid #000', fontWeight: '600' }}>{parseFloat(it.tons).toFixed(3)}</td>
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(it.amount).toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #000' }}>1</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #000' }}>—</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #000' }}>—</td>
                        <td style={{ padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #000', fontWeight: 'bold' }}>{selectedStatement.farmer}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #000' }}>{selectedStatement.division || '010'}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #000' }}>{selectedStatement.date}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #000' }}>{(selectedStatement.rate_per_ton || 600).toFixed(2)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #000' }}>{parseFloat(selectedStatement.tons || 0).toFixed(3)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(selectedStatement.gross_amount).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Settlement Two-Box Layout (Exact match to real physical bill) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem', border: '1px solid #000', padding: '0.75rem', marginBottom: '1.25rem' }}>
                  {/* Left Box: Deductions & Bank SB No */}
                  <div style={{ borderRight: '1px solid #000', paddingRight: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span>Advance Recovery Amt:</span>
                      <span>NIL</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span>Other Deductions :</span>
                      <span>{parseFloat(selectedStatement.deductions || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                      <span>Total Deductions (B) :</span>
                      <span>{parseFloat(selectedStatement.deductions || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', background: '#f5f5f5', padding: '0.35rem', border: '1px dashed #666' }}>
                      <div><strong>Ret. Amt:</strong> NIL</div>
                      <div><strong>B.Code / S.B. No :</strong> <span style={{ fontWeight: 'bold' }}>{selectedStatement.bank_details || 'SBI0005-42805345508'}</span></div>
                    </div>
                  </div>

                  {/* Right Box: Payable & Net Calculation */}
                  <div style={{ paddingLeft: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span>Total Cane Qty :</span>
                      <strong>{parseFloat(selectedStatement.tons || 0).toFixed(3)} Tons</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '0.25rem' }}>
                      <span>Total Amount Payable (A) :</span>
                      <span>{parseFloat(selectedStatement.gross_amount || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', marginTop: '0.25rem' }}>
                      <span>Less Total Deductions (B) :</span>
                      <span>- {parseFloat(selectedStatement.deductions || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '1rem', borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '0.35rem 0', marginTop: '0.5rem' }}>
                      <span>NET AMOUNT PAYABLE (A) - (B):</span>
                      <span>₹ {parseFloat(selectedStatement.net_payable || selectedStatement.advance || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2rem', fontSize: '0.8125rem' }}>
                  <div style={{ textAlign: 'center', width: '180px' }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '0.25rem' }}>
                      Prepared by
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', width: '220px' }}>
                    <div style={{ fontStyle: 'italic', marginBottom: '0.25rem', fontSize: '0.75rem', color: '#2d6a4f' }}>
                      Received Payment thru Bank
                    </div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '0.25rem', fontWeight: 'bold' }}>
                      Gang Leader (Sivakozhundhu)
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-footer no-print" style={{ borderTop: '1px solid #eee', marginTop: '1.5rem', paddingTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowStatementModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Settlement Modal */}
      {showSettleModal && settlingInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Record Mill Settlement</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {settlingInvoice.mill_name} • Bill: {settlingInvoice.bill_no || 'INV'}
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowSettleModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSettleSubmit}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Gross Payable (A):</span>
                      <div style={{ fontWeight: '700' }}>{formatCurrency(settlingInvoice.gross_amount)}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Deductions (B):</span>
                      <div style={{ fontWeight: '700', color: 'var(--warning)' }}>- {formatCurrency(settlingInvoice.deductions || 0)}</div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600' }}>Net Bank Amount (A-B):</span>
                    <span style={{ fontWeight: '800', fontSize: '1.125rem', color: 'var(--success)' }}>
                      {formatCurrency(settlingInvoice.net_payable || settlingInvoice.advance)}
                    </span>
                  </div>
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="form-group">
                    <label className="form-label">Settlement Amount Received (₹) *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      value={settleData.amount}
                      onChange={(e) => setSettleData({ ...settleData, amount: e.target.value })}
                      required
                      style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={settleData.date}
                      onChange={(e) => setSettleData({ ...settleData, date: e.target.value })}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Bank Account / Reference</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={settleData.reference_no}
                      onChange={(e) => setSettleData({ ...settleData, reference_no: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
                  Confirm Bank Credit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Edit Mill Statement / Bill' : 'New Sugar Mill Statement / Bill'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Bill No. *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. 415/36"
                      value={formData.bill_no}
                      onChange={(e) => setFormData({ ...formData, bill_no: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Run / Bill Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Period From</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={formData.period_from}
                      onChange={(e) => setFormData({ ...formData, period_from: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Period To</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={formData.period_to}
                      onChange={(e) => setFormData({ ...formData, period_to: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Sugar Mill Name *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.mill_name}
                      onChange={(e) => setFormData({ ...formData, mill_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Division</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.division}
                      onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gang Leader No. & Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={`${formData.gang_leader_no} - ${formData.gang_leader_name}`}
                      disabled
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Bank Account</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.bank_details}
                      onChange={(e) => setFormData({ ...formData, bank_details: e.target.value })}
                    />
                  </div>

                  {/* Calculations Box */}
                  <div className="form-group form-group-full" style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: '700', marginBottom: '0.75rem', color: 'var(--primary)' }}>
                      Harvesting Quantities & Settlement Amounts
                    </div>

                    <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                      <div className="form-group">
                        <label className="form-label">Total Tons *</label>
                        <input 
                          type="number" 
                          step="0.001" 
                          className="form-control" 
                          placeholder="e.g. 183.675"
                          value={formData.tons}
                          onChange={(e) => handleCalcChange(e.target.value, formData.rate_per_ton, formData.deductions)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Rate / Ton (₹)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          value={formData.rate_per_ton}
                          onChange={(e) => handleCalcChange(formData.tons, e.target.value, formData.deductions)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Gross Amount (A) (₹) *</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          className="form-control" 
                          value={formData.gross_amount}
                          onChange={(e) => setFormData({ ...formData, gross_amount: e.target.value })}
                          required
                          style={{ fontWeight: '700' }}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Deductions (B) (₹)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          className="form-control" 
                          value={formData.deductions}
                          onChange={(e) => handleCalcChange(formData.tons, formData.rate_per_ton, e.target.value)}
                          style={{ color: 'var(--warning)', fontWeight: '600' }}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Net Bank Payout (A-B)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          className="form-control" 
                          value={formData.net_payable}
                          onChange={(e) => setFormData({ ...formData, net_payable: e.target.value, advance: e.target.value })}
                          style={{ color: 'var(--success)', fontWeight: '800' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Attachment Section */}
                  <div className="form-group form-group-full">
                    <label className="form-label">Attach Statement Document (PDF or Scan Photo)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <input 
                        type="file" 
                        id="edit-form-pdf-input"
                        accept=".pdf,image/*" 
                        onChange={handleFormPdfUpload}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="edit-form-pdf-input" className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        Choose PDF / Image File
                      </label>
                      {formData.pdf_name && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: '600' }}>
                          ✓ {formData.pdf_name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Mill Statement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print stylesheet */}
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
            padding: 0 !important;
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
