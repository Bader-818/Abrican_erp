import { apiClient } from './client'
import type { AuditAction, AuditLog, PaginatedResult } from '@/types'

export interface AuditLogsQuery {
  page?: number
  pageSize?: number
  search?: string
  entityType?: string
  entityId?: string
  action?: AuditAction
  userId?: string
}

export async function fetchAuditLogs(query: AuditLogsQuery): Promise<PaginatedResult<AuditLog>> {
  const { data } = await apiClient.get<PaginatedResult<AuditLog>>('/audit-logs', { params: query })
  return data
}
