import React, { useState, useEffect } from 'react';
import { db, localDb } from '../db.js';
import { generateUUID, formatDate, formatCurrency } from '../utils.js';

export default function Attendance() {
  const [operators, setOperators] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyAttendance, setDailyAttendance] = useState({});
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' or 'monthly'
  
  // Monthly parameters
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [monthlySummaries, setMonthlySummaries] = useState([]);

  useEffect(() => {
    loadCrewAndAttendance();
  }, [selectedDate, activeTab]);

  useEffect(() => {
    if (activeTab === 'monthly') {
      calculateMonthlySummaries();
    }
  }, [summaryMonth, summaryYear, activeTab]);

  const loadCrewAndAttendance = async () => {
    const crew = await db.operators.filter(op => op.status === 'Active').toArray();
    setOperators(crew);

    // Fetch existing attendance logs for the selected date
    const logs = await db.attendance.where('date').equals(selectedDate).toArray();
    
    const logsMap = {};
    logs.forEach(log => {
      logsMap[log.operator_id] = log;
    });

    // Populate daily attendance state. Default to Present with 8 hours if no entry exists
    const initialDaily = {};
    crew.forEach(op => {
      if (logsMap[op.id]) {
        initialDaily[op.id] = { ...logsMap[op.id] };
      } else {
        initialDaily[op.id] = {
          id: generateUUID(),
          date: selectedDate,
          operator_id: op.id,
          status: 'Present',
          start_time: '08:00',
          end_time: '17:00',
          working_hours: 8,
          overtime: 0,
          notes: ''
        };
      }
    });
    
    setDailyAttendance(initialDaily);
  };

  const handleStatusChange = (opId, status) => {
    const entry = { ...dailyAttendance[opId], status };
    if (status === 'Absent' || status === 'Leave') {
      entry.start_time = '';
      entry.end_time = '';
      entry.working_hours = 0;
      entry.overtime = 0;
    } else if (status === 'Half Day') {
      entry.start_time = '08:00';
      entry.end_time = '12:00';
      entry.working_hours = 4;
      entry.overtime = 0;
    } else { // Present
      entry.start_time = '08:00';
      entry.end_time = '17:00';
      entry.working_hours = 8;
      entry.overtime = 0;
    }
    setDailyAttendance({ ...dailyAttendance, [opId]: entry });
  };

  const calculateHours = (opId, start, end) => {
    const entry = { ...dailyAttendance[opId], start_time: start, end_time: end };
    if (start && end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      
      let diffMins = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMins < 0) diffMins += 24 * 60; // crossover midnight
      
      const totalHrs = parseFloat((diffMins / 60).toFixed(2));
      // Standard shift is 8 hours, rest is overtime
      entry.working_hours = totalHrs > 8 ? 8 : totalHrs;
      entry.overtime = totalHrs > 8 ? parseFloat((totalHrs - 8).toFixed(2)) : 0;
    }
    setDailyAttendance({ ...dailyAttendance, [opId]: entry });
  };

  const handleNotesChange = (opId, val) => {
    setDailyAttendance({
      ...dailyAttendance,
      [opId]: { ...dailyAttendance[opId], notes: val }
    });
  };

  const handleSaveAll = async () => {
    try {
      const entries = Object.values(dailyAttendance);
      for (const entry of entries) {
        await localDb.saveAttendance(entry);
      }
      alert('Attendance for ' + formatDate(selectedDate) + ' saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save attendance logs.');
    }
  };

  const calculateMonthlySummaries = async () => {
    const crew = await db.operators.toArray();
    const daysInMonth = new Date(summaryYear, summaryMonth, 0).getDate();
    const startStr = `${summaryYear}-${String(summaryMonth).padStart(2, '0')}-01`;
    const endStr = `${summaryYear}-${String(summaryMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // Get attendance for the month
    const mLogs = await db.attendance
      .filter(a => a.date >= startStr && a.date <= endStr)
      .toArray();

    // Get field work records to calculate harvested tons for "Per Ton" salary type
    const mFieldWork = await db.field_work
      .filter(f => f.date >= startStr && f.date <= endStr)
      .toArray();

    const summaries = crew.map(op => {
      const opLogs = mLogs.filter(l => l.operator_id === op.id);
      
      const presentCount = opLogs.filter(l => l.status === 'Present').length;
      const halfDayCount = opLogs.filter(l => l.status === 'Half Day').length;
      const leaveCount = opLogs.filter(l => l.status === 'Leave').length;
      const absentCount = opLogs.filter(l => l.status === 'Absent').length;
      
      const workHours = opLogs.reduce((sum, l) => sum + (parseFloat(l.working_hours) || 0), 0);
      const overtimeHours = opLogs.reduce((sum, l) => sum + (parseFloat(l.overtime) || 0), 0);

      // Aggregate Tons Harvested by this operator
      const opFieldWork = mFieldWork.filter(f => f.operator_id === op.id);
      const totalTons = opFieldWork.reduce((sum, f) => sum + (parseFloat(f.tons_harvested) || 0), 0);

      // Calculate Wages
      let baseWages = 0;
      let otWages = 0;
      let calculatedSalary = 0;

      // Overtime Rate: Assume standard rate of ₹150/hr for simplicity
      const otRate = 150;
      otWages = overtimeHours * otRate;

      if (op.salary_type === 'Monthly') {
        // Full base salary, proportional to days attended
        const activeDays = presentCount + (halfDayCount * 0.5);
        // Assume standard 26 working days in a month
        const workingDaysBase = 26;
        calculatedSalary = activeDays >= workingDaysBase ? op.salary_amount : (activeDays / workingDaysBase) * op.salary_amount;
      } else if (op.salary_type === 'Daily') {
        const activeDays = presentCount + (halfDayCount * 0.5);
        calculatedSalary = activeDays * op.salary_amount;
      } else if (op.salary_type === 'Per Ton') {
        calculatedSalary = totalTons * op.salary_amount;
      }

      baseWages = calculatedSalary;
      const grossSalary = baseWages + otWages;

      return {
        operator: op,
        present: presentCount,
        halfDay: halfDayCount,
        leave: leaveCount,
        absent: absentCount,
        hours: workHours,
        overtime: overtimeHours,
        tons: totalTons,
        baseWages,
        otWages,
        grossSalary
      };
    });

    setMonthlySummaries(summaries);
  };

  const saveSalaryPayment = async (summary) => {
    if (window.confirm(`Mark salary of ${formatCurrency(summary.grossSalary)} as PAID for ${summary.operator.name}?`)) {
      const salaryRecord = {
        id: `${summary.operator.id}-${summaryMonth}-${summaryYear}`,
        operator_id: summary.operator.id,
        month: summaryMonth,
        year: summaryYear,
        attendance_count: summary.present,
        working_hours: summary.hours,
        overtime_hours: summary.overtime,
        salary_type: summary.operator.salary_type,
        salary_amount: summary.operator.salary_amount,
        deductions: 0,
        net_salary: summary.grossSalary,
        payment_date: new Date().toISOString().split('T')[0],
        status: 'Paid'
      };

      // Save salary log
      await localDb.saveSalary(salaryRecord);

      // Automatically register as an Expense
      const expenseRecord = {
        id: generateUUID(),
        date: new Date().toISOString().split('T')[0],
        category: 'Salary',
        amount: summary.grossSalary,
        notes: `Salary Paid to ${summary.operator.name} for ${summaryMonth}/${summaryYear}`,
        ref_id: salaryRecord.id
      };
      await localDb.saveExpense(expenseRecord);

      alert(`Salary payment successfully recorded and logged under expenses!`);
    }
  };

  return (
    <div className="attendance-view">
      {/* Subnavigation Tabs */}
      <div className="content-card" style={{ padding: '0.75rem', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        <button 
          className={`btn ${activeTab === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('daily')}
          style={{ flexGrow: 1 }}
        >
          Daily Log Grid
        </button>
        <button 
          className={`btn ${activeTab === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('monthly')}
          style={{ flexGrow: 1 }}
        >
          Monthly Attendance & Salary Calculator
        </button>
      </div>

      {activeTab === 'daily' ? (
        <div className="content-card">
          <div className="filters-panel" style={{ justifyContent: 'space-between' }}>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '1rem' }}>
              <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Attendance Date:</label>
              <input 
                type="date" 
                className="form-control" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: '200px' }}
              />
            </div>
            <button className="btn btn-primary" onClick={handleSaveAll}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8"/></svg>
              Save Daily Log
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Operator Name</th>
                  <th>Attendance Status</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Duty Hours</th>
                  <th>Overtime</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {operators.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No active operators found. Add active operators in Operators tab first.
                    </td>
                  </tr>
                ) : (
                  operators.map(op => {
                    const entry = dailyAttendance[op.id] || {};
                    const isOff = entry.status === 'Absent' || entry.status === 'Leave';
                    return (
                      <tr key={op.id}>
                        <td style={{ fontWeight: '600' }}>{op.name}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {['Present', 'Absent', 'Half Day', 'Leave'].map(st => (
                              <button
                                key={st}
                                type="button"
                                className="btn"
                                onClick={() => handleStatusChange(op.id, st)}
                                style={{
                                  padding: '0.375rem 0.625rem',
                                  fontSize: '0.75rem',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: entry.status === st 
                                    ? (st === 'Present' ? 'var(--success)' : st === 'Absent' ? 'var(--danger)' : st === 'Half Day' ? 'var(--pending)' : 'var(--text-muted)')
                                    : 'var(--bg-app)',
                                  color: entry.status === st ? 'var(--text-inverse)' : 'var(--text-main)',
                                  border: entry.status === st ? 'none' : '1px solid var(--border-color)',
                                  fontWeight: '600'
                                }}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input 
                            type="time" 
                            className="form-control" 
                            value={entry.start_time || ''}
                            onChange={(e) => calculateHours(op.id, e.target.value, entry.end_time)}
                            disabled={isOff}
                            style={{ width: '100px', padding: '0.375rem' }}
                          />
                        </td>
                        <td>
                          <input 
                            type="time" 
                            className="form-control" 
                            value={entry.end_time || ''}
                            onChange={(e) => calculateHours(op.id, entry.start_time, e.target.value)}
                            disabled={isOff}
                            style={{ width: '100px', padding: '0.375rem' }}
                          />
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {entry.working_hours || 0} hrs
                        </td>
                        <td style={{ fontWeight: '600', color: (entry.overtime > 0) ? 'var(--success)' : 'inherit' }}>
                          {entry.overtime || 0} hrs
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="Add brief note..."
                            value={entry.notes || ''}
                            onChange={(e) => handleNotesChange(op.id, e.target.value)}
                            style={{ padding: '0.375rem', fontSize: '0.8125rem' }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="content-card">
          <div className="filters-panel">
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label className="form-label">Month:</label>
              <select 
                className="filter-select"
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(parseInt(e.target.value))}
                style={{ minWidth: '120px' }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i+1} value={i+1}>
                    {new Date(2000, i, 1).toLocaleDateString('en-IN', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label className="form-label">Year:</label>
              <select 
                className="filter-select"
                value={summaryYear}
                onChange={(e) => setSummaryYear(parseInt(e.target.value))}
                style={{ minWidth: '100px' }}
              >
                {[2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Operator Name</th>
                  <th>Salary Profile</th>
                  <th>Attendance Summary</th>
                  <th>Total Hours</th>
                  <th>Tons Logged</th>
                  <th>Base wages</th>
                  <th>OT wages</th>
                  <th>Gross Salary</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummaries.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No data loaded.
                    </td>
                  </tr>
                ) : (
                  monthlySummaries.map((s, index) => (
                    <tr key={index}>
                      <td style={{ fontWeight: '600' }}>{s.operator.name}</td>
                      <td>
                        <div style={{ fontWeight: '500' }}>{formatCurrency(s.operator.salary_amount)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Per {s.operator.salary_type}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--success)' }}>✔ Present: {s.present}</span> | 
                          <span style={{ color: 'var(--pending)' }}> ½ Day: {s.halfDay}</span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          ✖ Absent: {s.absent} | 🏖 Leave: {s.leave}
                        </div>
                      </td>
                      <td>
                        <div>Duty: {s.hours} hrs</div>
                        <div style={{ color: 'var(--success)', fontSize: '0.8125rem' }}>OT: {s.overtime} hrs</div>
                      </td>
                      <td style={{ fontWeight: '500' }}>
                        {s.operator.salary_type === 'Per Ton' ? `${s.tons} Tons` : 'N/A'}
                      </td>
                      <td>{formatCurrency(s.baseWages)}</td>
                      <td>{formatCurrency(s.otWages)}</td>
                      <td style={{ fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(s.grossSalary)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-primary"
                          onClick={() => saveSalaryPayment(s)}
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          Mark Paid
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
