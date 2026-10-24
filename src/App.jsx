import { lazy, Suspense, useCallback, useState } from 'react'
import { LangContext, STRINGS } from './lib/i18n.js'
import { useBrowserOnline } from './lib/useOnline.js'
import { loadSettings, saveSettings } from './lib/db.js'
import FieldApp from './components/FieldApp.jsx'
// The dashboard (charts and map) is loaded only when a manager opens it,
// so the field app stays small and fast on low-end phones.
const Dashboard = lazy(() => import('./components/Dashboard.jsx'))

export default function App() {
  const [mode, setMode] = useState('field')
  const [lang, setLang] = useState('kn')
  const [simulateOffline, setSimulateOffline] = useState(false)
  const [settings, setSettings] = useState(loadSettings)
  const [refreshKey, setRefreshKey] = useState(0)
  const browserOnline = useBrowserOnline()
  const online = browserOnline && !simulateOffline
  const s = STRINGS[lang]

  const updateSettings = next => { setSettings(next); saveSettings(next) }
  const onSynced = useCallback(() => setRefreshKey(k => k + 1), [])

  return (
    <LangContext.Provider value={lang}>
      <div className={`app lang-${lang}`}>
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">ಸ</span>
            <div>
              <div className="brand-name">Sahaya</div>
              <div className="brand-tag">{s.tagline}</div>
            </div>
          </div>
          <nav className="seg" aria-label="View">
            <button aria-pressed={mode === 'field'} onClick={() => setMode('field')}>{s.fieldApp}</button>
            <button aria-pressed={mode === 'dashboard'} onClick={() => setMode('dashboard')}>{s.dashboard}</button>
          </nav>
          <div className="top-tools">
            <div className="seg seg-small" aria-label="Language">
              <button aria-pressed={lang === 'kn'} onClick={() => setLang('kn')} lang="kn">ಕನ್ನಡ</button>
              <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={simulateOffline} onChange={e => setSimulateOffline(e.target.checked)} />
              <span>{s.simulateOffline}</span>
            </label>
          </div>
        </header>

        <main className={mode === 'field' ? 'main-field' : 'main-dash'}>
          {mode === 'field' ? (
            <div className="field-stage">
              <FieldApp online={online} incomeLimit={settings.incomeLimit} onSynced={onSynced} />
              <aside className="stage-note">
                <h2>How the field app works</h2>
                <p>Paralegals meet people in villages where the network drops. Every intake is saved on the phone first, then sent to the dashboard when the network returns. Failed uploads are retried automatically.</p>
                <p>While the worker asks the Section 12 questions, the app works out on the spot whether the person qualifies for free legal aid, and on which ground.</p>
                <p>Try it: tick “Simulate no network” above, record an intake, then untick it and watch it send.</p>
              </aside>
            </div>
          ) : (
            <Suspense fallback={<div className="dash-empty"><p>Loading dashboard…</p></div>}>
              <Dashboard settings={settings} onSettings={updateSettings} refreshKey={refreshKey} />
            </Suspense>
          )}
        </main>
      </div>
    </LangContext.Provider>
  )
}
