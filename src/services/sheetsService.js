/**
 * DrWEEE Flow v2.0 — Google Sheets Sync Service
 *
 * This service sends task events to a Google Sheets-connected webhook.
 * In production, replace WEBHOOK_URL with your Google Apps Script Web App URL
 * (publish it as "Anyone can access").
 *
 * Google Apps Script side example (doPost):
 *   function doPost(e) {
 *     const data = JSON.parse(e.postData.contents);
 *     const sheet = SpreadsheetApp.getActiveSheet();
 *     sheet.appendRow([data.event, data.title, data.employee, data.status, data.priority, data.dueDate, data.timestamp]);
 *     return ContentService.createTextOutput("OK");
 *   }
 */

const WEBHOOK_URL = import.meta.env.VITE_SHEETS_WEBHOOK_URL || null;

const sendToSheets = async (payload) => {
  if (!WEBHOOK_URL) {
    console.warn('[Sheets Sync] No webhook URL configured. Set VITE_SHEETS_WEBHOOK_URL in .env');
    return;
  }

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', // required for Google Apps Script endpoints
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() })
    });
    console.log(`[Sheets Sync] ✓ Event "${payload.event}" synced.`);
  } catch (err) {
    console.error('[Sheets Sync] ✗ Failed to sync:', err);
  }
};

/** Call when a task is created */
export const syncTaskCreated = (task) => sendToSheets({
  event: 'TASK_CREATED',
  title: task.title,
  employee: task.employee,
  status: task.status,
  priority: task.priority,
  dueDate: task.dueDate,
  taskType: task.taskType || 'standard',
});

/** Call when a task status changes */
export const syncTaskUpdated = (task, newStatus) => sendToSheets({
  event: 'TASK_UPDATED',
  title: task.title,
  employee: task.employee,
  status: newStatus,
  priority: task.priority,
  dueDate: task.dueDate,
});

/** Call when a task is deleted */
export const syncTaskDeleted = (task) => sendToSheets({
  event: 'TASK_DELETED',
  title: task.title,
  employee: task.employee,
  status: task.status,
});
