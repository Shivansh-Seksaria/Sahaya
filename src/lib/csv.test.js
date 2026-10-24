import { describe, it, expect } from 'vitest'
import { toCsv } from './csv.js'

const cols = [
  { label: 'Name', get: r => r.name },
  { label: 'Note', get: r => r.note },
]

describe('toCsv', () => {
  it('writes a header and rows', () => {
    expect(toCsv([{ name: 'Ravi', note: 'ok' }], cols)).toBe('﻿Name,Note\nRavi,ok')
  })

  it('quotes commas, quotes and new lines', () => {
    const csv = toCsv([{ name: 'A, B', note: 'said "no"\nthen left' }], cols)
    expect(csv).toContain('"A, B"')
    expect(csv).toContain('"said ""no""\nthen left"')
  })

  it('keeps Kannada text intact', () => {
    expect(toCsv([{ name: 'ಸಾವಿತ್ರಿ', note: '' }], cols)).toContain('ಸಾವಿತ್ರಿ')
  })
})
