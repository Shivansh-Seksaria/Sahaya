/**
 * Offline-first sync engine.
 *
 * Every intake is saved on the device first with syncStatus 'pending'.
 * When the device is online, pending records are sent to the server in
 * small batches. If a batch fails, its records stay on the device, are
 * marked 'failed', and are retried on the next sync. Nothing is ever
 * deleted from the device just because the network dropped.
 *
 * The device store and the API are passed in as arguments (dependency
 * injection), so tests can use simple in-memory fakes.
 */

export const BATCH_SIZE = 10

export async function syncPending({ deviceStore, api, isOnline }) {
  const result = { sent: 0, failed: 0, skipped: false }
  if (!isOnline()) {
    result.skipped = true
    return result
  }

  const all = await deviceStore.getAll()
  const queue = all.filter(r => r.syncStatus !== 'synced')

  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE)
    try {
      // Strip local-only fields before sending.
      const payload = batch.map(({ syncStatus, syncAttempts, lastSyncError, ...rest }) => rest)
      await api.upsertRecords(payload)
      for (const r of batch) {
        await deviceStore.put({ ...r, syncStatus: 'synced', syncedAt: new Date().toISOString(), lastSyncError: null })
      }
      result.sent += batch.length
    } catch (err) {
      for (const r of batch) {
        await deviceStore.put({
          ...r,
          syncStatus: 'failed',
          syncAttempts: (r.syncAttempts ?? 0) + 1,
          lastSyncError: String(err?.message ?? err),
        })
      }
      result.failed += batch.length
      // Stop on first failure. The network is probably flaky, so retry later.
      break
    }
  }
  return result
}
