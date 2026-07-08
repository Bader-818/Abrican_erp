import { apiClient } from './client'
import type { AssetsDashboard, FinanceDashboard, OperationsDashboard } from '@/types'

export async function fetchOperationsDashboard(): Promise<OperationsDashboard> {
  const { data } = await apiClient.get<OperationsDashboard>('/dashboard/operations')
  return data
}

export async function fetchAssetsDashboard(): Promise<AssetsDashboard> {
  const { data } = await apiClient.get<AssetsDashboard>('/dashboard/assets')
  return data
}

export interface FinanceDashboardQuery {
  from?: string
  to?: string
}

export async function fetchFinanceDashboard(query: FinanceDashboardQuery = {}): Promise<FinanceDashboard> {
  const { data } = await apiClient.get<FinanceDashboard>('/dashboard/finance', { params: query })
  return data
}
