import { JobStatus } from '@prisma/client';
import { ALLOWED_TRANSITIONS, isTransitionAllowed } from './job-status.constants';

describe('job status state machine', () => {
  it('allows the documented forward transitions', () => {
    expect(isTransitionAllowed(JobStatus.DRAFT, JobStatus.PLANNED)).toBe(true);
    expect(isTransitionAllowed(JobStatus.PLANNED, JobStatus.APPROVED)).toBe(true);
    expect(isTransitionAllowed(JobStatus.APPROVED, JobStatus.SCHEDULED)).toBe(true);
    expect(isTransitionAllowed(JobStatus.SCHEDULED, JobStatus.ACTIVE)).toBe(true);
    expect(isTransitionAllowed(JobStatus.ACTIVE, JobStatus.COMPLETED)).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(isTransitionAllowed(JobStatus.DRAFT, JobStatus.ACTIVE)).toBe(false);
    expect(isTransitionAllowed(JobStatus.DRAFT, JobStatus.COMPLETED)).toBe(false);
    expect(isTransitionAllowed(JobStatus.COMPLETED, JobStatus.CANCELLED)).toBe(false);
  });

  it('treats terminal states as having no outgoing transitions', () => {
    expect(ALLOWED_TRANSITIONS[JobStatus.CLOSED]).toEqual([]);
    expect(ALLOWED_TRANSITIONS[JobStatus.CANCELLED]).toEqual([]);
    expect(isTransitionAllowed(JobStatus.CLOSED, JobStatus.ACTIVE)).toBe(false);
  });

  it('allows cancellation from every non-terminal state', () => {
    const nonTerminal: JobStatus[] = [
      JobStatus.DRAFT,
      JobStatus.PLANNED,
      JobStatus.APPROVED,
      JobStatus.SCHEDULED,
      JobStatus.ACTIVE,
      JobStatus.ON_HOLD,
    ];
    for (const status of nonTerminal) {
      expect(ALLOWED_TRANSITIONS[status]).toContain(JobStatus.CANCELLED);
    }
  });
});
