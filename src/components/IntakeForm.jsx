import { useMemo, useState } from 'react'
import { useT } from '../lib/i18n.js'
import { PLACES, ISSUES } from '../lib/places.js'
import { checkEligibility } from '../lib/eligibility.js'
import Stamp from './Stamp.jsx'

const STEPS = ['stepPerson', 'stepSituation', 'stepProblem', 'stepVerify']
const FLAGS = ['scst', 'trafficking', 'disability', 'disaster', 'industrialWorker', 'custody']

const empty = {
  name: '', age: '', gender: '', phone: '', village: '',
  flags: Object.fromEntries(FLAGS.map(f => [f, false])),
  annualIncome: '',
  category: '', urgency: 'medium', description: '',
  gps: null, photo: null, consent: false,
}

/** Shrinks a camera photo to a small JPEG so it fits on cheap phones and slow uploads. */
function compressImage(file, maxSide = 640) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/jpeg', 0.6))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function IntakeForm({ incomeLimit, onSave, onCancel }) {
  const t = useT()
  const [step, setStep] = useState(0)
  const [f, setF] = useState(empty)
  const [errors, setErrors] = useState({})
  const [gpsState, setGpsState] = useState('idle') // idle | loading | done | error

  const set = (key, value) => setF(prev => ({ ...prev, [key]: value }))
  const setFlag = (key, value) => setF(prev => ({ ...prev, flags: { ...prev.flags, [key]: value } }))

  // Eligibility updates live as the worker answers questions.
  const eligibility = useMemo(
    () => checkEligibility({ age: f.age === '' ? NaN : Number(f.age), gender: f.gender, annualIncome: f.annualIncome, flags: f.flags }, incomeLimit),
    [f.age, f.gender, f.annualIncome, f.flags, incomeLimit],
  )

  function validate(s) {
    const e = {}
    if (s === 0) {
      if (!f.name.trim()) e.name = true
      const age = Number(f.age)
      if (f.age === '' || !Number.isInteger(age) || age < 0 || age > 110) e.age = true
      if (!f.gender) e.gender = true
      if (!f.village) e.village = true
      if (f.phone && !/^[6-9]\d{9}$/.test(f.phone)) e.phone = true
    }
    if (s === 1 && f.annualIncome !== '' && (Number(f.annualIncome) < 0 || Number.isNaN(Number(f.annualIncome)))) e.annualIncome = true
    if (s === 2) {
      if (!f.category) e.category = true
      if (f.description.trim().length < 10) e.description = true
    }
    if (s === 3 && !f.consent) e.consent = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => validate(step) && setStep(step + 1)

  function captureGps() {
    if (!('geolocation' in navigator)) return setGpsState('error')
    setGpsState('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        set('gps', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) })
        setGpsState('done')
      },
      () => setGpsState('error'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0]
    if (file) set('photo', await compressImage(file))
  }

  function submit() {
    if (!validate(3)) return
    const place = PLACES.find(p => p.village === f.village)
    onSave({
      beneficiary: {
        name: f.name.trim(),
        age: Number(f.age),
        gender: f.gender,
        phone: f.phone,
        annualIncome: f.annualIncome === '' ? '' : Number(f.annualIncome),
        flags: f.flags,
      },
      village: f.village,
      taluk: place?.taluk ?? '',
      issue: { category: f.category, urgency: f.urgency, description: f.description.trim() },
      eligibility,
      gps: f.gps,
      photo: f.photo,
      consent: f.consent,
    })
  }

  const err = k => (errors[k] ? 'field field-error' : 'field')

  return (
    <div className="intake">
      <ol className="steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'is-on' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="step-n">{i + 1}</span>
            <span className="step-l">{t(s)}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="form-page">
          <label className={err('name')}>
            <span>{t('name')}</span>
            <input value={f.name} onChange={e => set('name', e.target.value)} autoComplete="off" />
          </label>
          <div className="row2">
            <label className={err('age')}>
              <span>{t('age')}</span>
              <input inputMode="numeric" value={f.age} onChange={e => set('age', e.target.value.replace(/\D/g, ''))} />
            </label>
            <label className={err('village')}>
              <span>{t('village')}</span>
              <select value={f.village} onChange={e => set('village', e.target.value)}>
                <option value="">…</option>
                {PLACES.map(p => <option key={p.village} value={p.village}>{p.village} ({p.taluk})</option>)}
              </select>
            </label>
          </div>
          <fieldset className={err('gender')}>
            <legend>{t('gender')}</legend>
            <div className="chips">
              {['female', 'male', 'other'].map(g => (
                <button type="button" key={g} className={`chip ${f.gender === g ? 'chip-on' : ''}`} aria-pressed={f.gender === g} onClick={() => set('gender', g)}>{t(g)}</button>
              ))}
            </div>
          </fieldset>
          <label className={err('phone')}>
            <span>{t('phone')}</span>
            <input inputMode="tel" value={f.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} />
          </label>
        </section>
      )}

      {step === 1 && (
        <section className="form-page">
          <p className="hint">{t('situationHint')}</p>
          <div className="checks">
            {FLAGS.map(k => (
              <label key={k} className={`check ${f.flags[k] ? 'check-on' : ''}`}>
                <input type="checkbox" checked={f.flags[k]} onChange={e => setFlag(k, e.target.checked)} />
                <span>{t(k)}</span>
              </label>
            ))}
          </div>
          <label className={err('annualIncome')}>
            <span>{t('income')}</span>
            <input inputMode="numeric" value={f.annualIncome} onChange={e => set('annualIncome', e.target.value.replace(/\D/g, ''))} />
            <small>{t('incomeHint')}</small>
          </label>
          <div className="live-verdict">
            <Stamp eligibility={eligibility} />
            <div>
              <strong>{eligibility.eligible ? t('eligibleFull') : t('notEligibleFull')}</strong>
              <ul>{eligibility.grounds.map(g => <li key={g.clause}>({g.clause}) {g.label}</li>)}</ul>
              <small>{t('sec12')}</small>
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="form-page">
          <fieldset className={err('category')}>
            <legend>{t('issueType')}</legend>
            <div className="chips">
              {ISSUES.map(k => (
                <button type="button" key={k} className={`chip ${f.category === k ? 'chip-on' : ''}`} aria-pressed={f.category === k} onClick={() => set('category', k)}>{t(k)}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t('urgency')}</legend>
            <div className="chips">
              {['low', 'medium', 'high'].map(k => (
                <button type="button" key={k} className={`chip ${f.urgency === k ? 'chip-on' : ''} ${k === 'high' ? 'chip-urgent' : ''}`} aria-pressed={f.urgency === k} onClick={() => set('urgency', k)}>{t(k)}</button>
              ))}
            </div>
          </fieldset>
          <label className={err('description')}>
            <span>{t('description')}</span>
            <textarea rows={5} value={f.description} onChange={e => set('description', e.target.value)} />
          </label>
        </section>
      )}

      {step === 3 && (
        <section className="form-page">
          <div className="verify-block">
            <h3>{t('location')}</h3>
            {f.gps ? (
              <p className="ok-line">{t('gpsRecorded')}: {f.gps.lat.toFixed(4)}, {f.gps.lng.toFixed(4)} ({t('accuracy')} ±{f.gps.accuracy} m)</p>
            ) : gpsState === 'error' ? (
              <p className="warn-line">{t('gpsFailed')}</p>
            ) : null}
            <button type="button" className="btn btn-quiet" onClick={captureGps} disabled={gpsState === 'loading'}>
              {gpsState === 'loading' ? t('gettingGps') : t('captureGps')}
            </button>
          </div>
          <div className="verify-block">
            <h3>{t('photo')}</h3>
            {f.photo && <img className="photo-preview" src={f.photo} alt="" />}
            <label className="btn btn-quiet file-btn">
              {f.photo ? t('retakePhoto') : t('addPhoto')}
              <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
            </label>
          </div>
          <label className={`check consent ${errors.consent ? 'field-error' : ''} ${f.consent ? 'check-on' : ''}`}>
            <input type="checkbox" checked={f.consent} onChange={e => set('consent', e.target.checked)} />
            <span>{t('consent')}</span>
          </label>
        </section>
      )}

      <div className="form-nav">
        <button type="button" className="btn btn-quiet" onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>{t('back')}</button>
        {step < 3
          ? <button type="button" className="btn btn-primary" onClick={next}>{t('next')}</button>
          : <button type="button" className="btn btn-primary" onClick={submit}>{t('save')}</button>}
      </div>
    </div>
  )
}
