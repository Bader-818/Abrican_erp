import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate, formatPermissionLabel, initials } from './formatters'

describe('formatCurrency', () => {
  it('formats numbers as SAR by default', () => {
    expect(formatCurrency(1500)).toContain('1,500.00')
  })

  it('accepts numeric strings (Prisma Decimal output)', () => {
    expect(formatCurrency('2500.5')).toContain('2,500.50')
  })

  it('returns an em dash for nullish or non-numeric values', () => {
    expect(formatCurrency(null)).toBe('—')
    expect(formatCurrency(undefined)).toBe('—')
    expect(formatCurrency('abc')).toBe('—')
  })

  it('honors an explicit currency', () => {
    expect(formatCurrency(10, 'USD')).toContain('$')
  })
})

describe('formatDate', () => {
  it('returns an em dash for nullish input', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })

  it('formats an ISO date', () => {
    expect(formatDate('2026-06-14T00:00:00Z')).toMatch(/2026/)
  })
})

describe('formatPermissionLabel', () => {
  it('humanizes dotted permission keys', () => {
    expect(formatPermissionLabel('assignments.override')).toBe('Assignments › Override')
    expect(formatPermissionLabel('dashboard.operations.view')).toBe('Dashboard › Operations › View')
  })
})

describe('initials', () => {
  it('takes the first two name parts', () => {
    expect(initials('Omar Al-Shehri')).toBe('OA')
    expect(initials('System Administrator')).toBe('SA')
  })

  it('handles single names', () => {
    expect(initials('Admin')).toBe('A')
  })
})
