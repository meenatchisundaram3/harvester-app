import Dexie from 'dexie';

// Initialize the Dexie Database
export const db = new Dexie('HarvesterOwnerDB');

// Declare local IndexedDB structure
db.version(1).stores({
  operators: 'id, name, mobile, status, updated_at',
  harvesters: 'id, name, reg_number, status, updated_at',
  attendance: 'id, date, operator_id, status, updated_at',
  field_work: 'id, date, village, farmer_name, harvester_id, operator_id, updated_at',
  diesel_refills: 'id, date, harvester_id, operator_id, updated_at',
  running_hours: 'id, date, harvester_id, updated_at',
  payments: 'id, mill_name, date, status, updated_at',
  expenses: 'id, date, category, updated_at',
  maintenance: 'id, harvester_id, next_due_date, status, updated_at',
  salary: 'id, operator_id, month, year, status, updated_at',
  notifications: 'id, type, is_read, updated_at',
  outbox: '++id, table, action, recordId, timestamp' // Stores operations to sync to server
});

export const OFFICIAL_FLEET = [
  {
    id: 'TN32BF8500',
    name: 'Harvester - Case IH Austoft 4010 Maxx (TN 32 BF 8500)',
    reg_number: 'TN 32 BF 8500',
    vehicle_type: 'Sugarcane Harvester',
    maker: 'CNH INDUSTRIAL (INDIA) PVT LTD',
    model: 'CASE IH AUSTOFT 4010 MAXX',
    chassis_number: 'PNEY4010LR2EB0435',
    engine_number: '002165114',
    purchase_date: '2024-07-05',
    validity_date: '2039-07-04',
    fuel_type: 'DIESEL (TREM STAGE V)',
    owner_name: 'SIVAKOZHUNDHU (s/o KARTHIKEYAN)',
    financer: 'STATE BANK OF INDIA ADB',
    rto: 'TN32 VILLUPURAM RTO',
    hp: '175.54 HP',
    status: 'Active',
    updated_at: new Date().toISOString()
  },
  {
    id: 'TN32BF8451',
    name: 'Infielder 1 - New Holland 3630 TX (TN 32 BF 8451)',
    reg_number: 'TN 32 BF 8451',
    vehicle_type: 'Infield Tractor',
    maker: 'CNH INDUSTRIAL (INDIA) PVT LTD',
    model: 'NH 3630 TX A1',
    chassis_number: 'NHN36300ZRC686589',
    engine_number: '437447DX',
    purchase_date: '2024-07-05',
    validity_date: '2039-07-04',
    fuel_type: 'DIESEL',
    owner_name: 'SIVAKOZHUNDHU (s/o KARTHIKEYAN)',
    financer: 'STATE BANK OF INDIA ADB',
    rto: 'TN32 VILLUPURAM RTO',
    hp: '49.5 HP',
    status: 'Active',
    updated_at: new Date().toISOString()
  },
  {
    id: 'TN32BF8438',
    name: 'Infielder 2 - New Holland 3630 TX (TN 32 BF 8438)',
    reg_number: 'TN 32 BF 8438',
    vehicle_type: 'Infield Tractor',
    maker: 'CNH INDUSTRIAL (INDIA) PVT LTD',
    model: 'NH 3630 TX A1',
    chassis_number: 'NHN36300ZRC686593',
    engine_number: '437551DX',
    purchase_date: '2024-07-05',
    validity_date: '2039-07-04',
    fuel_type: 'DIESEL',
    owner_name: 'SIVAKOZHUNDHU (s/o KARTHIKEYAN)',
    financer: 'STATE BANK OF INDIA ADB',
    rto: 'TN32 VILLUPURAM RTO',
    hp: '49.5 HP',
    status: 'Active',
    updated_at: new Date().toISOString()
  }
];

