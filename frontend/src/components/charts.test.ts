import { describe, expect, it } from 'vitest'
import { segmentsFromStatusMap, statusTone, utilizationTone } from './charts'

describe('statusTone', () => {
  it('maps known statuses to the right semantic color', () => {
    expect(statusTone('ACTIVE').bar).toBe('bg-emerald-500')
    expect(statusTone('EXPIRED').bar).toBe('bg-red-500')
    expect(statusTone('PLANNED').bar).toBe('bg-amber-500')
    expect(statusTone('DRAFT').bar).toBe('bg-slate-400')
  })

  it('falls back to info (blue) for unknown statuses', () => {
    expect(statusTone('SOMETHING_NEW').bar).toBe('bg-blue-500')
  })
})

describe('utilizationTone', () => {
  it('is healthy up to 75%', () => {
    expect(utilizationTone(0)).toBe('success')
    expect(utilizationTone(75)).toBe('success')
  })

  it('is busy between 76 and 100%', () => {
    expect(utilizationTone(76)).toBe('warning')
    expect(utilizationTone(100)).toBe('warning')
  })

  it('is overbooked above 100%', () => {
    expect(utilizationTone(101)).toBe('danger')
    expect(utilizationTone(150)).toBe('danger')
  })
})

describe('segmentsFromStatusMap', () => {
  it('drops zero buckets and sorts by descending count', () => {
    const segments = segmentsFromStatusMap({ ACTIVE: 2, PLANNED: 5, CANCELLED: 0 })
    expect(segments.map((s) => s.label)).toEqual(['Planned', 'Active'])
    expect(segments.every((s) => s.value > 0)).toBe(true)
  })

  it('assigns the matching tone to each segment', () => {
    const segments = segmentsFromStatusMap({ EXPIRED: 1 })
    expect(segments[0].tone).toBe('danger')
  })

  it('returns an empty array when everything is zero', () => {
    expect(segmentsFromStatusMap({ ACTIVE: 0 })).toEqual([])
  })
})
