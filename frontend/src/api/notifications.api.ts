import { apiClient } from './client'
import type { Notification, PaginatedResult } from '@/types'

export interface NotificationsQuery {
  page?: number
  pageSize?: number
  isRead?: boolean
}

export async function fetchNotifications(
  query: NotificationsQuery,
): Promise<PaginatedResult<Notification>> {
  const { data } = await apiClient.get<PaginatedResult<Notification>>('/notifications', { params: query })
  return data
}

export async function fetchUnreadCount(): Promise<{ count: number }> {
  const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count')
  return data
}

export async function markNotificationAsRead(id: string): Promise<Notification> {
  const { data } = await apiClient.patch<Notification>(`/notifications/${id}/read`)
  return data
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean }> {
  const { data } = await apiClient.patch<{ success: boolean }>('/notifications/read-all')
  return data
}
