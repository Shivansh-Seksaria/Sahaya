/**
 * CSV export for donor and DLSA reporting.
 * Values are quoted so commas, quotes and line breaks in descriptions
 * do not break the columns. A UTF-8 BOM is added so Excel shows
 * Kannada text correctly.
 */

export function toCsv(rows, columns) {
  const escape = v => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map(c => escape(c.label)).join(',')
  const body = rows.map(r => columns.map(c => escape(c.get(r))).join(',')).join('\n')
  return '﻿' + header + '\n' + body
}

export const CASE_COLUMNS = [
  { label: 'Case ID', get: r => r.id },
  { label: 'Recorded on', get: r => r.createdAt?.slice(0, 10) },
  { label: 'Field worker', get: r => r.workerName },
  { label: 'Taluk', get: r => r.taluk },
  { label: 'Village', get: r => r.village },
  { label: 'Name', get: r => r.beneficiary?.name },
  { label: 'Age', get: r => r.beneficiary?.age },
  { label: 'Gender', get: r => r.beneficiary?.gender },
  { label: 'Annual income (INR)', get: r => r.beneficiary?.annualIncome },
  { label: 'Issue', get: r => r.issue?.category },
  { label: 'Urgency', get: r => r.issue?.urgency },
  { label: 'Eligible', get: r => (r.eligibility?.eligible ? 'Yes' : 'No') },
  { label: 'Section 12 grounds', get: r => (r.eligibility?.grounds ?? []).map(g => g.clause).join(' ') },
  { label: 'Status', get: r => r.status },
  { label: 'Latitude', get: r => r.gps?.lat },
  { label: 'Longitude', get: r => r.gps?.lng },
  { label: 'Description', get: r => r.issue?.description },
]

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
