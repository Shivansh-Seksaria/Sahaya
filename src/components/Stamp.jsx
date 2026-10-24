import { useT } from '../lib/i18n.js'

/** The eligibility verdict, drawn like an ink stamp on a case file. */
export default function Stamp({ eligibility, size = 'md' }) {
  const t = useT()
  if (!eligibility) return null
  const ok = eligibility.eligible
  const clauses = eligibility.grounds.map(g => g.clause).join(', ')
  return (
    <div className={`stamp stamp-${size} ${ok ? 'stamp-ok' : 'stamp-no'}`} role="status">
      <span className="stamp-main">{ok ? t('eligible') : t('notEligible')}</span>
      <span className="stamp-sub">{ok ? `S.12 (${clauses})` : 'S.12'}</span>
    </div>
  )
}
