import { apiClient } from './client'
import type {
  ClientContact,
  ClientDetail,
  ClientStatus,
  ClientSummary,
  ClientType,
  PaginatedResult,
} from '@/types'

export interface ClientsQuery {
  page?: number
  pageSize?: number
  search?: string
  clientType?: ClientType
  status?: ClientStatus
}

export interface ClientPayload {
  name?: string
  clientType?: ClientType
  vatNumber?: string
  crNumber?: string
  billingAddress?: string
  paymentTermsDays?: number
  status?: ClientStatus
  notes?: string
}

export interface ContactPayload {
  name?: string
  role?: string
  phone?: string
  email?: string
}

export async function fetchClients(query: ClientsQuery): Promise<PaginatedResult<ClientSummary>> {
  const { data } = await apiClient.get<PaginatedResult<ClientSummary>>('/clients', { params: query })
  return data
}

export async function fetchClient(id: string): Promise<ClientDetail> {
  const { data } = await apiClient.get<ClientDetail>(`/clients/${id}`)
  return data
}

export async function createClient(payload: ClientPayload): Promise<ClientDetail> {
  const { data } = await apiClient.post<ClientDetail>('/clients', payload)
  return data
}

export async function updateClient(id: string, payload: ClientPayload): Promise<ClientDetail> {
  const { data } = await apiClient.patch<ClientDetail>(`/clients/${id}`, payload)
  return data
}

export async function deleteClient(id: string): Promise<void> {
  await apiClient.delete(`/clients/${id}`)
}

export async function createContact(clientId: string, payload: ContactPayload): Promise<ClientContact> {
  const { data } = await apiClient.post<ClientContact>(`/clients/${clientId}/contacts`, payload)
  return data
}

export async function updateContact(
  clientId: string,
  contactId: string,
  payload: ContactPayload,
): Promise<ClientContact> {
  const { data } = await apiClient.patch<ClientContact>(
    `/clients/${clientId}/contacts/${contactId}`,
    payload,
  )
  return data
}

export async function deleteContact(clientId: string, contactId: string): Promise<void> {
  await apiClient.delete(`/clients/${clientId}/contacts/${contactId}`)
}
