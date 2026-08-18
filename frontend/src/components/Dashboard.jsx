import React, { useState, useEffect } from 'react';
import { db } from '../db.js';
import { formatCurrency } from '../utils.js';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    operatorsPresent: 0,
    runningHours: 0,
    dieselUsed: 0,
    tonsHarvested: 0,
    income: 0,
    expenses: 0,
    pendingPayments: 0,
    netProfit: 0
  });

  const [chartsData, setChartsData] = useState({
    diesel: [],
    hours: [],
    monthlyPL: [],
    productivity: []
  });

  const [activeNotification, setActiveNotification] = useState(null);
  const [fleetList, setFleetList] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. Operators Present today
    const todayAttendance = await db.attendance
      .where('date')
      .equals(todayStr)
      .toArray();
    const presentCount = todayAttendance.filter(a => a.status === 'Present' || a.status === 'Half Day').length;

    // 2. Running Hours today
    const todayHoursLog = await db.running_hours
      .where('date')
      .equals(todayStr)
      .toArray();
    const totalHoursToday = todayHoursLog.reduce((sum, h) => sum + (parseFloat(h.running_hours) || 0), 0);

    // 3. Diesel Used today
    const todayDiesel = await db.diesel_refills
      .where('date')
      .equals(todayStr)
      .toArray();
    const totalDieselToday = todayDiesel.reduce((sum, d) => sum + (parseFloat(d.liters) || 0), 0);

    // 4. Tons Harvested today
    const todayField = await db.field_work
      .where('date')
      .equals(todayStr)
      .toArray();
    const totalTonsToday = todayField.reduce((sum, f) => sum + (parseFloat(f.tons_harvested) || 0), 0);

    // 5. Today's Income
    const totalIncomeToday = todayField.reduce((sum, f) => sum + (parseFloat(f.income) || 0), 0);

    // 6. Today's Expenses
    const todayExpenses = await db.expenses
      .where('date')
      .equals(todayStr)
      .toArray();
    const totalExpensesToday = todayExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // 7. Pending Mill Payments (Total across history)
    const pendingInvoices = await db.payments
      .filter(p => p.status === 'Pending' || p.status === 'Partial')
      .toArray();
    const totalPending = pendingInvoices.reduce((sum, p) => sum + (parseFloat(p.balance) || 0), 0);

    // 8. Net Profit today
    const netProfitToday = totalIncomeToday - totalExpensesToday;

    setStats({
      operatorsPresent: presentCount,
      runningHours: totalHoursToday,
      dieselUsed: totalDieselToday,
      tonsHarvested: totalTonsToday,
      income: totalIncomeToday,
      expenses: totalExpensesToday,
      pendingPayments: totalPending,
      netProfit: netProfitToday
    });

    // 9. Load fleet vehicles
    const harvs = await db.harvesters.toArray();
    setFleetList(harvs);

    // 10. Load notification alerts (like pending engine maintenance or expiring insurance)
    const unreadAlerts = await db.notifications
      .filter(n => !n.is_read)
      .toArray();
    if (unreadAlerts.length > 0) {
      setActiveNotification(unreadAlerts[0]);
    }

    // 10. Generate chart data from the past 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const dieselChart = [];
    const hoursChart = [];
    const productivityChart = [];

    for (const dStr of last7Days) {
      const dayName = new Date(dStr).toLocaleDateString('en-IN', { weekday: 'short' });
      
      // Diesel
      const refills = await db.diesel_refills.where('date').equals(dStr).toArray();
      const lits = refills.reduce((sum, r) => sum + (parseFloat(r.liters) || 0), 0);
      dieselChart.push({ name: dayName, liters: lits });
      
      // Running Hours vs Idle vs Breakdown
      const runningLogs = await db.running_hours.where('date').equals(dStr).toArray();
      const runHrs = runningLogs.reduce((sum, r) => sum + (parseFloat(r.running_hours) || 0), 0);
      const idleHrs = runningLogs.reduce((sum, r) => sum + (parseFloat(r.idle_hours) || 0), 0);
      const breakHrs = runningLogs.reduce((sum, r) => sum + (parseFloat(r.breakdown_hours) || 0), 0);
      hoursChart.push({ name: dayName, 'Running Hours': runHrs, 'Idle Hours': idleHrs, 'Breakdowns': breakHrs });

      // Field Work Productivity (Tons / Hour)
      const fields = await db.field_work.where('date').equals(dStr).toArray();
      const tons = fields.reduce((sum, f) => sum + (parseFloat(f.tons_harvested) || 0), 0);
      const run = fields.reduce((sum, f) => sum + (parseFloat(f.running_hours) || 0), 0);
      const prod = run > 0 ? parseFloat((tons / run).toFixed(2)) : 0;
      productivityChart.push({ name: dayName, 'Tons/Hour': prod });
    }

    // Monthly Income vs Expenses (Last 6 Months)
    const monthlyPL = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const tempDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mLabel = tempDate.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      const mInt = tempDate.getMonth() + 1;
      const yInt = tempDate.getFullYear();

      // Query field work income for this month
      const mFields = await db.field_work
        .filter(f => {
          const fd = new Date(f.date);
          return fd.getMonth() + 1 === mInt && fd.getFullYear() === yInt;
        })
        .toArray();
      const mIncome = mFields.reduce((sum, f) => sum + (parseFloat(f.income) || 0), 0);

      // Query expenses for this month
      const mExpenses = await db.expenses
        .filter(e => {
          const ed = new Date(e.date);
          return ed.getMonth() + 1 === mInt && ed.getFullYear() === yInt;
        })
        .toArray();
      const mExp = mExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

      monthlyPL.push({ name: mLabel, Income: mIncome, Expenses: mExp, Profit: mIncome - mExp });
    }

    setChartsData({
      diesel: dieselChart,
      hours: hoursChart,
      monthlyPL: monthlyPL,
      productivity: productivityChart
    });
  };

  const dismissNotification = async (id) => {
    await db.notifications.update(id, { is_read: 1 });
    setActiveNotification(null);
  };

  return (
    <div className="dashboard-view">
      {/* Alert banner if notification exists */}
      {activeNotification && (
        <div className="sync-banner error" style={{ borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg className="nav-icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" /></svg>
            <strong>{activeNotification.title}:</strong> {activeNotification.message}
          </div>
          <button className="modal-close" onClick={() => dismissNotification(activeNotification.id)} style={{ color: 'var(--text-inverse)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Operators Present</span>
            <div className="stat-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
          </div>
          <div className="stat-value">{stats.operatorsPresent}</div>
          <div className="stat-footer">Today's active crew</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Running Hours</span>
            <div className="stat-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
          </div>
          <div className="stat-value">{stats.runningHours} hrs</div>
          <div className="stat-footer">Logged harvester operation</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Diesel Used</span>
            <div className="stat-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 2v20M21 21v-4a4 4 0 0 0-3-3.87M16 2v4M6 14h10M6 18h10M6 10h10" /></svg>
            </div>
          </div>
          <div className="stat-value">{stats.dieselUsed} L</div>
          <div className="stat-footer">Refilled volume today</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Sugarcane Harvested</span>
            <div className="stat-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
          </div>
          <div className="stat-value">{stats.tonsHarvested} Tons</div>
          <div className="stat-footer">Sugarcane load delivered</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'var(--success)' }}>
          <div className="stat-header">
            <span className="stat-title">Today's Income</span>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(56, 161, 105, 0.1)', color: 'var(--success)' }}>
              <span style={{ fontWeight: 'bold' }}>₹</span>
            </div>
          </div>
          <div className="stat-value text-success">{formatCurrency(stats.income)}</div>
          <div className="stat-footer">Field work earnings today</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'var(--danger)' }}>
          <div className="stat-header">
            <span className="stat-title">Today's Expenses</span>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(229, 62, 98, 0.1)', color: 'var(--danger)' }}>
              <span style={{ fontWeight: 'bold' }}>₹</span>
            </div>
          </div>
          <div className="stat-value text-danger">{formatCurrency(stats.expenses)}</div>
          <div className="stat-footer">Fuel, crew food & repairs</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'var(--warning)' }}>
          <div className="stat-header">
            <span className="stat-title">Pending Mill Payments</span>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(221, 107, 32, 0.1)', color: 'var(--warning)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8c3 0 5-1.5 5-3H7c0 1.5 2 3 5 3z"/></svg>
            </div>
          </div>
          <div className="stat-value text-warning">{formatCurrency(stats.pendingPayments)}</div>
          <div className="stat-footer">Mill invoices outstanding</div>
        </div>

        <div className="stat-card" style={{ borderColor: stats.netProfit >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
          <div className="stat-header">
            <span className="stat-title">Net Profit (Today)</span>
            <div className="stat-icon-wrapper" style={{ backgroundColor: stats.netProfit >= 0 ? 'rgba(45, 106, 79, 0.1)' : 'rgba(229, 62, 98, 0.1)', color: stats.netProfit >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
              <span style={{ fontWeight: 'bold' }}>=</span>
            </div>
          </div>
          <div className={`stat-value ${stats.netProfit >= 0 ? 'text-primary' : 'text-danger'}`}>
            {formatCurrency(stats.netProfit)}
          </div>
          <div className="stat-footer">Daily revenue balance</div>
        </div>
      </div>

      {/* Registered Fleet & Machinery Cards */}
      <div className="content-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🚜 Registered Fleet & Machinery (3 Vehicles)
            </h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Owner: <strong>Sivakozhundhu</strong> (s/o Karthikeyan) • Valaiyampattu, Villupuram (TN32)
            </span>
          </div>
          <span className="badge badge-success" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
            SBI ADB Financed Fleet
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
          {fleetList.map((veh) => {
            const isHarvester = veh.vehicle_type?.toLowerCase().includes('harvester') || veh.name?.toLowerCase().includes('case') || veh.name?.toLowerCase().includes('harvester');
            return (
              <div 
                key={veh.id} 
                style={{ 
                  backgroundColor: 'var(--bg-app)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '1rem',
                  borderLeft: `4px solid ${isHarvester ? 'var(--success)' : '#3182ce'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.9375rem', color: 'var(--text-main)' }}>
                    {veh.name}
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                    {veh.status || 'Active'}
                  </span>
                </div>

                {/* Plate */}
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.35rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)' }}>IND</span>
                  <span style={{ fontWeight: '800', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    {veh.reg_number || veh.id}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TN32</span>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                  <div>Model: <strong style={{ color: 'var(--text-main)' }}>{veh.model || 'CNH'}</strong></div>
                  <div>Power: <strong style={{ color: 'var(--text-main)' }}>{veh.hp || 'Diesel'}</strong></div>
                  <div style={{ gridColumn: 'span 2' }}>Chassis: <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{veh.chassis_number || 'PNEY4010LR2EB0435'}</strong></div>
                  <div style={{ gridColumn: 'span 2' }}>Engine: <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{veh.engine_number || '002165114'}</strong></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Display Grid */}
      <div className="charts-grid">
        {/* Chart 1: P&L */}
        <div className="chart-card">
          <h3 className="chart-title">Income, Expenses & Net Profit Trend</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.monthlyPL} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} />
                <Legend />
                <Bar dataKey="Income" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#e53e3e" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Profit" stroke="#ecc94b" strokeWidth={2.5} dot={{ r: 4 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Running Hours breakdown */}
        <div className="chart-card">
          <h3 className="chart-title">Operational Hours Breakdown (7 Days)</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData.hours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} />
                <Legend />
                <Area type="monotone" dataKey="Running Hours" stackId="1" stroke="#40916c" fill="#40916c" fillOpacity={0.6} />
                <Area type="monotone" dataKey="Idle Hours" stackId="1" stroke="#ecc94b" fill="#ecc94b" fillOpacity={0.4} />
                <Area type="monotone" dataKey="Breakdowns" stackId="1" stroke="#e53e3e" fill="#e53e3e" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Diesel usage */}
        <div className="chart-card">
          <h3 className="chart-title">Diesel Refills (Liters - Last 7 Days)</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.diesel} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} />
                <Bar dataKey="liters" fill="#52b788" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fill: 'var(--text-main)' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Productivity */}
        <div className="chart-card">
          <h3 className="chart-title">Productivity Profile (Tons/Hour - Last 7 Days)</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartsData.productivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} />
                <Line type="monotone" dataKey="Tons/Hour" stroke="#1b4332" strokeWidth={3} activeDot={{ r: 8 }} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
