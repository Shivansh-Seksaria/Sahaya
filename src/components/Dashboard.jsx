import { useEffect, useMemo, useState, Fragment } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { useT } from '../lib/i18n.js'
import { api, deviceStore } from '../lib/db.js'
import { generateDemoRecords } from '../lib/demoData.js'
import { qualityIssues } from '../lib/quality.js'
import { toCsv, downloadCsv, CASE_COLUMNS } from '../lib/csv.js'
import { checkEligibility, CLAUSES } from '../lib/eligibility.js'
import { PLACES, WORKERS, ISSUES, STATUSES } from '../lib/places.js'
import CaseMap from './CaseMap.jsx'
import Stamp from './Stamp.jsx'

const INK = '#24306B'
const STATUS_LABEL = { new: 'New', referred: 'Referred to DLSA', in_progress: 'In progress', resolved: 'Resolved' }
const TALUKS = [...new Set(PLACES.map(p => p.taluk))]

function weekStart(iso) {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export default function Dashboard({ settings, onSettings, refreshKey }) {
  const t = useT()
  const [records, setRecords] = useState([])
  const [onDevices, setOnDevices] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ taluk: '', category: '', status: '', eligible: '', worker: '', q: '' })
  const [openId, setOpenId] = useState(null)
  const [showQuality, setShowQuality] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  async function load() {
    const [server, device] = await Promise.all([api.listRecords(), deviceStore.getAll()])
    setRecords(server)
    setOnDevices(device.filter(r => r.syncStatus !== 'synced').length)
    setLoading(false)
  }
  useEffect(() => { load() }, [refreshKey])

  async function loadDemo() {
    setLoading(true)
    await api.seed(generateDemoRecords(140, settings.incomeLimit))
    await load()
  }

  async function resetAll() {
    if (!confirm('Remove all records from the dashboard and this device?')) return
    await api.clear()
    await deviceStore.clear()
    await load()
  }

  async function changeStatus(id, status) {
    await api.updateStatus(id, status)
    setRecords(rs => rs.map(r => (r.id === id ? { ...r, status } : r)))
  }

  // Eligibility is recomputed with the current income limit, so changing
  // the State limit in Settings updates the whole dashboard at once.
  const enriched = useMemo(() => records.map(r => ({
    ...r,
    eligibility: checkEligibility(r.beneficiary, settings.incomeLimit),
    issues: qualityIssues(r, records),
  })), [records, settings.incomeLimit])

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return enriched.filter(r =>
      (!filters.taluk || r.taluk === filters.taluk) &&
      (!filters.category || r.issue.category === filters.category) &&
      (!filters.status || r.status === filters.status) &&
      (!filters.worker || r.workerId === filters.worker) &&
      (!filters.eligible || String(r.eligibility.eligible) === filters.eligible) &&
      (!q || r.beneficiary.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.village.toLowerCase().includes(q)),
    )
  }, [enriched, filters])

  const stats = useMemo(() => {
    const n = filtered.length || 1
    const eligible = filtered.filter(r => r.eligibility.eligible).length
    const urgentOpen = filtered.filter(r => r.issue.urgency === 'high' && r.status !== 'resolved').length
    const resolved = filtered.filter(r => r.status === 'resolved').length
    const flagged = filtered.filter(r => r.issues.length).length
    return { total: filtered.length, eligiblePct: Math.round((eligible / n) * 100), urgentOpen, resolvedPct: Math.round((resolved / n) * 100), flagged }
  }, [filtered])

  const byIssue = useMemo(() =>
    ISSUES.map(k => ({ name: t(k), count: filtered.filter(r => r.issue.category === k).length }))
      .sort((a, b) => b.count - a.count), [filtered, t])

  const byGround = useMemo(() =>
    Object.entries(CLAUSES).map(([clause, c]) => ({
      name: `(${clause})`,
      label: c.label,
      count: filtered.filter(r => r.eligibility.grounds.some(g => g.clause === clause)).length,
    })), [filtered])

  const byWeek = useMemo(() => {
    const map = new Map()
    for (const r of filtered) {
      const k = weekStart(r.createdAt).toISOString().slice(0, 10)
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return [...map.entries()].sort().map(([week, count]) => ({
      week: new Date(week).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), count,
    }))
  }, [filtered])

  const byWorker = useMemo(() => WORKERS.map(w => {
    const mine = filtered.filter(r => r.workerId === w.id)
    return {
      ...w,
      total: mine.length,
      flagged: mine.filter(r => r.issues.length).length,
      noGps: mine.filter(r => r.issues.some(i => i.code === 'no_gps' || i.code === 'weak_gps')).length,
    }
  }), [filtered])

  const qualitySummary = useMemo(() => {
    const counts = {}
    for (const r of filtered) for (const i of r.issues) counts[i.label] = (counts[i.label] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(0) }
  const anyFilter = Object.values(filters).some(Boolean)
  const tableRows = showQuality ? filtered.filter(r => r.issues.length) : filtered
  const pageCount = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = tableRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  if (loading) return <div className="dash-empty"><p>Loading…</p></div>

  if (records.length === 0) {
    return (
      <div className="dash-empty">
        <h2>No cases have reached the dashboard yet</h2>
        <p>Cases appear here once a field worker’s phone sends them. Record an intake in the field app, or load a sample district to explore the dashboard.</p>
        {onDevices > 0 && <p className="warn-line">{onDevices} intake(s) are still waiting on a field phone.</p>}
        <button className="btn btn-primary" onClick={loadDemo}>Load sample data for Dharwad district</button>
      </div>
    )
  }

  return (
    <div className="dash">
      <div className="dash-top">
        <div>
          <h1>Legal aid cases, Dharwad district</h1>
          <p className="sub">
            {records.length} cases received
            {onDevices > 0 && <> · <span className="warn-text">{onDevices} still waiting on field phones</span></>}
          </p>
        </div>
        <div className="dash-actions">
          <label className="inline-setting">
            <span>State income limit (₹)</span>
            <input
              inputMode="numeric"
              value={settings.incomeLimit}
              onChange={e => onSettings({ ...settings, incomeLimit: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            />
          </label>
          <button className="btn btn-primary" onClick={() => downloadCsv(`legal-aid-cases-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(filtered, CASE_COLUMNS))}>
            Export {filtered.length} cases as CSV
          </button>
        </div>
      </div>

      <div className="filters" role="search">
        <input placeholder="Search name, village or case ID" value={filters.q} onChange={e => setFilter('q', e.target.value)} />
        <select value={filters.taluk} onChange={e => setFilter('taluk', e.target.value)}>
          <option value="">All taluks</option>{TALUKS.map(x => <option key={x}>{x}</option>)}
        </select>
        <select value={filters.category} onChange={e => setFilter('category', e.target.value)}>
          <option value="">All problems</option>{ISSUES.map(x => <option key={x} value={x}>{t(x)}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>{STATUSES.map(x => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}
        </select>
        <select value={filters.eligible} onChange={e => setFilter('eligible', e.target.value)}>
          <option value="">Eligible and not</option><option value="true">Eligible only</option><option value="false">Not eligible only</option>
        </select>
        <select value={filters.worker} onChange={e => setFilter('worker', e.target.value)}>
          <option value="">All field workers</option>{WORKERS.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {anyFilter && <button className="btn btn-quiet btn-small" onClick={() => { setFilters({ taluk: '', category: '', status: '', eligible: '', worker: '', q: '' }); setPage(0) }}>Clear filters</button>}
      </div>

      <div className="kpis">
        <div className="kpi"><span className="kpi-n">{stats.total}</span><span className="kpi-l">intakes in view</span></div>
        <div className="kpi"><span className="kpi-n">{stats.eligiblePct}%</span><span className="kpi-l">eligible for free legal aid</span></div>
        <div className="kpi kpi-urgent"><span className="kpi-n">{stats.urgentOpen}</span><span className="kpi-l">urgent cases still open</span></div>
        <div className="kpi"><span className="kpi-n">{stats.resolvedPct}%</span><span className="kpi-l">resolved</span></div>
        <button className="kpi kpi-btn" onClick={() => { setShowQuality(s => !s); setPage(0) }} aria-pressed={showQuality}>
          <span className="kpi-n">{stats.flagged}</span>
          <span className="kpi-l">{showQuality ? 'showing records to check' : 'records need checking'}</span>
        </button>
      </div>

      <div className="grid">
        <section className="panel">
          <h2>What people need help with</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byIssue} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Cases" fill={INK} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <h2>Grounds of eligibility under Section 12</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byGround} margin={{ right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={(n, p) => p?.[0]?.payload?.label ?? n} />
              <Bar dataKey="count" name="People" fill="#7C6F45" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="note">A person can qualify on more than one ground. Hover a bar to see the clause.</p>
        </section>

        <section className="panel panel-wide">
          <h2>Where cases were recorded</h2>
          <CaseMap records={filtered} t={t} />
          <p className="note">Red marks urgent cases that are still open. {filtered.filter(r => !r.gps).length} cases in view have no location.</p>
        </section>

        <section className="panel">
          <h2>Intakes per week</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={byWeek} margin={{ right: 16 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line dataKey="count" name="Intakes" stroke={INK} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <h2>Field workers</h2>
          <table className="mini">
            <thead><tr><th>Name</th><th>Intakes</th><th>To check</th><th>Location problems</th></tr></thead>
            <tbody>
              {byWorker.map(w => (
                <tr key={w.id}><td>{w.name}</td><td>{w.total}</td><td>{w.flagged}</td><td>{w.noGps}</td></tr>
              ))}
            </tbody>
          </table>
          {qualitySummary.length > 0 && (
            <>
              <h3>Most common data problems</h3>
              <ul className="quality-list">
                {qualitySummary.slice(0, 5).map(([label, n]) => <li key={label}><span>{label}</span><strong>{n}</strong></li>)}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="panel register">
        <div className="register-head">
          <h2>{showQuality ? 'Records that need checking' : 'Case register'}</h2>
          <span className="sub">{tableRows.length} cases</span>
        </div>
        <div className="table-wrap">
          <table className="cases">
            <thead>
              <tr><th>Case</th><th>Person</th><th>Village</th><th>Problem</th><th>Urgency</th><th>Verdict</th><th>Status</th></tr>
            </thead>
            <tbody>
              {pageRows.map(r => (
                <Fragment key={r.id}>
                  <tr className={openId === r.id ? 'open' : ''}>
                    <td>
                      <button className="link" onClick={() => setOpenId(openId === r.id ? null : r.id)} aria-expanded={openId === r.id}>
                        {r.id}
                      </button>
                      <div className="muted">{new Date(r.createdAt).toLocaleDateString('en-IN')}</div>
                    </td>
                    <td>{r.beneficiary.name}<div className="muted">{r.beneficiary.age}, {t(r.beneficiary.gender)}</div></td>
                    <td>{r.village}<div className="muted">{r.taluk}</div></td>
                    <td>{t(r.issue.category)}</td>
                    <td><span className={`urg urg-${r.issue.urgency}`}>{t(r.issue.urgency)}</span></td>
                    <td>{r.eligibility.eligible ? `Eligible (${r.eligibility.grounds.map(g => g.clause).join(', ')})` : 'Not eligible'}</td>
                    <td>
                      <select aria-label={`Status of ${r.id}`} value={r.status} onChange={e => changeStatus(r.id, e.target.value)}>
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                  </tr>
                  {openId === r.id && (
                    <tr className="detail-row">
                      <td colSpan={7}>
                        <div className="detail">
                          <Stamp eligibility={r.eligibility} size="lg" />
                          <div className="detail-text">
                            <p>{r.issue.description}</p>
                            <ul>
                              {r.eligibility.grounds.map(g => <li key={g.clause}>Section 12({g.clause}): {g.label}</li>)}
                            </ul>
                            <p className="muted">
                              Recorded by {r.workerName}
                              {r.gps ? ` at ${r.gps.lat.toFixed(4)}, ${r.gps.lng.toFixed(4)} (±${r.gps.accuracy} m)` : ', no location'}
                              {r.beneficiary.phone ? `. Phone ${r.beneficiary.phone}` : ''}
                            </p>
                            {r.issues.length > 0 && (
                              <p className="warn-line">Check: {r.issues.map(i => i.label).join('. ')}.</p>
                            )}
                          </div>
                          {r.photo && r.photo !== 'demo' && <img className="detail-photo" src={r.photo} alt="Document photo" />}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="pager">
            <button className="btn btn-quiet btn-small" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
            <span className="muted">Page {safePage + 1} of {pageCount}</span>
            <button className="btn btn-quiet btn-small" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</button>
          </div>
        )}
      </section>

      <div className="dash-foot">
        {!records.some(r => r.id.startsWith('LA-DEMO')) && (
          <button className="btn btn-quiet btn-small" onClick={loadDemo}>Add sample data</button>
        )}
        <button className="btn btn-quiet btn-small" onClick={resetAll}>Remove all data</button>
        <span className="muted">Eligibility follows Section 12 of the Legal Services Authorities Act, 1987. Check the income limit against your State’s current notification.</span>
      </div>
    </div>
  )
}
