import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { getApiErrorMessage } from './api-error'

function axiosErrorWith(message: unknown): AxiosError {
  const err = new AxiosError('Request failed')
  err.response = {
    data: { message },
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
  return err
}

describe('getApiErrorMessage', () => {
  it('returns a string message from an axios error', () => {
    expect(getApiErrorMessage(axiosErrorWith('Email already in use'))).toBe('Email already in use')
  })

  it('joins array messages (class-validator output)', () => {
    expect(getApiErrorMessage(axiosErrorWith(['name is required', 'email is invalid']))).toBe(
      'name is required, email is invalid',
    )
  })

  it('falls back to a plain Error message', () => {
    expect(getApiErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('uses the provided fallback for unknown errors', () => {
    expect(getApiErrorMessage({}, 'Failed to save')).toBe('Failed to save')
  })
})