export const DEFAULT_CREW = [
  {
    id: 'OP-HARVESTER-1',
    name: 'Harvester Operator (Pilot)',
    role: 'Harvester Operator',
    assigned_vehicle: 'TN32BF8500',
    mobile: '9876543210',
    joining_date: '2024-07-05',
    salary_type: 'Monthly',
    salary_amount: 35000,
    status: 'Active',
    updated_at: new Date().toISOString()
  },
  {
    id: 'OP-INFIELDER-1',
    name: 'Infielder 1 Operator',
    role: 'Infielder 1 Operator',
    assigned_vehicle: 'TN32BF8451',
    mobile: '9876543211',
    joining_date: '2024-07-05',
    salary_type: 'Monthly',
    salary_amount: 22000,
    status: 'Active',
    updated_at: new Date().toISOString()
  },
  {
    id: 'OP-INFIELDER-2',
    name: 'Infielder 2 Operator',
    role: 'Infielder 2 Operator',
    assigned_vehicle: 'TN32BF8438',
    mobile: '9876543212',
    joining_date: '2024-07-05',
    salary_type: 'Monthly',
    salary_amount: 22000,
    status: 'Active',
    updated_at: new Date().toISOString()
  }
];

export async function ensureDefaultCrewSeeded() {
  const count = await db.operators.count();
  if (count === 0) {
    for (const op of DEFAULT_CREW) {
      await db.operators.put(op);
    }
  }
}

