import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { AppLayout } from '@/layout/AppLayout'
import { ProtectedRoute } from '@/layout/ProtectedRoute'
import { LoginPage } from '@/pages/login/LoginPage'
import { DashboardHomePage } from '@/pages/dashboard/DashboardHomePage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { AuditLogsPage } from '@/pages/audit-logs/AuditLogsPage'
import { UsersPage } from '@/pages/admin/users/UsersPage'
import { RolesPage } from '@/pages/admin/roles/RolesPage'
import { ClientsPage } from '@/pages/clients/ClientsPage'
import { ClientDetailPage } from '@/pages/clients/ClientDetailPage'
import { ContractsPage } from '@/pages/contracts/ContractsPage'
import { ContractDetailPage } from '@/pages/contracts/ContractDetailPage'
import { PurchaseOrdersPage } from '@/pages/purchase-orders/PurchaseOrdersPage'
import { SchedulePage } from '@/pages/scheduling/SchedulePage'
import { DocumentsPage } from '@/pages/documents/DocumentsPage'
import { JobsPage } from '@/pages/jobs/JobsPage'
import { JobDetailPage } from '@/pages/jobs/JobDetailPage'
import { EstimatesPage } from '@/pages/estimates/EstimatesPage'
import { EstimateDetailPage } from '@/pages/estimates/EstimateDetailPage'
import { InvoicesPage } from '@/pages/invoices/InvoicesPage'
import { InvoiceDetailPage } from '@/pages/invoices/InvoiceDetailPage'
import { ReceivablesPage } from '@/pages/invoices/ReceivablesPage'
import { SecuritySettingsPage } from '@/pages/settings/SecuritySettingsPage'
import { DailyReportsPage } from '@/pages/daily-reports/DailyReportsPage'
import { DailyReportDetailPage } from '@/pages/daily-reports/DailyReportDetailPage'
import { TimesheetsPage } from '@/pages/timesheets/TimesheetsPage'
import { ExpensesPage } from '@/pages/expenses/ExpensesPage'
import { ExpenseDetailPage } from '@/pages/expenses/ExpenseDetailPage'
import { ReimbursementsPage } from '@/pages/expenses/ReimbursementsPage'
import { EmployeesPage } from '@/pages/resources/employees/EmployeesPage'
import { CrewsPage } from '@/pages/resources/crews/CrewsPage'
import { CrewDetailPage } from '@/pages/resources/crews/CrewDetailPage'
import { VehiclesPage } from '@/pages/resources/vehicles/VehiclesPage'
import { EquipmentPage } from '@/pages/resources/equipment/EquipmentPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardHomePage />} />
              <Route path="settings/security" element={<SecuritySettingsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route
                path="jobs"
                element={
                  <ProtectedRoute permission="jobs.view">
                    <JobsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="jobs/:id"
                element={
                  <ProtectedRoute permission="jobs.view">
                    <JobDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="scheduling"
                element={
                  <ProtectedRoute permission="assignments.view">
                    <SchedulePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="daily-reports"
                element={
                  <ProtectedRoute permission="daily_reports.view">
                    <DailyReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="daily-reports/:id"
                element={
                  <ProtectedRoute permission="daily_reports.view">
                    <DailyReportDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="timesheets"
                element={
                  <ProtectedRoute permission="timesheets.view">
                    <TimesheetsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="expenses"
                element={
                  <ProtectedRoute permission="expenses.view">
                    <ExpensesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="expenses/:id"
                element={
                  <ProtectedRoute permission="expenses.view">
                    <ExpenseDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reimbursements"
                element={
                  <ProtectedRoute permission="expenses.view">
                    <ReimbursementsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="estimates"
                element={
                  <ProtectedRoute permission="estimates.view">
                    <EstimatesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="estimates/:id"
                element={
                  <ProtectedRoute permission="estimates.view">
                    <EstimateDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="invoices"
                element={
                  <ProtectedRoute permission="invoices.view">
                    <InvoicesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="invoices/:id"
                element={
                  <ProtectedRoute permission="invoices.view">
                    <InvoiceDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="receivables"
                element={
                  <ProtectedRoute permission="payments.view">
                    <ReceivablesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="clients"
                element={
                  <ProtectedRoute permission="clients.view">
                    <ClientsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="clients/:id"
                element={
                  <ProtectedRoute permission="clients.view">
                    <ClientDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="contracts"
                element={
                  <ProtectedRoute permission="contracts.view">
                    <ContractsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="contracts/:id"
                element={
                  <ProtectedRoute permission="contracts.view">
                    <ContractDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="purchase-orders"
                element={
                  <ProtectedRoute permission="purchase_orders.view">
                    <PurchaseOrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resources/employees"
                element={
                  <ProtectedRoute permission="employees.view">
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resources/crews"
                element={
                  <ProtectedRoute permission="crews.view">
                    <CrewsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resources/crews/:id"
                element={
                  <ProtectedRoute permission="crews.view">
                    <CrewDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resources/vehicles"
                element={
                  <ProtectedRoute permission="vehicles.view">
                    <VehiclesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resources/equipment"
                element={
                  <ProtectedRoute permission="equipment.view">
                    <EquipmentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="documents"
                element={
                  <ProtectedRoute permission="documents.view">
                    <DocumentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="audit-logs"
                element={
                  <ProtectedRoute permission="audit_logs.view">
                    <AuditLogsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/users"
                element={
                  <ProtectedRoute permission="users.view">
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/roles"
                element={
                  <ProtectedRoute permission="roles.view">
                    <RolesPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
