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

export async function ensureOfficialFleetSeeded() {
  const validIds = ['TN32BF8500', 'TN32BF8451', 'TN32BF8438'];
  const allCurrent = await db.harvesters.toArray();
  for (const item of allCurrent) {
    if (!validIds.includes(item.id)) {
      await db.harvesters.delete(item.id);
    }
  }
  for (const veh of OFFICIAL_FLEET) {
    await db.harvesters.put(veh);
  }
}

// Auto-seed official fleet immediately
ensureOfficialFleetSeeded().catch(console.error);

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
