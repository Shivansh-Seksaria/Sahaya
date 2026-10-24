import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n.js'
import { deviceStore, api, newId } from '../lib/db.js'
import { syncPending } from '../lib/sync.js'
import { WORKERS } from '../lib/places.js'
import IntakeForm from './IntakeForm.jsx'
import Stamp from './Stamp.jsx'

const WORKER_KEY = 'sahaya-worker'

export default function FieldApp({ online, incomeLimit, onSynced }) {
  const t = useT()
  const [view, setView] = useState('list') // list | form | done
  const [records, setRecords] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [workerId, setWorkerId] = useState(() => {
    try { return localStorage.getItem(WORKER_KEY) || WORKERS[0].id } catch { return WORKERS[0].id }
  })
  const onlineRef = useRef(online)
  useEffect(() => { onlineRef.current = online }, [online])

  const reload = useCallback(async () => {
    const all = await deviceStore.getAll()
    setRecords(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }, [])

  const runSync = useCallback(async () => {
    if (!onlineRef.current) return
    setSyncing(true)
    const r = await syncPending({ deviceStore, api, isOnline: () => onlineRef.current })
    setSyncing(false)
    await reload()
    if (r.sent) onSynced?.()
  }, [reload, onSynced])

  useEffect(() => { reload() }, [reload])

  // Sync whenever the network comes back, and every 20 seconds while online.
  useEffect(() => {
    if (!online) return
    runSync()
    const id = setInterval(runSync, 20000)
    return () => clearInterval(id)
  }, [online, runSync])

  function chooseWorker(id) {
    setWorkerId(id)
    try { localStorage.setItem(WORKER_KEY, id) } catch { /* ignore */ }
  }

  async function save(data) {
    const worker = WORKERS.find(w => w.id === workerId)
    const record = {
      id: newId(),
      createdAt: new Date().toISOString(),
      workerId,
      workerName: worker?.name,
      status: 'new',
      syncStatus: 'pending',
      syncAttempts: 0,
      ...data,
    }
    await deviceStore.put(record) // Always save locally first.
    setLastSaved(record)
    setView('done')
    await reload()
    if (onlineRef.current) runSync()
  }

  const pendingCount = records.filter(r => r.syncStatus !== 'synced').length

  return (
    <div className="phone">
      <header className="phone-head">
        <div>
          <div className="phone-title">{t('appName')}</div>
          <select className="worker-select" aria-label={t('worker')} value={workerId} onChange={e => chooseWorker(e.target.value)}>
            {WORKERS.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <span className={`net ${online ? 'net-on' : 'net-off'}`}>{online ? t('online') : t('offline')}</span>
      </header>

      {!online && <div className="offline-banner">{t('offlineBanner')}</div>}

      <div className="phone-body">
        {view === 'form' && (
          <IntakeForm incomeLimit={incomeLimit} onSave={save} onCancel={() => setView('list')} />
        )}

        {view === 'done' && lastSaved && (
          <div className="done">
            <Stamp eligibility={lastSaved.eligibility} size="lg" />
            <h2>{t('saved')}</h2>
            <p className="case-id">{lastSaved.id}</p>
            <p>{online ? t('savedOnline') : t('savedOffline')}</p>
            <button className="btn btn-primary" onClick={() => setView('form')}>{t('another')}</button>
            <button className="btn btn-quiet" onClick={() => setView('list')}>{t('viewRecords')}</button>
          </div>
        )}

        {view === 'list' && (
          <>
            <button className="btn btn-primary btn-wide" onClick={() => setView('form')}>{t('newIntake')}</button>
            <div className="list-head">
              <h2>{t('myRecords')}</h2>
              {pendingCount > 0 && (
                <button className="btn btn-quiet btn-small" disabled={!online || syncing} onClick={runSync}>
                  {syncing ? t('syncing') : `${t('syncNow')} (${pendingCount})`}
                </button>
              )}
            </div>
            {records.length === 0 && <p className="empty">{t('noRecords')}</p>}
            <ul className="rec-list">
              {records.map(r => (
                <li key={r.id} className="rec">
                  <div className="rec-main">
                    <strong>{r.beneficiary.name}</strong>
                    <span>{r.village} · {t(r.issue.category)}</span>
                    <span className={`sync sync-${r.syncStatus}`}>
                      {r.syncStatus === 'synced' ? t('synced') : r.syncStatus === 'failed' ? t('failed') : t('pending')}
                    </span>
                  </div>
                  <Stamp eligibility={r.eligibility} size="sm" />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
