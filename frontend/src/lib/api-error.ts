import { isAxiosError } from 'axios'
import type { ApiErrorResponse } from '@/types'

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError<ApiErrorResponse>(error)) {
    const message = error.response?.data?.message
    if (Array.isArray(message)) return message.join(', ')
    if (typeof message === 'string') return message
  }
  if (error instanceof Error) return error.message
  return fallback
}