export const BANNARI_SUGARS_STATEMENTS = [
  {
    id: 'stmt-bannari-348-39',
    bill_no: '348/39',
    mill_name: 'Bannari Amman Sugars Limited, Tirukoilur',
    division: 'ANDAMPALLAM',
    gang_leader_no: 'H038',
    gang_leader_name: 'SIVAKOZHUNDHU',
    date: '2026-07-31',
    period_from: '2026-07-23',
    period_to: '2026-07-31',
    rate_per_ton: 600,
    tons: 59.615,
    gross_amount: 35769.00,
    deductions: 20272.00,
    net_payable: 15497.00,
    advance: 15497.00,
    balance: 0.00,
    status: 'Paid',
    bank_details: 'SBI0005-42805345508',
    payment_mode: 'Received Payment thru Bank (SBI)',
    payment_date: '2026-07-31',
    farmer: 'SADIYANDI C, BHARATHI E (3 Cuts)',
    items: [
      { s_no: 1, r_no: '050309', p_no: 'MPU0111', farmer: 'SADIYANDI C', div: '010', date: '2026-07-30', rate: 600, tons: 16.540, amount: 9924.00 },
      { s_no: 2, r_no: '050309', p_no: 'MPU0111', farmer: 'SADIYANDI C', div: '010', date: '2026-07-30', rate: 600, tons: 21.870, amount: 13122.00 },
      { s_no: 3, r_no: '084378', p_no: 'MPU0110', farmer: 'BHARATHI E', div: '010', date: '2026-07-31', rate: 600, tons: 21.205, amount: 12723.00 }
    ]
  },
  {
    id: 'stmt-bannari-370-40',
    bill_no: '370/40',
    mill_name: 'Bannari Amman Sugars Limited, Tirukoilur',
    division: 'ANDAMPALLAM',
    gang_leader_no: 'H038',
    gang_leader_name: 'SIVAKOZHUNDHU',
    date: '2026-08-07',
    period_from: '2026-08-01',
    period_to: '2026-08-07',
    rate_per_ton: 600,
    tons: 125.335,
    gross_amount: 75201.00,
    deductions: 40544.00,
    net_payable: 34657.00,
    advance: 34657.00,
    balance: 0.00,
    status: 'Paid',
    bank_details: 'SBI0005-42805345508',
    payment_mode: 'Received Payment thru Bank (SBI)',
    payment_date: '2026-08-07',
    farmer: 'SADIYANDI C, BHARATHI E, SELVI E, ILAYAPERUMAL R (7 Cuts)',
    items: [
      { s_no: 1, r_no: '050309', p_no: 'MPU0111', farmer: 'SADIYANDI C', div: '010', date: '2026-08-01', rate: 600, tons: 21.085, amount: 12651.00 },
      { s_no: 2, r_no: '084378', p_no: 'MPU0110', farmer: 'BHARATHI E', div: '010', date: '2026-08-01', rate: 600, tons: 17.545, amount: 10527.00 },
      { s_no: 3, r_no: '084330', p_no: 'MPU0124', farmer: 'SELVI E', div: '010', date: '2026-08-01', rate: 600, tons: 17.080, amount: 10248.00 },
      { s_no: 4, r_no: '084330', p_no: 'MPU0124', farmer: 'SELVI E', div: '010', date: '2026-08-02', rate: 600, tons: 20.370, amount: 12222.00 },
      { s_no: 5, r_no: '084297', p_no: 'MPU0108', farmer: 'ILAYAPERUMAL R', div: '010', date: '2026-08-02', rate: 600, tons: 7.590, amount: 4554.00 },
      { s_no: 6, r_no: '084297', p_no: 'MPU0108', farmer: 'ILAYAPERUMAL R', div: '010', date: '2026-08-02', rate: 600, tons: 22.675, amount: 13605.00 },
      { s_no: 7, r_no: '084297', p_no: 'MPU0108', farmer: 'ILAYAPERUMAL R', div: '010', date: '2026-08-05', rate: 600, tons: 18.990, amount: 11394.00 }
    ]
  },
  {
    id: 'stmt-bannari-392-36',
    bill_no: '392/36',
    mill_name: 'Bannari Amman Sugars Limited, Tirukoilur',
    division: 'ANDAMPALLAM',
    gang_leader_no: 'H038',
    gang_leader_name: 'SIVAKOZHUNDHU',
    date: '2026-08-15',
    period_from: '2026-08-08',
    period_to: '2026-08-15',
    rate_per_ton: 600,
    tons: 98.405,
    gross_amount: 59043.00,
    deductions: 20272.00,
    net_payable: 38771.00,
    advance: 38771.00,
    balance: 0.00,
    status: 'Paid',
    bank_details: 'SBI0005-42805345508',
    payment_mode: 'Received Payment thru Bank (SBI)',
    payment_date: '2026-08-15',
    farmer: 'GNANAVEL A, JAYARAMAN N (5 Cuts)',
    items: [
      { s_no: 1, r_no: '084345', p_no: 'MPU0160', farmer: 'GNANAVEL A', div: '010', date: '2026-08-10', rate: 600, tons: 23.140, amount: 13884.00 },
      { s_no: 2, r_no: '084345', p_no: 'MPU0160', farmer: 'GNANAVEL A', div: '010', date: '2026-08-11', rate: 600, tons: 15.960, amount: 9576.00 },
      { s_no: 3, r_no: '050169', p_no: 'MPU0152', farmer: 'JAYARAMAN N', div: '010', date: '2026-08-15', rate: 600, tons: 21.735, amount: 13041.00 },
      { s_no: 4, r_no: '050169', p_no: 'MPU0152', farmer: 'JAYARAMAN N', div: '010', date: '2026-08-15', rate: 600, tons: 16.575, amount: 9945.00 },
      { s_no: 5, r_no: '050169', p_no: 'MPU0152', farmer: 'JAYARAMAN N', div: '010', date: '2026-08-15', rate: 600, tons: 20.995, amount: 12597.00 }
    ]
  },
  {
    id: 'stmt-bannari-415-36',
    bill_no: '415/36',
    mill_name: 'Bannari Amman Sugars Limited, Tirukoilur',
    division: 'ANDAMPALLAM',
    gang_leader_no: 'H038',
    gang_leader_name: 'SIVAKOZHUNDHU',
    date: '2026-08-22',
    period_from: '2026-08-16',
    period_to: '2026-08-22',
    rate_per_ton: 600,
    tons: 183.675,
    gross_amount: 110205.00,
    deductions: 60816.00,
    net_payable: 49389.00,
    advance: 49389.00,
    balance: 0.00,
    status: 'Paid',
    bank_details: 'SBI0005-42805345508',
    payment_mode: 'Received Payment thru Bank (SBI)',
    payment_date: '2026-08-22',
    farmer: 'JAYARAMAN N, ILAYAPERUMAL G, GUNASEKARAN S (11 Cuts)',
    items: [
      { s_no: 1, r_no: '050169', p_no: 'MPU0152', farmer: 'JAYARAMAN N', div: '010', date: '2026-08-16', rate: 600, tons: 15.925, amount: 9555.00 },
      { s_no: 2, r_no: '050169', p_no: 'MPU0152', farmer: 'JAYARAMAN N', div: '010', date: '2026-08-16', rate: 600, tons: 21.660, amount: 12996.00 },
      { s_no: 3, r_no: '050169', p_no: 'MPU0152', farmer: 'JAYARAMAN N', div: '010', date: '2026-08-16', rate: 600, tons: 2.290, amount: 1374.00 },
      { s_no: 4, r_no: '050045', p_no: 'MPU0109', farmer: 'ILAYAPERUMAL G', div: '010', date: '2026-08-18', rate: 600, tons: 16.965, amount: 10179.00 },
      { s_no: 5, r_no: '050045', p_no: 'MPU0109', farmer: 'ILAYAPERUMAL G', div: '010', date: '2026-08-18', rate: 600, tons: 22.430, amount: 13458.00 },
      { s_no: 6, r_no: '050045', p_no: 'MPU0109', farmer: 'ILAYAPERUMAL G', div: '010', date: '2026-08-19', rate: 600, tons: 16.865, amount: 10119.00 },
      { s_no: 7, r_no: '050045', p_no: 'MPU0109', farmer: 'ILAYAPERUMAL G', div: '010', date: '2026-08-20', rate: 600, tons: 21.575, amount: 12945.00 },
      { s_no: 8, r_no: '050045', p_no: 'MPU0109', farmer: 'ILAYAPERUMAL G', div: '010', date: '2026-08-21', rate: 600, tons: 16.685, amount: 10011.00 },
      { s_no: 9, r_no: '050045', p_no: 'MPU0109', farmer: 'ILAYAPERUMAL G', div: '010', date: '2026-08-21', rate: 600, tons: 10.080, amount: 6048.00 },
      { s_no: 10, r_no: '084392', p_no: 'MPU0149', farmer: 'GUNASEKARAN S', div: '010', date: '2026-08-22', rate: 600, tons: 22.120, amount: 13272.00 },
      { s_no: 11, r_no: '084392', p_no: 'MPU0149', farmer: 'GUNASEKARAN S', div: '010', date: '2026-08-22', rate: 600, tons: 17.080, amount: 10248.00 }
    ]
  }
];

