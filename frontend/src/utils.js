// Utility helpers for Harvester Owner Application

// Generate secure UUIDs for client-side records
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Convert File object to Base64 String
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Format Currency to Indian Rupees (INR)
export function formatCurrency(amount) {
  const value = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(value);
}

// Format Date string to readable local format
export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Format Time (HH:MM)
export function formatTime(timeString) {
  if (!timeString) return 'N/A';
  // If it's a full ISO, parse it
  if (timeString.includes('T')) {
    const d = new Date(timeString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  // Otherwise split raw time e.g. "14:30:00" -> "02:30 PM"
  try {
    const parts = timeString.split(':');
    let hrs = parseInt(parts[0], 10);
    const mins = parts[1];
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12; // hour '0' should be '12'
    return `${hrs.toString().padStart(2, '0')}:${mins} ${ampm}`;
  } catch (err) {
    return timeString;
  }
}

// Export data helper to easily convert arrays to CSV text for simple tables
export function convertToCSV(headers, dataRowArray) {
  const headerLine = headers.join(',');
  const rowLines = dataRowArray.map(row => 
    row.map(val => {
      const cleanVal = (val === null || val === undefined) ? '' : String(val).replace(/"/g, '""');
      return `"${cleanVal}"`;
    }).join(',')
  );
  return [headerLine, ...rowLines].join('\n');
}
