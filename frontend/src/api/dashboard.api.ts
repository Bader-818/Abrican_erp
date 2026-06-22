import { apiClient } from './client'
import type { AssetsDashboard, OperationsDashboard } from '@/types'

export async function fetchOperationsDashboard(): Promise<OperationsDashboard> {
  const { data } = await apiClient.get<OperationsDashboard>('/dashboard/operations')
  return data
}

export async function fetchAssetsDashboard(): Promise<AssetsDashboard> {
  const { data } = await apiClient.get<AssetsDashboard>('/dashboard/assets')
  return data
}
