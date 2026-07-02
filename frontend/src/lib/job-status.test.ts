import { describe, expect, it } from 'vitest'
import {
  ALLOWED_TRANSITIONS,
  ALL_JOB_STATUSES,
  JOB_STATUS_LABELS,
  MANUAL_PICKER_HIDDEN,
  manualTransitionTargets,
} from './job-status'

describe('frontend job-status mirror', () => {
  it('has a label for every status', () => {
    for (const status of ALL_JOB_STATUSES) {
      expect(JOB_STATUS_LABELS[status]).toBeTruthy()
    }
  })

  it('has a transition list for every status', () => {
    for (const status of ALL_JOB_STATUSES) {
      expect(Array.isArray(ALLOWED_TRANSITIONS[status])).toBe(true)
    }
  })

  it('keeps terminal states closed', () => {
    expect(ALLOWED_TRANSITIONS.CLOSED).toEqual([])
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([])
  })

  it('only references known statuses as transition targets', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        expect(ALL_JOB_STATUSES).toContain(target)
      }
    }
  })

  it('never offers S12-only states in the manual picker', () => {
    for (const status of ALL_JOB_STATUSES) {
      for (const hidden of MANUAL_PICKER_HIDDEN) {
        expect(manualTransitionTargets(status)).not.toContain(hidden)
      }
    }
  })

  it('still lets a COMPLETED job be reactivated manually', () => {
    expect(manualTransitionTargets('COMPLETED')).toContain('ACTIVE')
  })
})
