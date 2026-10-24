import { describe, it, expect } from 'vitest'
import { checkEligibility } from './eligibility.js'

const base = { age: 40, gender: 'male', annualIncome: 250000, flags: {} }

describe('checkEligibility (Section 12, LSA Act 1987)', () => {
  it('rejects an adult man above the income limit with no other ground', () => {
    const r = checkEligibility(base, 100000)
    expect(r.eligible).toBe(false)
    expect(r.grounds).toEqual([])
  })

  it('accepts any woman regardless of income, under clause (c)', () => {
    const r = checkEligibility({ ...base, gender: 'female' }, 100000)
    expect(r.eligible).toBe(true)
    expect(r.grounds.map(g => g.clause)).toEqual(['c'])
  })

  it('accepts a child under 18, under clause (c)', () => {
    const r = checkEligibility({ ...base, age: 17 }, 100000)
    expect(r.grounds.map(g => g.clause)).toContain('c')
  })

  it('does not treat an 18 year old man as a child', () => {
    const r = checkEligibility({ ...base, age: 18 }, 100000)
    expect(r.eligible).toBe(false)
  })

  it('applies the income test strictly below the limit, under clause (h)', () => {
    expect(checkEligibility({ ...base, annualIncome: 99999 }, 100000).eligible).toBe(true)
    expect(checkEligibility({ ...base, annualIncome: 100000 }, 100000).eligible).toBe(false)
  })

  it('respects a different State limit', () => {
    expect(checkEligibility({ ...base, annualIncome: 250000 }, 300000).eligible).toBe(true)
  })

  it('lists every ground that applies, in clause order', () => {
    const r = checkEligibility(
      { age: 30, gender: 'female', annualIncome: 50000, flags: { scst: true, disability: true } },
      100000,
    )
    expect(r.grounds.map(g => g.clause)).toEqual(['a', 'c', 'd', 'h'])
  })

  it('warns instead of guessing when income is missing', () => {
    const r = checkEligibility({ ...base, annualIncome: '' }, 100000)
    expect(r.eligible).toBe(false)
    expect(r.warnings).toContain('Annual income not recorded')
  })

  it('handles status grounds like custody and industrial workman', () => {
    expect(checkEligibility({ ...base, flags: { custody: true } }).grounds[0].clause).toBe('g')
    expect(checkEligibility({ ...base, flags: { industrialWorker: true } }).grounds[0].clause).toBe('f')
  })
})
