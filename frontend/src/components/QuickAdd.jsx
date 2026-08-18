import React, { useState, useEffect } from 'react';
import { db, localDb } from '../db.js';
import { generateUUID } from '../utils.js';

export default function QuickAdd({ onSaveSuccess }) {
  const [showMainModal, setShowMainModal] = useState(false);
  const [activeForm, setActiveForm] = useState(null); // 'attendance' | 'diesel' | 'fieldwork' | 'payment'

  const [operators, setOperators] = useState([]);
  const [harvesters, setHarvesters] = useState([]);

  // Form states
  const [attendanceForm, setAttendanceForm] = useState({
    operator_id: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Present',
    working_hours: 8,
    overtime: 0,
    notes: ''
  });

  const [dieselForm, setDieselForm] = useState({
    date: new Date().toISOString().split('T')[0],
    harvester_id: '',
    operator_id: '',
    fuel_station: '',
    liters: '',
    price_per_liter: '',
    total_cost: '',
    odometer: ''
  });

  const [fieldworkForm, setFieldworkForm] = useState({
    date: new Date().toISOString().split('T')[0],
    village: '',
    farmer_name: '',
    farmer_mobile: '',
    sugar_mill: '',
    work_order_number: '',
    harvester_id: '',
    operator_id: '',
    running_hours: 8,
    idle_hours: 1,
    breakdown_hours: 0,
    distance_travelled: '',
    tons_harvested: '',
    rate_per_ton: 350,
    notes: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    mill_name: '',
    farmer: '',
    village: '',
    tons: '',
    rate_per_ton: 350,
    gross_amount: '',
    advance: 0,
    balance: '',
    status: 'Pending'
  });

  useEffect(() => {
    if (showMainModal) {
      loadDropdowns();
    }
  }, [showMainModal]);

  const loadDropdowns = async () => {
    const listOps = await db.operators.filter(o => o.status === 'Active').toArray();
    const listHarvs = await db.harvesters.filter(h => h.status === 'Active').toArray();
    setOperators(listOps);
    setHarvesters(listHarvs);

    // Set initial IDs in forms
    if (listOps.length > 0) {
      setAttendanceForm(f => ({ ...f, operator_id: listOps[0].id }));
      setDieselForm(f => ({ ...f, operator_id: listOps[0].id }));
      setFieldworkForm(f => ({ ...f, operator_id: listOps[0].id }));
    }
    if (listHarvs.length > 0) {
      setDieselForm(f => ({ ...f, harvester_id: listHarvs[0].id }));
      setFieldworkForm(f => ({ ...f, harvester_id: listHarvs[0].id }));
    }
  };

  const closeModals = () => {
    setShowMainModal(false);
    setActiveForm(null);
  };

  // ----------------------------------------------------
  // SUBMISSIONS
  // ----------------------------------------------------

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    if (!attendanceForm.operator_id) return;
    
    const record = {
      id: generateUUID(),
      ...attendanceForm,
      working_hours: parseFloat(attendanceForm.working_hours) || 0,
      overtime: parseFloat(attendanceForm.overtime) || 0
    };
    
    await localDb.saveAttendance(record);
    alert('Crew attendance logged successfully!');
    closeModals();
    if (onSaveSuccess) onSaveSuccess();
  };

  const handleDieselSubmit = async (e) => {
    e.preventDefault();
    if (!dieselForm.harvester_id || !dieselForm.operator_id || !dieselForm.liters || !dieselForm.total_cost) return;

    const record = {
      id: generateUUID(),
      ...dieselForm,
      liters: parseFloat(dieselForm.liters) || 0,
      price_per_liter: parseFloat(dieselForm.price_per_liter) || 0,
      total_cost: parseFloat(dieselForm.total_cost) || 0,
      odometer: parseFloat(dieselForm.odometer) || 0
    };

    await localDb.saveDieselRefill(record);

    // Log expense
    const expenseRecord = {
      id: `exp-fuel-${record.id}`,
      date: record.date,
      category: 'Diesel',
      amount: record.total_cost,
      notes: `Diesel Refill (${record.liters}L) logged via Quick Add`,
      ref_id: record.id
    };
    await localDb.saveExpense(expenseRecord);

    alert('Diesel refill & expenses saved!');
    closeModals();
    if (onSaveSuccess) onSaveSuccess();
  };

  const handleFieldworkSubmit = async (e) => {
    e.preventDefault();
    if (!fieldworkForm.village || !fieldworkForm.farmer_name || !fieldworkForm.tons_harvested) return;

    const tons = parseFloat(fieldworkForm.tons_harvested) || 0;
    const rate = parseFloat(fieldworkForm.rate_per_ton) || 350;
    const running = parseFloat(fieldworkForm.running_hours) || 0;
    const calculatedIncome = tons * rate;

    const record = {
      id: generateUUID(),
      ...fieldworkForm,
      running_hours: running,
      idle_hours: parseFloat(fieldworkForm.idle_hours) || 0,
      breakdown_hours: parseFloat(fieldworkForm.breakdown_hours) || 0,
      distance_travelled: parseFloat(fieldworkForm.distance_travelled) || 0,
      tons_harvested: tons,
      rate_per_ton: rate,
      income: calculatedIncome,
      productivity: running > 0 ? parseFloat((tons / running).toFixed(2)) : 0
    };

    await localDb.saveFieldWork(record);

    // Auto log payment invoice
    const paymentRecord = {
      id: `pay-${record.id}`,
      mill_name: record.sugar_mill || 'Private Sugar Mill',
      date: record.date,
      farmer: record.farmer_name,
      village: record.village,
      tons: record.tons_harvested,
      rate_per_ton: record.rate_per_ton,
      gross_amount: calculatedIncome,
      advance: 0,
      balance: calculatedIncome,
      payment_date: '',
      status: 'Pending'
    };
    await localDb.savePayment(paymentRecord);

    alert('Harvest field work & pending invoice logged!');
    closeModals();
    if (onSaveSuccess) onSaveSuccess();
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentForm.mill_name || !paymentForm.farmer || !paymentForm.gross_amount) return;

    const record = {
      id: generateUUID(),
      ...paymentForm,
      tons: parseFloat(paymentForm.tons) || 0,
      rate_per_ton: parseFloat(paymentForm.rate_per_ton) || 0,
      gross_amount: parseFloat(paymentForm.gross_amount) || 0,
      advance: parseFloat(paymentForm.advance) || 0,
      balance: parseFloat(paymentForm.balance) || 0
    };

    if (record.status === 'Paid' && !record.payment_date) {
      record.payment_date = new Date().toISOString().split('T')[0];
    }

    await localDb.savePayment(record);
    alert('Payment invoice saved!');
    closeModals();
    if (onSaveSuccess) onSaveSuccess();
  };

  const handleDieselCalc = (litersVal, priceVal) => {
    const l = parseFloat(litersVal) || 0;
    const p = parseFloat(priceVal) || 0;
    setDieselForm({
      ...dieselForm,
      liters: litersVal,
      price_per_liter: priceVal,
      total_cost: l > 0 && p > 0 ? (l * p).toFixed(2) : dieselForm.total_cost
    });
  };

  const handlePaymentCalc = (tonsVal, rateVal, advanceVal) => {
    const t = parseFloat(tonsVal) || 0;
    const r = parseFloat(rateVal) || 0;
    const a = parseFloat(advanceVal) || 0;
    const gross = parseFloat((t * r).toFixed(2));
    const bal = parseFloat((gross - a).toFixed(2));
    
    let status = 'Pending';
    if (a > 0 && bal > 0) status = 'Partial';
    if (bal <= 0) status = 'Paid';

    setPaymentForm({
      ...paymentForm,
      tons: tonsVal,
      rate_per_ton: rateVal,
      advance: advanceVal,
      gross_amount: gross,
      balance: bal,
      status
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <button className="fab" onClick={() => setShowMainModal(true)} title="Quick Add Shortcut">
        <svg className="fab-icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
      </button>

      {showMainModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {activeForm === 'attendance' && 'Quick Add: Crew Attendance'}
                {activeForm === 'diesel' && 'Quick Add: Fuel Refill'}
                {activeForm === 'fieldwork' && 'Quick Add: Field Work Log'}
                {activeForm === 'payment' && 'Quick Add: Mill Invoice'}
                {!activeForm && 'Quick Add Actions'}
              </h3>
              <button className="modal-close" onClick={closeModals}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="modal-body">
              {!activeForm ? (
                /* Mode Selector grid */
                <div className="quick-add-grid">
                  <button className="quick-add-btn" onClick={() => setActiveForm('attendance')}>
                    <svg className="quick-add-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>
                    <span className="quick-add-btn-label">Attendance</span>
                  </button>

                  <button className="quick-add-btn" onClick={() => setActiveForm('diesel')}>
                    <svg className="quick-add-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 2v20M21 21v-4a4 4 0 0 0-3-3.87" /><circle cx="12" cy="12" r="3" /></svg>
                    <span className="quick-add-btn-label">Diesel Refill</span>
                  </button>

                  <button className="quick-add-btn" onClick={() => setActiveForm('fieldwork')}>
                    <svg className="quick-add-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    <span className="quick-add-btn-label">Field Work</span>
                  </button>

                  <button className="quick-add-btn" onClick={() => setActiveForm('payment')}>
                    <svg className="quick-add-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
                    <span className="quick-add-btn-label">Mill Payment</span>
                  </button>
                </div>
              ) : (
                /* Actual Forms */
                <>
                  {activeForm === 'attendance' && (
                    <form onSubmit={handleAttendanceSubmit}>
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="form-group">
                          <label className="form-label">Operator *</label>
                          <select className="form-control" value={attendanceForm.operator_id} onChange={(e) => setAttendanceForm({ ...attendanceForm, operator_id: e.target.value })} required>
                            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Date *</label>
                          <input type="date" className="form-control" value={attendanceForm.date} onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Status *</label>
                          <select className="form-control" value={attendanceForm.status} onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value })} required>
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                            <option value="Half Day">Half Day</option>
                            <option value="Leave">Leave</option>
                          </select>
                        </div>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">Hours</label>
                            <input type="number" step="0.5" className="form-control" value={attendanceForm.working_hours} onChange={(e) => setAttendanceForm({ ...attendanceForm, working_hours: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Overtime</label>
                            <input type="number" step="0.5" className="form-control" value={attendanceForm.overtime} onChange={(e) => setAttendanceForm({ ...attendanceForm, overtime: e.target.value })} />
                          </div>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Log Attendance</button>
                      </div>
                    </form>
                  )}

                  {activeForm === 'diesel' && (
                    <form onSubmit={handleDieselSubmit}>
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="form-group">
                          <label className="form-label">Harvester *</label>
                          <select className="form-control" value={dieselForm.harvester_id} onChange={(e) => setDieselForm({ ...dieselForm, harvester_id: e.target.value })} required>
                            {harvesters.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Operator *</label>
                          <select className="form-control" value={dieselForm.operator_id} onChange={(e) => setDieselForm({ ...dieselForm, operator_id: e.target.value })} required>
                            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </div>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">Liters *</label>
                            <input type="number" step="0.01" className="form-control" value={dieselForm.liters} onChange={(e) => handleDieselCalc(e.target.value, dieselForm.price_per_liter)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Price/L</label>
                            <input type="number" step="0.01" className="form-control" value={dieselForm.price_per_liter} onChange={(e) => handleDieselCalc(dieselForm.liters, e.target.value)} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Total Cost (₹) *</label>
                          <input type="number" step="0.01" className="form-control" value={dieselForm.total_cost} onChange={(e) => setDieselForm({ ...dieselForm, total_cost: e.target.value })} required />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Fuel Refill</button>
                      </div>
                    </form>
                  )}

                  {activeForm === 'fieldwork' && (
                    <form onSubmit={handleFieldworkSubmit}>
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">Village *</label>
                            <input type="text" className="form-control" value={fieldworkForm.village} onChange={(e) => setFieldworkForm({ ...fieldworkForm, village: e.target.value })} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Sugar Mill *</label>
                            <input type="text" className="form-control" value={fieldworkForm.sugar_mill} onChange={(e) => setFieldworkForm({ ...fieldworkForm, sugar_mill: e.target.value })} required />
                          </div>
                        </div>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">Farmer *</label>
                            <input type="text" className="form-control" value={fieldworkForm.farmer_name} onChange={(e) => setFieldworkForm({ ...fieldworkForm, farmer_name: e.target.value })} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Tons *</label>
                            <input type="number" step="0.01" className="form-control" value={fieldworkForm.tons_harvested} onChange={(e) => setFieldworkForm({ ...fieldworkForm, tons_harvested: e.target.value })} required />
                          </div>
                        </div>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">Harvester *</label>
                            <select className="form-control" value={fieldworkForm.harvester_id} onChange={(e) => setFieldworkForm({ ...fieldworkForm, harvester_id: e.target.value })} required>
                              {harvesters.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Operator *</label>
                            <select className="form-control" value={fieldworkForm.operator_id} onChange={(e) => setFieldworkForm({ ...fieldworkForm, operator_id: e.target.value })} required>
                              {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Log Work</button>
                      </div>
                    </form>
                  )}

                  {activeForm === 'payment' && (
                    <form onSubmit={handlePaymentSubmit}>
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="form-group">
                          <label className="form-label">Mill Name *</label>
                          <input type="text" className="form-control" value={paymentForm.mill_name} onChange={(e) => setPaymentForm({ ...paymentForm, mill_name: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Farmer Name *</label>
                          <input type="text" className="form-control" value={paymentForm.farmer} onChange={(e) => setPaymentForm({ ...paymentForm, farmer: e.target.value })} required />
                        </div>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">Tons *</label>
                            <input type="number" step="0.01" className="form-control" value={paymentForm.tons} onChange={(e) => handlePaymentCalc(e.target.value, paymentForm.rate_per_ton, paymentForm.advance)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Rate/T</label>
                            <input type="number" className="form-control" value={paymentForm.rate_per_ton} onChange={(e) => handlePaymentCalc(paymentForm.tons, e.target.value, paymentForm.advance)} required />
                          </div>
                        </div>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">Gross Amount (₹)</label>
                            <input type="number" className="form-control" value={paymentForm.gross_amount} disabled />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Advance (₹)</label>
                            <input type="number" className="form-control" value={paymentForm.advance} onChange={(e) => handlePaymentCalc(paymentForm.tons, paymentForm.rate_per_ton, e.target.value)} />
                          </div>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Create Invoice</button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>

            {activeForm && (
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveForm(null)}>Back</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
