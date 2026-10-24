/**
 * Storage layer.
 *
 * deviceStore: what lives on the field worker's phone (IndexedDB).
 *   IndexedDB is used instead of localStorage because records carry
 *   photos, and localStorage is limited to about 5 MB.
 *
 * api: a mock REST server. In production these functions would call
 *   endpoints like POST /api/records and PATCH /api/records/:id.
 *   Here the "server" is a separate IndexedDB store with simulated
 *   network delay and occasional failures, so the sync and retry logic
 *   can be demonstrated without a backend.
 */
import { createStore, get, set, values, del, clear } from 'idb-keyval'

const deviceDb = createStore('sahaya-device', 'records')
const serverDb = createStore('sahaya-server', 'records')

export const deviceStore = {
  getAll: () => values(deviceDb),
  put: r => set(r.id, r, deviceDb),
  remove: id => del(id, deviceDb),
  clear: () => clear(deviceDb),
}

const wait = ms => new Promise(r => setTimeout(r, ms))

export const api = {
  // Simulated failure rate on a weak rural network.
  failureRate: 0.15,

  async upsertRecords(records) {
    await wait(500 + Math.random() * 700)
    if (Math.random() < api.failureRate) throw new Error('Network timeout while uploading')
    for (const r of records) {
      const existing = await get(r.id, serverDb)
      // The server owns case status once a record exists, so a field
      // re-sync never overwrites a manager's status change.
      await set(r.id, { ...r, status: existing?.status ?? r.status ?? 'new', receivedAt: new Date().toISOString() }, serverDb)
    }
  },

  async listRecords() {
    await wait(150)
    return (await values(serverDb)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async updateStatus(id, status) {
    const r = await get(id, serverDb)
    if (!r) throw new Error('Record not found')
    await set(id, { ...r, status, statusUpdatedAt: new Date().toISOString() }, serverDb)
  },

  async seed(records) {
    for (const r of records) await set(r.id, r, serverDb)
  },

  clear: () => clear(serverDb),
}

export function newId() {
  return 'LA-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
}

const SETTINGS_KEY = 'sahaya-settings'
export function loadSettings() {
  try {
    return { incomeLimit: 100000, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch {
    return { incomeLimit: 100000 }
  }
}
export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* storage blocked */ }
}
