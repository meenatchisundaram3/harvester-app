import React, { useState, useEffect } from 'react';
import { db } from '../db.js';
import { formatDate, formatCurrency } from '../utils.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default function Reports() {
  const [reportType, setReportType] = useState('ProfitLoss');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Start of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState([]);
  const [reportTotals, setReportTotals] = useState({});

  useEffect(() => {
    generateReport();
  }, [reportType, startDate, endDate]);

  const generateReport = async () => {
    let data = [];
    let totals = {};

    switch (reportType) {
      case 'ProfitLoss': {
        // Fetch field work income
        const fields = await db.field_work
          .filter(f => f.date >= startDate && f.date <= endDate)
          .toArray();
        const totalIncome = fields.reduce((sum, f) => sum + (parseFloat(f.income) || 0), 0);

        // Fetch general expenses
        const expenses = await db.expenses
          .filter(e => e.date >= startDate && e.date <= endDate)
          .toArray();
        const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        data = [
          { particulars: 'Total Harvesting Income', income: totalIncome, expenses: 0 },
          ...expenses.map(e => ({ particulars: `Expense: ${e.category} (${e.notes || ''})`, income: 0, expenses: e.amount })),
          { particulars: 'NET PROFIT / LOSS', income: totalIncome > totalExpenses ? totalIncome - totalExpenses : 0, expenses: totalExpenses > totalIncome ? totalExpenses - totalIncome : 0, isPLSummary: true }
        ];

        totals = {
          income: totalIncome,
          expenses: totalExpenses,
          profit: totalIncome - totalExpenses
        };
        break;
      }
      case 'Attendance': {
        const list = await db.attendance
          .filter(a => a.date >= startDate && a.date <= endDate)
          .toArray();
        const crew = await db.operators.toArray();

        data = crew.map(op => {
          const opLogs = list.filter(l => l.operator_id === op.id);
          const present = opLogs.filter(l => l.status === 'Present').length;
          const halfDay = opLogs.filter(l => l.status === 'Half Day').length;
          const absent = opLogs.filter(l => l.status === 'Absent').length;
          const leave = opLogs.filter(l => l.status === 'Leave').length;
          const hours = opLogs.reduce((sum, l) => sum + (parseFloat(l.working_hours) || 0), 0);
          const ot = opLogs.reduce((sum, l) => sum + (parseFloat(l.overtime) || 0), 0);

          return {
            name: op.name,
            salary_type: op.salary_type,
            present,
            halfDay,
            absent,
            leave,
            hours,
            overtime: ot
          };
        });
        break;
      }
      case 'Diesel': {
        const list = await db.diesel_refills
          .filter(d => d.date >= startDate && d.date <= endDate)
          .toArray();
        const harvs = await db.harvesters.toArray();
        const ops = await db.operators.toArray();

        data = list.map(r => ({
          date: r.date,
          harvester: harvs.find(h => h.id === r.harvester_id)?.name || 'Harvester',
          operator: ops.find(o => o.id === r.operator_id)?.name || 'Operator',
          station: r.fuel_station || 'HP Station',
          liters: r.liters,
          price: r.price_per_liter,
          cost: r.total_cost,
          odometer: r.odometer || 'N/A'
        }));

        totals = {
          liters: list.reduce((sum, r) => sum + r.liters, 0),
          cost: list.reduce((sum, r) => sum + r.total_cost, 0)
        };
        break;
      }
      case 'RunningHours': {
        const list = await db.running_hours
          .filter(h => h.date >= startDate && h.date <= endDate)
          .toArray();
        const harvs = await db.harvesters.toArray();

        data = list.map(l => ({
          date: l.date,
          harvester: harvs.find(h => h.id === l.harvester_id)?.name || 'Harvester',
          start_time: l.start_time,
          stop_time: l.stop_time,
          running: l.running_hours,
          idle: l.idle_hours,
          breakdown: l.breakdown_hours
        }));

        totals = {
          running: list.reduce((sum, l) => sum + l.running_hours, 0),
          idle: list.reduce((sum, l) => sum + l.idle_hours, 0),
          breakdown: list.reduce((sum, l) => sum + l.breakdown_hours, 0)
        };
        break;
      }
      case 'FieldWork': {
        const list = await db.field_work
          .filter(f => f.date >= startDate && f.date <= endDate)
          .toArray();
        const harvs = await db.harvesters.toArray();
        const ops = await db.operators.toArray();

        data = list.map(f => ({
          date: f.date,
          village: f.village,
          farmer: f.farmer_name,
          mill: f.sugar_mill,
          harvester: harvs.find(h => h.id === f.harvester_id)?.name || 'Harvester',
          operator: ops.find(o => o.id === f.operator_id)?.name || 'Operator',
          running: f.running_hours,
          tons: f.tons_harvested,
          productivity: f.productivity,
          income: f.income
        }));

        totals = {
          hours: list.reduce((sum, f) => sum + f.running, 0),
          tons: list.reduce((sum, f) => sum + f.tons_harvested, 0),
          income: list.reduce((sum, f) => sum + f.income, 0)
        };
        break;
      }
      case 'Payment': {
        const list = await db.payments
          .filter(p => p.date >= startDate && p.date <= endDate)
          .toArray();

        data = list.map(p => ({
          date: p.date,
          mill: p.mill_name,
          farmer: p.farmer,
          village: p.village || 'N/A',
          tons: p.tons,
          gross: p.gross_amount,
          advance: p.advance,
          balance: p.balance,
          status: p.status
        }));

        totals = {
          gross: list.reduce((sum, p) => sum + p.gross_amount, 0),
          advance: list.reduce((sum, p) => sum + p.advance, 0),
          balance: list.reduce((sum, p) => sum + p.balance, 0)
        };
        break;
      }
      case 'Expense': {
        const list = await db.expenses
          .filter(e => e.date >= startDate && e.date <= endDate)
          .toArray();

        data = list.map(e => ({
          date: e.date,
          category: e.category,
          amount: e.amount,
          notes: e.notes || 'N/A'
        }));

        totals = {
          cost: list.reduce((sum, e) => sum + e.amount, 0)
        };
        break;
      }
      case 'Salary': {
        const list = await db.salary.toArray();
        const ops = await db.operators.toArray();

        // Salaries are stored monthly, filter by month/year overlap
        const start = new Date(startDate);
        const end = new Date(endDate);

        data = list
          .filter(s => {
            const sd = new Date(s.year, s.month - 1, 1);
            return sd >= start && sd <= end;
          })
          .map(s => ({
            period: `${String(s.month).padStart(2, '0')}/${s.year}`,
            operator: ops.find(o => o.id === s.operator_id)?.name || 'Operator',
            attendance: s.attendance_count,
            salary_type: s.salary_type,
            rate: s.salary_amount,
            net: s.net_salary,
            paid_date: s.payment_date ? formatDate(s.payment_date) : 'Pending'
          }));
        break;
      }
      default:
        break;
    }

    setReportData(data);
    setReportTotals(totals);
  };

  const handleExportExcel = () => {
    if (reportData.length === 0) {
      alert('No data available to export.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report Sheet');
    XLSX.writeFile(wb, `Harvester_${reportType}_Report_${startDate}_to_${endDate}.xlsx`);
  };

  const handleExportPDF = () => {
    if (reportData.length === 0) {
      alert('No data available to export.');
      return;
    }

    const doc = new jsPDF();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(27, 67, 50); // Forest green header
    doc.text('HARVESTER OWNER BUSINESS REPORTS', 14, 15);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Report Type: ${reportType} | Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, 14, 21);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 26);

    let headers = [];
    let rows = [];

    if (reportType === 'ProfitLoss') {
      headers = [['Particulars', 'Income (₹)', 'Expenses (₹)']];
      rows = reportData.map(r => [r.particulars, r.income ? formatCurrency(r.income) : '', r.expenses ? formatCurrency(r.expenses) : '']);
    } else if (reportType === 'Attendance') {
      headers = [['Operator', 'Salary Type', 'Present', '½ Day', 'Absent', 'Leave', 'Hours', 'OT Hours']];
      rows = reportData.map(r => [r.name, r.salary_type, r.present, r.halfDay, r.absent, r.leave, `${r.hours}h`, `${r.overtime}h`]);
    } else if (reportType === 'Diesel') {
      headers = [['Date', 'Harvester', 'Operator', 'Station', 'Liters', 'Rate', 'Cost', 'Odometer']];
      rows = reportData.map(r => [formatDate(r.date), r.harvester, r.operator, r.station, `${r.liters} L`, formatCurrency(r.price), formatCurrency(r.cost), r.odometer]);
    } else if (reportType === 'RunningHours') {
      headers = [['Date', 'Harvester', 'Start', 'Stop', 'Running', 'Idle', 'Breakdown']];
      rows = reportData.map(r => [formatDate(r.date), r.harvester, r.start_time, r.stop_time, `${r.running}h`, `${r.idle}h`, `${r.breakdown}h`]);
    } else if (reportType === 'FieldWork') {
      headers = [['Date', 'Farmer/Village', 'Harvester', 'Operator', 'Hours', 'Tons', 'Productivity', 'Gross Income']];
      rows = reportData.map(r => [formatDate(r.date), `${r.farmer} (${r.village})`, r.harvester, r.operator, `${r.running}h`, `${r.tons}t`, `${r.productivity} t/h`, formatCurrency(r.income)]);
    } else if (reportType === 'Payment') {
      headers = [['Date', 'Mill Name', 'Farmer', 'Tons', 'Gross Amount', 'Advance', 'Balance', 'Status']];
      rows = reportData.map(r => [formatDate(r.date), r.mill, r.farmer, `${r.tons}t`, formatCurrency(r.gross), formatCurrency(r.advance), formatCurrency(r.balance), r.status]);
    } else if (reportType === 'Expense') {
      headers = [['Date', 'Category', 'Notes', 'Amount']];
      rows = reportData.map(r => [formatDate(r.date), r.category, r.notes, formatCurrency(r.amount)]);
    } else if (reportType === 'Salary') {
      headers = [['Period', 'Operator', 'Days Present', 'Salary Type', 'Salary Rate', 'Net Salary Paid', 'Date Paid']];
      rows = reportData.map(r => [r.period, r.operator, r.attendance, r.salary_type, formatCurrency(r.rate), formatCurrency(r.net), r.paid_date]);
    }

    doc.autoTable({
      head: headers,
      body: rows,
      startY: 32,
      theme: 'striped',
      headStyles: { fillColor: [45, 106, 79] },
      styles: { fontSize: 8 },
      margin: { top: 30 }
    });

    doc.save(`Harvester_${reportType}_Report_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="reports-view">
      <div className="content-card">
        {/* Report configuration filters */}
        <div className="filters-panel">
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <label className="form-label">Report Type:</label>
            <select 
              className="filter-select"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="ProfitLoss">Profit & Loss Report</option>
              <option value="Attendance">Attendance Summary</option>
              <option value="Diesel">Fuel Refills Log</option>
              <option value="RunningHours">Machine Duty Hours</option>
              <option value="FieldWork">Daily Harvest logs</option>
              <option value="Payment">Mill Payments Account</option>
              <option value="Expense">Business Expenses</option>
              <option value="Salary">Salaries Logged</option>
            </select>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <label className="form-label">From:</label>
            <input 
              type="date" 
              className="form-control" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '150px' }}
            />
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <label className="form-label">To:</label>
            <input 
              type="date" 
              className="form-control" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '150px' }}
            />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={handleExportExcel}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--success)' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 12h8M8 16h6"/></svg>
              Export Excel
            </button>
            <button className="btn btn-secondary" onClick={handleExportPDF}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--danger)' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/></svg>
              Export PDF
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--primary)' }}>
          Report Preview: {reportType}
        </h3>
        
        <div className="table-container">
          {reportType === 'ProfitLoss' && (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Particulars Description</th>
                  <th style={{ textAlign: 'right' }}>Revenue / Credits (₹)</th>
                  <th style={{ textAlign: 'right' }}>Expenses / Debits (₹)</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, i) => (
                  <tr key={i} style={{ 
                    fontWeight: r.isPLSummary ? 'bold' : 'normal',
                    backgroundColor: r.isPLSummary ? 'rgba(64, 145, 108, 0.1)' : 'inherit',
                    borderTop: r.isPLSummary ? '2px solid var(--border-color)' : 'none'
                  }}>
                    <td>{r.particulars}</td>
                    <td style={{ textAlign: 'right', color: r.income > 0 ? 'var(--success)' : 'inherit' }}>
                      {r.income > 0 ? formatCurrency(r.income) : ''}
                    </td>
                    <td style={{ textAlign: 'right', color: r.expenses > 0 ? 'var(--danger)' : 'inherit' }}>
                      {r.expenses > 0 ? formatCurrency(r.expenses) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'Attendance' && (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Operator Name</th>
                  <th>Salary Type</th>
                  <th>Present</th>
                  <th>Half Day</th>
                  <th>Absent</th>
                  <th>Leave</th>
                  <th>Duty Hours</th>
                  <th>Overtime</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: '600' }}>{r.name}</td>
                    <td>{r.salary_type}</td>
                    <td style={{ color: 'var(--success)', fontWeight: '600' }}>{r.present} d</td>
                    <td style={{ color: 'var(--pending)' }}>{r.halfDay} d</td>
                    <td style={{ color: 'var(--danger)' }}>{r.absent} d</td>
                    <td>{r.leave} d</td>
                    <td>{r.hours} hrs</td>
                    <td style={{ color: 'var(--success)', fontWeight: '600' }}>{r.overtime} hrs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'Diesel' && (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Harvester</th>
                  <th>Operator</th>
                  <th>Station</th>
                  <th>Liters</th>
                  <th>Price</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, i) => (
                  <tr key={i}>
                    <td>{formatDate(r.date)}</td>
                    <td style={{ fontWeight: '600' }}>{r.harvester}</td>
                    <td>{r.operator}</td>
                    <td>{r.station}</td>
                    <td style={{ fontWeight: '600' }}>{r.liters} L</td>
                    <td>{formatCurrency(r.price)}</td>
                    <td style={{ fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(r.cost)}</td>
                  </tr>
                ))}
                {reportData.length > 0 && (
                  <tr style={{ fontWeight: 'bold', background: 'rgba(0,0,0,0.02)' }}>
                    <td colSpan="4">Monthly Total:</td>
                    <td>{reportTotals.liters?.toFixed(2)} L</td>
                    <td></td>
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(reportTotals.cost)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {reportType === 'RunningHours' && (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Harvester</th>
                  <th>Start</th>
                  <th>Stop</th>
                  <th>Running</th>
                  <th>Idle</th>
                  <th>Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, i) => (
                  <tr key={i}>
                    <td>{formatDate(r.date)}</td>
                    <td style={{ fontWeight: '600' }}>{r.harvester}</td>
                    <td>{r.start_time}</td>
                    <td>{r.stop_time}</td>
                    <td style={{ fontWeight: '600' }}>{r.running} hrs</td>
                    <td>{r.idle} hrs</td>
                    <td style={{ color: r.breakdown > 0 ? 'var(--danger)' : 'inherit' }}>{r.breakdown} hrs</td>
                  </tr>
                ))}
                {reportData.length > 0 && (
                  <tr style={{ fontWeight: 'bold', background: 'rgba(0,0,0,0.02)' }}>
                    <td colSpan="4">Accumulated Total:</td>
                    <td style={{ color: 'var(--primary-light)' }}>{reportTotals.running?.toFixed(2)} hrs</td>
                    <td>{reportTotals.idle?.toFixed(2)} hrs</td>
                    <td style={{ color: 'var(--danger)' }}>{reportTotals.breakdown?.toFixed(2)} hrs</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {reportType === 'FieldWork' && (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Farmer / Location</th>
                  <th>Harvester</th>
                  <th>Operator</th>
                  <th>Hours Logged</th>
                  <th>Tons</th>
                  <th>Productivity</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, i) => (
                  <tr key={i}>
                    <td>{formatDate(r.date)}</td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{r.farmer}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Village: {r.village} | Mill: {r.mill}</div>
                    </td>
                    <td>{r.harvester}</td>
                    <td>{r.operator}</td>
                    <td>{r.running} hrs</td>
                    <td style={{ fontWeight: '600' }}>{r.tons} t</td>
                    <td><span className="badge badge-success">{r.productivity?.toFixed(2)} t/h</span></td>
                    <td style={{ fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(r.income)}</td>
                  </tr>
                ))}
                {reportData.length > 0 && (
                  <tr style={{ fontWeight: 'bold', background: 'rgba(0,0,0,0.02)' }}>
                    <td colSpan="4">Sum Total:</td>
                    <td>{reportTotals.hours?.toFixed(2)} hrs</td>
                    <td>{reportTotals.tons?.toFixed(2)} Tons</td>
                    <td></td>
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(reportTotals.income)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {reportType === 'Payment' && (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mill / Farmer</th>
                  <th>Tons Billed</th>
                  <th>Gross Amount</th>
                  <th>Advance</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, i) => (
                  <tr key={i}>
                    <td>{formatDate(r.date)}</td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{r.mill}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Farmer: {r.farmer} ({r.village})</div>
                    </td>
                    <td>{r.tons} t</td>
                    <td style={{ fontWeight: '600' }}>{formatCurrency(r.gross)}</td>
                    <td style={{ color: 'var(--primary-light)' }}>{formatCurrency(r.advance)}</td>
                    <td style={{ fontWeight: '700', color: r.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>{formatCurrency(r.balance)}</td>
                    <td>
                      <span className={`badge ${r.status === 'Paid' ? 'badge-success' : r.status === 'Partial' ? 'badge-warning' : 'badge-pending'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {reportData.length > 0 && (
                  <tr style={{ fontWeight: 'bold', background: 'rgba(0,0,0,0.02)' }}>
                    <td colSpan="3">Gross Summary Totals:</td>
                    <td style={{ color: 'var(--text-main)' }}>{formatCurrency(reportTotals.gross)}</td>
                    <td style={{ color: 'var(--primary-light)' }}>{formatCurrency(reportTotals.advance)}</td>
                    <td style={{ color: 'var(--warning)' }}>{formatCurrency(reportTotals.balance)}</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {reportType === 'Expense' && (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Details Notes</th>
                  <th>Cost Paid</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, i) => (
                  <tr key={i}>
                    <td>{formatDate(r.date)}</td>
                    <td><span className="badge badge-pending">{r.category}</span></td>
                    <td>{r.notes}</td>
                    <td style={{ fontWeight: '700', color: 'var(--danger)' }}>{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
                {reportData.length > 0 && (
                  <tr style={{ fontWeight: 'bold', background: 'rgba(0,0,0,0.02)' }}>
                    <td colSpan="3">Combined Operating Costs:</td>
                    <td style={{ color: 'var(--danger)' }}>{formatCurrency(reportTotals.cost)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {reportType === 'Salary' && (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Operator Name</th>
                  <th>Days Present</th>
                  <th>Salary Rate</th>
                  <th>Net Payout</th>
                  <th>Settled Date</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: '600' }}>{r.period}</td>
                    <td style={{ fontWeight: '600' }}>{r.operator}</td>
                    <td>{r.attendance} days</td>
                    <td>{formatCurrency(r.rate)} ({r.salary_type})</td>
                    <td style={{ fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(r.net)}</td>
                    <td>{r.paid_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
