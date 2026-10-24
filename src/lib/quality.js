/**
 * Data quality checks for the manager dashboard.
 * Field data is messy, so the dashboard flags records a coordinator
 * should look at before using them in a report.
 */

export const GPS_ACCURACY_LIMIT_M = 100

const normalise = s => (s ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ')

export function qualityIssues(record, allRecords = []) {
  const issues = []
  const b = record.beneficiary ?? {}

  if (!record.gps) issues.push({ code: 'no_gps', label: 'No GPS location' })
  else if (record.gps.accuracy > GPS_ACCURACY_LIMIT_M)
    issues.push({ code: 'weak_gps', label: `GPS accuracy worse than ${GPS_ACCURACY_LIMIT_M} m` })

  if (!record.photo) issues.push({ code: 'no_photo', label: 'No document photo' })
  if (!record.consent) issues.push({ code: 'no_consent', label: 'Consent not recorded' })

  const age = Number(b.age)
  if (!Number.isFinite(age) || age < 0 || age > 110) issues.push({ code: 'bad_age', label: 'Age missing or out of range' })

  if (b.annualIncome === '' || b.annualIncome == null) issues.push({ code: 'no_income', label: 'Income not recorded' })

  // Possible duplicate: same name and village recorded within 30 days.
  const thirtyDays = 30 * 24 * 3600 * 1000
  const dup = allRecords.some(o =>
    o.id !== record.id &&
    normalise(o.beneficiary?.name) === normalise(b.name) &&
    normalise(o.village) === normalise(record.village) &&
    Math.abs(new Date(o.createdAt) - new Date(record.createdAt)) < thirtyDays,
  )
  if (dup) issues.push({ code: 'duplicate', label: 'Possible duplicate (same name and village within 30 days)' })

  return issues
}
