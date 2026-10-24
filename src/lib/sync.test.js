import { describe, it, expect } from 'vitest'
import { syncPending } from './sync.js'

function fakeDevice(records) {
  const map = new Map(records.map(r => [r.id, r]))
  return {
    getAll: async () => [...map.values()],
    put: async r => { map.set(r.id, r) },
    get: id => map.get(id),
  }
}

const rec = id => ({ id, syncStatus: 'pending', beneficiary: { name: 'Test' } })

describe('syncPending', () => {
  it('does nothing while offline', async () => {
    const device = fakeDevice([rec('1')])
    const api = { upsertRecords: async () => { throw new Error('should not be called') } }
    const r = await syncPending({ deviceStore: device, api, isOnline: () => false })
    expect(r.skipped).toBe(true)
    expect(device.get('1').syncStatus).toBe('pending')
  })

  it('marks records synced after a successful upload', async () => {
    const device = fakeDevice([rec('1'), rec('2')])
    const sent = []
    const api = { upsertRecords: async p => { sent.push(...p) } }
    const r = await syncPending({ deviceStore: device, api, isOnline: () => true })
    expect(r.sent).toBe(2)
    expect(device.get('1').syncStatus).toBe('synced')
    expect(sent[0].syncStatus).toBeUndefined() // local-only fields are stripped
  })

  it('keeps records on the device and counts attempts when upload fails', async () => {
    const device = fakeDevice([rec('1')])
    const api = { upsertRecords: async () => { throw new Error('timeout') } }
    await syncPending({ deviceStore: device, api, isOnline: () => true })
    expect(device.get('1').syncStatus).toBe('failed')
    expect(device.get('1').syncAttempts).toBe(1)
    expect(device.get('1').lastSyncError).toBe('timeout')
  })

  it('retries failed records on the next run', async () => {
    const device = fakeDevice([{ ...rec('1'), syncStatus: 'failed', syncAttempts: 2 }])
    const api = { upsertRecords: async () => {} }
    await syncPending({ deviceStore: device, api, isOnline: () => true })
    expect(device.get('1').syncStatus).toBe('synced')
  })

  it('never re-sends records that are already synced', async () => {
    const device = fakeDevice([{ ...rec('1'), syncStatus: 'synced' }])
    let calls = 0
    const api = { upsertRecords: async () => { calls++ } }
    await syncPending({ deviceStore: device, api, isOnline: () => true })
    expect(calls).toBe(0)
  })
})
