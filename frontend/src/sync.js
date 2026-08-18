import { db } from './db.js';

const API_BASE = '';
let isSyncing = false;

// Trigger Sync process
export async function triggerSync() {
  if (!navigator.onLine) {
    console.log('Sync skipped: Network is offline.');
    return { success: false, reason: 'offline' };
  }

  if (isSyncing) {
    console.log('Sync skipped: Synchronization already in progress.');
    return { success: false, reason: 'in_progress' };
  }

  let token = localStorage.getItem('harvester_owner_token') || 'direct-owner-token';

  isSyncing = true;
  console.log('Sync initiated: Starting sync sequence...');

  try {
    // 1. Push local changes to server
    const outboxItems = await db.outbox.toArray();
    if (outboxItems.length > 0) {
      console.log(`Pushing ${outboxItems.length} local changes to server...`);
      
      const response = await fetch(`${API_BASE}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ changes: outboxItems })
      });

      if (!response.ok) {
        throw new Error(`Sync Push API error: ${response.statusText}`);
      }

      const pushResult = await response.json();
      if (pushResult.success) {
        // Clear synced items from outbox
        const idsToRemove = outboxItems.map(item => item.id);
        await db.outbox.bulkDelete(idsToRemove);
        console.log('Successfully pushed and cleared local outbox items.');
      } else {
        throw new Error(pushResult.error || 'Unknown push sync error');
      }
    }

    // 2. Pull fresh updates from server
    const lastSynced = localStorage.getItem('last_synced_timestamp') || '0';
    console.log(`Pulling updates from server since: ${lastSynced}...`);

    const pullResponse = await fetch(`${API_BASE}/api/sync/pull?lastSynced=${encodeURIComponent(lastSynced)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!pullResponse.ok) {
      throw new Error(`Sync Pull API error: ${pullResponse.statusText}`);
    }

    const pullResult = await pullResponse.json();
    
    // Save new/modified items locally. Use direct dexie put to avoid infinite sync loops
    const tables = Object.keys(pullResult.updates);
    for (const table of tables) {
      const records = pullResult.updates[table];
      if (records.length > 0) {
        console.log(`Updating local IndexedDB table "${table}" with ${records.length} records...`);
        for (const record of records) {
          await db[table].put(record);
        }
      }
    }

    // Process deleted items locally
    if (pullResult.deleted && pullResult.deleted.length > 0) {
      console.log(`Processing ${pullResult.deleted.length} deletions locally...`);
      for (const del of pullResult.deleted) {
        if (db[del.table_name]) {
          await db[del.table_name].delete(del.id);
        }
      }
    }

    // Save current sync timestamp
    localStorage.setItem('last_synced_timestamp', pullResult.timestamp);
    console.log(`Sync completed successfully. Timestamp: ${pullResult.timestamp}`);
    
    isSyncing = false;
    
    // Dispatch custom event to notify components that sync finished
    window.dispatchEvent(new CustomEvent('sync-completed', { detail: { status: 'success' } }));
    return { success: true };
  } catch (err) {
    console.error('Synchronization failed:', err.message);
    isSyncing = false;
    window.dispatchEvent(new CustomEvent('sync-completed', { detail: { status: 'failed', error: err.message } }));
    return { success: false, reason: 'error', message: err.message };
  }
}

// Register Listeners for automatic network transitions
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network online. Triggering automatic background sync.');
    triggerSync().catch(console.error);
  });

  // Auto-poll sync every 30 seconds when tab is active and online
  setInterval(() => {
    if (navigator.onLine && localStorage.getItem('harvester_owner_token')) {
      triggerSync().catch(console.error);
    }
  }, 30000);
}