export async function ensureBannariStatementsSeeded() {
  for (const stmt of BANNARI_SUGARS_STATEMENTS) {
    const existing = await db.payments.get(stmt.id);
    if (!existing) {
      await db.payments.put(stmt);
    }
  }
}

// Auto-seed official fleet, crew, and Bannari Sugar Mill statements immediately
ensureOfficialFleetSeeded().catch(console.error);
ensureDefaultCrewSeeded().catch(console.error);
ensureBannariStatementsSeeded().catch(console.error);

// Helper: Queue operations in outbox for background sync
export async function queueSyncAction(table, action, recordId, data = null) {
  const timestamp = Date.now();
  
  // Clean base64 strings if necessary, though we keep them to let the server upload them.
  // Insert to outbox
  await db.outbox.add({
    table,
    action,
    recordId,
    data: data ? JSON.parse(JSON.stringify(data)) : null, // deep copy object
    timestamp
  });

  // Trigger sync process in background if online
  if (navigator.onLine) {
    import('./sync.js').then(({ triggerSync }) => triggerSync().catch(console.error));
  }
}

// Wrapper for DB operations to easily handle local write + sync queuing
export const localDb = {
  // Operators
  async saveOperator(operator) {
    const record = { ...operator, updated_at: new Date().toISOString() };
    await db.operators.put(record);
    await queueSyncAction('operators', 'put', record.id, record);
    return record;
  },
  async deleteOperator(id) {
    await db.operators.delete(id);
    await queueSyncAction('operators', 'delete', id);
  },

  // Harvesters
  async saveHarvester(harvester) {
    const record = { ...harvester, updated_at: new Date().toISOString() };
    await db.harvesters.put(record);
    await queueSyncAction('harvesters', 'put', record.id, record);
    return record;
  },
  async deleteHarvester(id) {
    await db.harvesters.delete(id);
    await queueSyncAction('harvesters', 'delete', id);
  },

  // Attendance
  async saveAttendance(attendance) {
    const record = { ...attendance, updated_at: new Date().toISOString() };
    await db.attendance.put(record);
    await queueSyncAction('attendance', 'put', record.id, record);
    return record;
  },
  async deleteAttendance(id) {
    await db.attendance.delete(id);
    await queueSyncAction('attendance', 'delete', id);
  },

  // Field Work
  async saveFieldWork(fieldWork) {
    const record = { ...fieldWork, updated_at: new Date().toISOString() };
    // Calculate productivity and income on client too
    const running = parseFloat(record.running_hours) || 0;
    const tons = parseFloat(record.tons_harvested) || 0;
    record.productivity = running > 0 ? (tons / running) : 0;
    
    await db.field_work.put(record);
    await queueSyncAction('field_work', 'put', record.id, record);
    return record;
  },
  async deleteFieldWork(id) {
    await db.field_work.delete(id);
    await queueSyncAction('field_work', 'delete', id);
  },

  // Diesel Refills
  async saveDieselRefill(refill) {
    const record = { ...refill, updated_at: new Date().toISOString() };
    await db.diesel_refills.put(record);
    await queueSyncAction('diesel_refills', 'put', record.id, record);
    return record;
  },
  async deleteDieselRefill(id) {
    await db.diesel_refills.delete(id);
    await queueSyncAction('diesel_refills', 'delete', id);
  },

  // Running Hours
  async saveRunningHours(runningHours) {
    const record = { ...runningHours, updated_at: new Date().toISOString() };
    await db.running_hours.put(record);
    await queueSyncAction('running_hours', 'put', record.id, record);
    return record;
  },
  async deleteRunningHours(id) {
    await db.running_hours.delete(id);
    await queueSyncAction('running_hours', 'delete', id);
  },

  // Payments
  async savePayment(payment) {
    const record = { ...payment, updated_at: new Date().toISOString() };
    await db.payments.put(record);
    await queueSyncAction('payments', 'put', record.id, record);
    return record;
  },
  async deletePayment(id) {
    await db.payments.delete(id);
    await queueSyncAction('payments', 'delete', id);
  },

  // Expenses
  async saveExpense(expense) {
    const record = { ...expense, updated_at: new Date().toISOString() };
    await db.expenses.put(record);
    await queueSyncAction('expenses', 'put', record.id, record);
    return record;
  },
  async deleteExpense(id) {
    await db.expenses.delete(id);
    await queueSyncAction('expenses', 'delete', id);
  },

  // Maintenance
  async saveMaintenance(maintenance) {
    const record = { ...maintenance, updated_at: new Date().toISOString() };
    await db.maintenance.put(record);
    await queueSyncAction('maintenance', 'put', record.id, record);
    return record;
  },
  async deleteMaintenance(id) {
    await db.maintenance.delete(id);
    await queueSyncAction('maintenance', 'delete', id);
  },

  // Salary
  async saveSalary(salary) {
    const record = { ...salary, updated_at: new Date().toISOString() };
    await db.salary.put(record);
    await queueSyncAction('salary', 'put', record.id, record);
    return record;
  },
  async deleteSalary(id) {
    await db.salary.delete(id);
    await queueSyncAction('salary', 'delete', id);
  },

  // Notifications
  async saveNotification(notification) {
    const record = { ...notification, updated_at: new Date().toISOString() };
    await db.notifications.put(record);
    await queueSyncAction('notifications', 'put', record.id, record);
    return record;
  },
  async deleteNotification(id) {
    await db.notifications.delete(id);
    await queueSyncAction('notifications', 'delete', id);
  }
};
