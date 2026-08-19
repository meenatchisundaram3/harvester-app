import React, { useState, useEffect } from 'react';
import { db, localDb, OFFICIAL_FLEET } from '../db.js';
import { generateUUID, formatDate, formatCurrency } from '../utils.js';

export default function Operators() {
  const [operators, setOperators] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Selected operator for actions
  const [selectedOp, setSelectedOp] = useState(null);

  // Add / Edit operator form
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    role: 'Harvester Operator',
    assigned_vehicle: 'TN32BF8500',
    mobile: '',
    address: '',
    aadhaar: '',
    license: '',
    joining_date: '',
    salary_type: 'Monthly',
    salary_amount: '',
    status: 'Active'
  });

  // Give Advance form
  const [advanceData, setAdvanceData] = useState({
    operator_id: '',
    amount: '',
    date: '',
    reason: 'Daily Food / Pocket Money',
    payment_mode: 'Cash',
    notes: ''
  });

  // Salary Settle form
  const [settleData, setSettleData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    base_salary: 0,
    days_present: 0,
    advances_taken: 0,
    net_payable: 0,
    payment_mode: 'Bank Transfer / UPI',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [opList, expList, attList] = await Promise.all([
      db.operators.toArray(),
      db.expenses.toArray(),
      db.attendance.toArray()
    ]);
    setOperators(opList);
    setExpenses(expList);
    setAttendance(attList);
  };

  // Helper: Get all advances given to a specific operator
  const getOperatorAdvances = (opId) => {
    return expenses
      .filter(e => (e.category === 'Salary' || e.category === 'Advance' || e.category === 'Food') && e.ref_id === opId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // Helper: Total advances given to an operator
  const getOperatorTotalAdvances = (opId) => {
    const advList = getOperatorAdvances(opId);
    return advList.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  };

  // Helper: Get days present this month for an operator
  const getOperatorMonthlyAttendance = (opId, month = new Date().getMonth() + 1, year = new Date().getFullYear()) => {
    const monthStr = String(month).padStart(2, '0');
    return attendance.filter(a => {
      const isPresent = a.operator_id === opId && (a.status === 'Present' || a.status === 'Half Day');
      const matchesMonth = a.date && a.date.startsWith(`${year}-${monthStr}`);
      return isPresent && matchesMonth;
    }).length;
  };

  // Financial KPIs
  const totalCrewCount = operators.filter(o => o.status === 'Active').length;
  const totalBaseSalary = operators.reduce((sum, o) => sum + (parseFloat(o.salary_amount) || 0), 0);
  const totalAdvancesAll = expenses
    .filter(e => e.ref_id && operators.some(o => o.id === e.ref_id))
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalNetDue = Math.max(0, totalBaseSalary - totalAdvancesAll);

  // Open Add Operator
  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: generateUUID(),
      name: '',
      role: 'Harvester Operator',
      assigned_vehicle: 'TN32BF8500',
      mobile: '',
      address: '',
      aadhaar: '',
      license: '',
      joining_date: new Date().toISOString().split('T')[0],
      salary_type: 'Monthly',
      salary_amount: 30000,
      status: 'Active'
    });
    setShowModal(true);
  };

  // Open Edit Operator
  const handleOpenEdit = (op) => {
    setIsEditing(true);
    setFormData({
      ...op,
      role: op.role || (op.name.toLowerCase().includes('infield') ? 'Infielder 1 Operator' : 'Harvester Operator'),
      assigned_vehicle: op.assigned_vehicle || 'TN32BF8500'
    });
    setShowModal(true);
  };

  // Open Give Advance Modal
  const handleOpenAdvance = (op = null) => {
    const targetOpId = op ? op.id : (operators[0]?.id || '');
    setSelectedOp(op || operators.find(o => o.id === targetOpId));
    setAdvanceData({
      operator_id: targetOpId,
      amount: '',
      date: new Date().toISOString().split('T')[0],
      reason: 'Daily Food / Pocket Money',
      payment_mode: 'Cash',
      notes: ''
    });
    setShowAdvanceModal(true);
  };

  // Open Advance Passbook / Ledger Modal
  const handleOpenLedger = (op) => {
    setSelectedOp(op);
    setShowLedgerModal(true);
  };

  // Open Salary Settle Modal
  const handleOpenSettle = (op) => {
    setSelectedOp(op);
    const m = new Date().getMonth() + 1;
    const y = new Date().getFullYear();
    const daysPresent = getOperatorMonthlyAttendance(op.id, m, y);
    const advances = getOperatorTotalAdvances(op.id);
    const base = parseFloat(op.salary_amount) || 0;
    
    let earned = base;
    if (op.salary_type === 'Daily') {
      earned = base * (daysPresent || 1);
    }
    const net = Math.max(0, earned - advances);

    setSettleData({
      month: m,
      year: y,
      base_salary: earned,
      days_present: daysPresent,
      advances_taken: advances,
      net_payable: net,
      payment_mode: 'Bank Transfer / UPI',
      notes: ''
    });
    setShowSettleModal(true);
  };

  // Submit Add/Edit Operator
  const handleSubmitOperator = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile || !formData.salary_amount) {
      alert('Please fill out name, mobile number, and salary amount.');
      return;
    }
    
    const record = {
      ...formData,
      salary_amount: parseFloat(formData.salary_amount) || 0
    };

    await localDb.saveOperator(record);
    setShowModal(false);
    loadData();
  };

  // Submit Give Advance
  const handleSubmitAdvance = async (e) => {
    e.preventDefault();
    if (!advanceData.operator_id || !advanceData.amount) {
      alert('Please select an operator and enter an advance amount.');
      return;
    }

    const op = operators.find(o => o.id === advanceData.operator_id);
    const opName = op ? op.name : 'Operator';
    const amountVal = parseFloat(advanceData.amount) || 0;

    const expenseRecord = {
      id: generateUUID(),
      date: advanceData.date || new Date().toISOString().split('T')[0],
      category: 'Salary', // Categorized as Salary advance for accounting
      amount: amountVal,
      ref_id: advanceData.operator_id,
      notes: `Advance to ${opName}: ${advanceData.reason} (${advanceData.payment_mode})${advanceData.notes ? ' - ' + advanceData.notes : ''}`,
      payment_mode: advanceData.payment_mode
    };

    await localDb.saveExpense(expenseRecord);
    setShowAdvanceModal(false);
    loadData();
  };

  // Delete an advance from ledger
  const handleDeleteAdvance = async (advId) => {
    if (window.confirm('Are you sure you want to remove this advance entry?')) {
      await localDb.deleteExpense(advId);
      loadData();
    }
  };

  // Submit Salary Settlement
  const handleSubmitSalarySettle = async (e) => {
    e.preventDefault();
    if (!selectedOp) return;

    // Record the net salary payment as an expense
    const salaryExpense = {
      id: generateUUID(),
      date: new Date().toISOString().split('T')[0],
      category: 'Salary',
      amount: parseFloat(settleData.net_payable) || 0,
      ref_id: selectedOp.id,
      notes: `Final Salary Settlement (${settleData.month}/${settleData.year}) for ${selectedOp.name}. Base: ${formatCurrency(settleData.base_salary)}, Less Advances: ${formatCurrency(settleData.advances_taken)}`
    };

    await localDb.saveExpense(salaryExpense);
    setShowSettleModal(false);
    alert(`Salary settlement of ${formatCurrency(settleData.net_payable)} for ${selectedOp.name} logged successfully!`);
    loadData();
  };

  // Delete Operator
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this operator? Associated logs will remain preserved.')) {
      await localDb.deleteOperator(id);
      loadData();
    }
  };

  const filteredOperators = operators.filter(op => {
    const matchSearch = op.name.toLowerCase().includes(search.toLowerCase()) || 
                        op.mobile.includes(search) || 
                        (op.role && op.role.toLowerCase().includes(search.toLowerCase())) ||
                        (op.aadhaar && op.aadhaar.includes(search));
    const matchRole = roleFilter === 'All' || op.role === roleFilter;
    const matchStatus = statusFilter === 'All' || op.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="operators-view">
      {/* Financial & Crew KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Active Crew</span>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(45, 106, 79, 0.1)', color: 'var(--primary)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
          </div>
          <div className="stat-value">{totalCrewCount} Pilots</div>
          <div className="stat-footer">1 Harvester + 2 Infield Operators</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Monthly Base Salary</span>
            <div className="stat-icon-wrapper">
              <span style={{ fontWeight: 'bold' }}>₹</span>
            </div>
          </div>
          <div className="stat-value">{formatCurrency(totalBaseSalary)}</div>
          <div className="stat-footer">Combined monthly wage commitment</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'var(--warning)' }}>
          <div className="stat-header">
            <span className="stat-title">Total Advances Given</span>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(221, 107, 32, 0.1)', color: 'var(--warning)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
          </div>
          <div className="stat-value text-warning">{formatCurrency(totalAdvancesAll)}</div>
          <div className="stat-footer">Ad-hoc pocket money & advances given</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'var(--success)' }}>
          <div className="stat-header">
            <span className="stat-title">Net Salary Due</span>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(56, 161, 105, 0.1)', color: 'var(--success)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
          </div>
          <div className="stat-value text-success">{formatCurrency(totalNetDue)}</div>
          <div className="stat-footer">Balance after deducting all advances</div>
        </div>
      </div>

      <div className="content-card">
        {/* Filter / Actions Bar */}
        <div className="filters-panel">
          <div className="search-input-wrapper">
            <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input 
              type="text" 
              placeholder="Search by name, role, phone, or vehicle..." 
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select 
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="All">All Roles</option>
            <option value="Harvester Operator">Harvester Operator</option>
            <option value="Infielder 1 Operator">Infielder 1 Operator</option>
            <option value="Infielder 2 Operator">Infielder 2 Operator</option>
          </select>
          
          <select 
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => handleOpenAdvance()}
              style={{ backgroundColor: 'var(--warning)', borderColor: 'var(--warning)' }}
            >
              <span style={{ fontWeight: 'bold' }}>⚡ ₹</span>
              Give Advance Money
            </button>

            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add Operator
            </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Operator & Role</th>
                <th>Assigned Machinery</th>
                <th>Contact</th>
                <th>Base Salary</th>
                <th>Advances Taken (₹)</th>
                <th>Net Balance Due (₹)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No operators found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredOperators.map(op => {
                  const advances = getOperatorTotalAdvances(op.id);
                  const base = parseFloat(op.salary_amount) || 0;
                  const netDue = Math.max(0, base - advances);
                  const assignedVeh = OFFICIAL_FLEET.find(v => v.id === op.assigned_vehicle);

                  return (
                    <tr key={op.id}>
                      <td>
                        <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {op.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: '600' }}>
                          {op.role || 'Crew Operator'}
                        </div>
                      </td>
                      <td>
                        {assignedVeh ? (
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '0.8125rem' }}>{assignedVeh.reg_number}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{assignedVeh.vehicle_type}</div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>General Fleet</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: '500' }}>{op.mobile}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Joined: {formatDate(op.joining_date)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{formatCurrency(op.salary_amount)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Per {op.salary_type === 'Per Ton' ? 'Ton' : op.salary_type === 'Daily' ? 'Day' : 'Month'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: advances > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                          {formatCurrency(advances)}
                        </div>
                        {advances > 0 && (
                          <button 
                            onClick={() => handleOpenLedger(op)} 
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            View Passbook ({getOperatorAdvances(op.id).length})
                          </button>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: netDue > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                          {formatCurrency(netDue)}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${op.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                          {op.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button 
                            className="btn btn-primary btn-circle" 
                            onClick={() => handleOpenAdvance(op)} 
                            title="Give Cash Advance"
                            style={{ backgroundColor: 'var(--warning)', borderColor: 'var(--warning)', width: '32px', height: '32px' }}
                          >
                            <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>₹</span>
                          </button>
                          
                          <button 
                            className="btn btn-secondary btn-circle" 
                            onClick={() => handleOpenLedger(op)} 
                            title="Advance Ledger / Passbook"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                          </button>

                          <button 
                            className="btn btn-secondary btn-circle" 
                            onClick={() => handleOpenSettle(op)} 
                            title="Settle Monthly Salary"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          </button>

                          <button className="btn btn-secondary btn-circle" onClick={() => handleOpenEdit(op)} title="Edit Details">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </button>
                          
                          <button className="btn btn-danger btn-circle" onClick={() => handleDelete(op.id)} title="Delete" style={{ backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
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

      {/* Give Cash Advance Modal */}
      {showAdvanceModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Give Operator Cash Advance</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Log money / food bhatta given anytime to the crew
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowAdvanceModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmitAdvance}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="form-group">
                    <label className="form-label">Operator *</label>
                    <select 
                      className="form-control"
                      value={advanceData.operator_id}
                      onChange={(e) => {
                        setAdvanceData({ ...advanceData, operator_id: e.target.value });
                        setSelectedOp(operators.find(o => o.id === e.target.value));
                      }}
                      required
                    >
                      {operators.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.role || 'Operator'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Advance Amount Given (₹) *</label>
                    <input 
                      type="number" 
                      step="1"
                      className="form-control" 
                      placeholder="e.g. 500 or 2000"
                      value={advanceData.amount}
                      onChange={(e) => setAdvanceData({ ...advanceData, amount: e.target.value })}
                      required
                      autoFocus
                      style={{ fontSize: '1.25rem', fontWeight: '700' }}
                    />
                    {/* Quick amount chip buttons */}
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      {[500, 1000, 2000, 5000, 10000].map(val => (
                        <button 
                          key={val}
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => setAdvanceData({ ...advanceData, amount: val })}
                        >
                          + {formatCurrency(val)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date & Time *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={advanceData.date}
                      onChange={(e) => setAdvanceData({ ...advanceData, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Reason / Category</label>
                    <select 
                      className="form-control"
                      value={advanceData.reason}
                      onChange={(e) => setAdvanceData({ ...advanceData, reason: e.target.value })}
                    >
                      <option value="Daily Food / Pocket Money">Daily Food / Pocket Money (தினப்படி)</option>
                      <option value="Personal / Family Advance">Personal / Family Advance</option>
                      <option value="Medical / Emergency">Medical / Emergency</option>
                      <option value="Travel / Fuel Expense">Travel / Fuel Expense</option>
                      <option value="Festival / General Advance">Festival / General Advance</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select 
                      className="form-control"
                      value={advanceData.payment_mode}
                      onChange={(e) => setAdvanceData({ ...advanceData, payment_mode: e.target.value })}
                    >
                      <option value="Cash">Cash (நேரடி பணம்)</option>
                      <option value="GPay / PhonePe / UPI">GPay / PhonePe / UPI</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notes (Optional)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Given at field for lunch / emergency"
                      value={advanceData.notes}
                      onChange={(e) => setAdvanceData({ ...advanceData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdvanceModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--warning)', borderColor: 'var(--warning)' }}>
                  Record Cash Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Operator Advance Passbook / Ledger Modal */}
      {showLedgerModal && selectedOp && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{selectedOp.name} — Advance Passbook</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {selectedOp.role || 'Operator'} • Phone: {selectedOp.mobile}
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowLedgerModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="modal-body">
              {/* Summary Card */}
              <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Total Advances Given:</span>
                  <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--warning)' }}>
                    {formatCurrency(getOperatorTotalAdvances(selectedOp.id))}
                  </div>
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => { setShowLedgerModal(false); handleOpenAdvance(selectedOp); }}
                  style={{ backgroundColor: 'var(--warning)', borderColor: 'var(--warning)', fontSize: '0.8125rem', padding: '0.4rem 0.8rem' }}
                >
                  + Give Money Now
                </button>
              </div>

              {/* Transactions List */}
              <div className="table-container" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reason / Category</th>
                      <th>Mode</th>
                      <th>Amount (₹)</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getOperatorAdvances(selectedOp.id).length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                          No advance money has been given to this operator yet.
                        </td>
                      </tr>
                    ) : (
                      getOperatorAdvances(selectedOp.id).map(adv => (
                        <tr key={adv.id}>
                          <td>{formatDate(adv.date)}</td>
                          <td>
                            <div style={{ fontWeight: '600' }}>{adv.notes?.split(' - ')[0]?.replace(`Advance to ${selectedOp.name}: `, '') || 'Advance'}</div>
                            {adv.notes?.includes(' - ') && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{adv.notes.split(' - ')[1]}</div>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-pending" style={{ fontSize: '0.7rem' }}>
                              {adv.payment_mode || 'Cash'}
                            </span>
                          </td>
                          <td style={{ fontWeight: '700', color: 'var(--danger)' }}>
                            - {formatCurrency(adv.amount)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              className="btn btn-danger btn-circle" 
                              onClick={() => handleDeleteAdvance(adv.id)}
                              title="Delete Entry"
                              style={{ width: '28px', height: '28px', backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowLedgerModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Salary Settlement Modal */}
      {showSettleModal && selectedOp && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Salary Settlement</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {selectedOp.name} ({selectedOp.role || 'Operator'})
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowSettleModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmitSalarySettle}>
              <div className="modal-body">
                {/* Breakdown Calculation */}
                <div style={{ background: 'var(--bg-app)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span>Gross Earned Salary:</span>
                    <span style={{ fontWeight: '700' }}>{formatCurrency(settleData.base_salary)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--danger)' }}>
                    <span>Less: Total Advances Taken:</span>
                    <span style={{ fontWeight: '700' }}>- {formatCurrency(settleData.advances_taken)}</span>
                  </div>
                  <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--success)' }}>Net Salary Payable:</span>
                    <span style={{ fontWeight: '800', fontSize: '1.35rem', color: 'var(--success)' }}>
                      {formatCurrency(settleData.net_payable)}
                    </span>
                  </div>
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="form-group">
                    <label className="form-label">Settlement Amount to Pay (₹) *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      value={settleData.net_payable} 
                      onChange={(e) => setSettleData({ ...settleData, net_payable: parseFloat(e.target.value) || 0 })} 
                      required 
                      style={{ fontWeight: '700', fontSize: '1.15rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select 
                      className="form-control" 
                      value={settleData.payment_mode} 
                      onChange={(e) => setSettleData({ ...settleData, payment_mode: e.target.value })}
                    >
                      <option value="Bank Transfer / UPI">Bank Transfer / UPI / GPay</option>
                      <option value="Cash">Cash Payment</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
                  Confirm Salary Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Operator Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Edit Operator Details' : 'Add New Operator'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmitOperator}>
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
                    <label className="form-label">Crew Role *</label>
                    <select 
                      className="form-control"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="Harvester Operator">Harvester Operator (Pilot)</option>
                      <option value="Infielder 1 Operator">Infielder 1 Operator</option>
                      <option value="Infielder 2 Operator">Infielder 2 Operator</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assigned Vehicle / Fleet</label>
                    <select 
                      className="form-control"
                      value={formData.assigned_vehicle}
                      onChange={(e) => setFormData({ ...formData, assigned_vehicle: e.target.value })}
                    >
                      {OFFICIAL_FLEET.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
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
                <button type="submit" className="btn btn-primary">Save Operator</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

