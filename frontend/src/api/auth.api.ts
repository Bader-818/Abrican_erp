import { apiClient } from './client'
import type { AuthUser, SessionInfo } from '@/types'

export interface LoginPayload {
  email: string
  password: string
  totp?: string
}

export interface LoginResponse {
  accessToken?: string
  user?: {
    id: string
    name: string
    email: string
  }
  mustChangePassword?: boolean
  /** Set when the account has MFA enabled and a code is still required. */
  mfaRequired?: boolean
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload)
  return data
}

export async function changePassword(payload: {
  currentPassword: string
  newPassword: string
}): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>('/auth/change-password', payload)
  return data
}

export interface MfaSetupResponse {
  secret: string
  otpauthUrl: string
  qrDataUrl: string
}

export async function mfaSetup(): Promise<MfaSetupResponse> {
  const { data } = await apiClient.post<MfaSetupResponse>('/auth/mfa/setup')
  return data
}

export async function mfaEnable(token: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>('/auth/mfa/enable', { token })
  return data
}

export async function mfaDisable(token: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>('/auth/mfa/disable', { token })
  return data
}

export async function listSessions(): Promise<SessionInfo[]> {
  const { data } = await apiClient.get<SessionInfo[]>('/auth/sessions')
  return data
}

export async function revokeSession(id: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>(`/auth/sessions/${id}/revoke`)
  return data
}

export async function refresh(): Promise<{ accessToken: string }> {
  const { data } = await apiClient.post<{ accessToken: string }>('/auth/refresh')
  return data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function logoutAll(): Promise<{ success: boolean; revoked: number }> {
  const { data } = await apiClient.post<{ success: boolean; revoked: number }>('/auth/logout-all')
  return data
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>('/auth/me')
  return data
}
