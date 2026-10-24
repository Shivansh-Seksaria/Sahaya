import { describe, it, expect } from 'vitest'
import { qualityIssues } from './quality.js'

const good = {
  id: '1',
  createdAt: '2026-10-01T10:00:00Z',
  village: 'Garag',
  gps: { lat: 15.5, lng: 74.9, accuracy: 12 },
  photo: 'data:image/jpeg;base64,xyz',
  consent: true,
  beneficiary: { name: 'Savitri K', age: 34, annualIncome: 60000 },
}

const codes = (r, all) => qualityIssues(r, all).map(i => i.code)

describe('qualityIssues', () => {
  it('passes a complete record', () => {
    expect(codes(good, [good])).toEqual([])
  })

  it('flags missing and weak GPS', () => {
    expect(codes({ ...good, gps: null })).toContain('no_gps')
    expect(codes({ ...good, gps: { ...good.gps, accuracy: 450 } })).toContain('weak_gps')
  })

  it('flags missing photo, consent, income and impossible ages', () => {
    const bad = { ...good, photo: null, consent: false, beneficiary: { name: 'X', age: 140, annualIncome: '' } }
    expect(codes(bad)).toEqual(expect.arrayContaining(['no_photo', 'no_consent', 'bad_age', 'no_income']))
  })

  it('flags a likely duplicate ignoring case and spacing', () => {
    const twin = { ...good, id: '2', createdAt: '2026-10-05T09:00:00Z', beneficiary: { ...good.beneficiary, name: '  savitri   k ' } }
    expect(codes(good, [good, twin])).toContain('duplicate')
  })

  it('does not flag the same name recorded months apart', () => {
    const later = { ...good, id: '2', createdAt: '2027-02-01T09:00:00Z' }
    expect(codes(good, [good, later])).not.toContain('duplicate')
  })
})
