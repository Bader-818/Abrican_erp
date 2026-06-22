import axios, { type InternalAxiosRequestConfig } from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const response = await axios.post<{ accessToken: string }>(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true },
  )
  return response.data.accessToken
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined
    const url = originalRequest?.url ?? ''
    const isAuthRoute = url.includes('/auth/refresh') || url.includes('/auth/login')

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true
      try {
        refreshPromise ??= refreshAccessToken()
        const newToken = await refreshPromise
        refreshPromise = null
        setAccessToken(newToken)
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`)
        return apiClient(originalRequest)
      } catch (refreshError) {
        refreshPromise = null
        setAccessToken(null)
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)
