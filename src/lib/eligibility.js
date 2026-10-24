/**
 * Free legal aid eligibility engine.
 *
 * Implements Section 12 of the Legal Services Authorities Act, 1987.
 * A person qualifies for free legal services if they meet ANY ONE of the
 * clauses below. Clauses (a) to (g) are status-based and do not depend on
 * income. Clause (h) is income-based and the ceiling is set by each State,
 * so it is passed in as a setting instead of being hard-coded.
 *
 * This is a pure function: same input, same output, no side effects.
 * That keeps it easy to unit test (see eligibility.test.js).
 */

export const DEFAULT_INCOME_LIMIT = 100000 // Karnataka ceiling as published by Nyaaya. Configurable in Settings.

export const CLAUSES = {
  a: { key: 'scst', label: 'Member of a Scheduled Caste or Scheduled Tribe' },
  b: { key: 'trafficking', label: 'Victim of trafficking or begar (forced labour)' },
  c: { key: null, label: 'Woman or child' },
  d: { key: 'disability', label: 'Person with disability' },
  e: { key: 'disaster', label: 'Victim of mass disaster, ethnic violence, caste atrocity or natural or industrial disaster' },
  f: { key: 'industrialWorker', label: 'Industrial workman' },
  g: { key: 'custody', label: 'In custody, including protective home, juvenile home or psychiatric hospital' },
  h: { key: null, label: 'Annual income below the State limit' },
}

/**
 * @param {object} person  { age, gender, annualIncome, flags: { scst, trafficking, ... } }
 * @param {number} incomeLimit  State income ceiling in rupees
 * @returns {{ eligible: boolean, grounds: Array<{clause: string, label: string}>, warnings: string[] }}
 */
export function checkEligibility(person, incomeLimit = DEFAULT_INCOME_LIMIT) {
  const grounds = []
  const warnings = []
  const flags = person?.flags ?? {}

  // Clauses (a), (b), (d), (e), (f), (g) map directly to yes/no questions.
  for (const [clause, { key, label }] of Object.entries(CLAUSES)) {
    if (key && flags[key] === true) grounds.push({ clause, label })
  }

  // Clause (c): women and children (under 18) qualify regardless of income.
  const age = Number(person?.age)
  const isChild = Number.isFinite(age) && age >= 0 && age < 18
  if (person?.gender === 'female' || isChild) {
    grounds.push({ clause: 'c', label: CLAUSES.c.label })
  }

  // Clause (h): income test. Missing income is not treated as zero.
  const income = person?.annualIncome
  if (income === null || income === undefined || income === '') {
    warnings.push('Annual income not recorded')
  } else if (Number(income) < incomeLimit) {
    grounds.push({ clause: 'h', label: CLAUSES.h.label })
  }

  if (!Number.isFinite(age)) warnings.push('Age not recorded')

  // Keep clause order stable (a, b, c ...) so the UI and CSV are predictable.
  grounds.sort((x, y) => x.clause.localeCompare(y.clause))

  return { eligible: grounds.length > 0, grounds, warnings }
}
