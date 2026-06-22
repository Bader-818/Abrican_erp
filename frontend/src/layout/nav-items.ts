import {
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  Calculator,
  ClipboardList,
  Clock,
  Coins,
  FileClock,
  FileText,
  HardHat,
  LayoutDashboard,
  Receipt,
  ReceiptText,
  ScrollText,
  Shield,
  Truck,
  Users,
  UsersRound,
  Wallet,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  permission?: string
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'General',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Notifications', to: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Jobs', to: '/jobs', icon: Briefcase, permission: 'jobs.view' },
      {
        label: 'Scheduling',
        to: '/scheduling',
        icon: CalendarClock,
        permission: 'assignments.view',
      },
      { label: 'Daily Reports', to: '/daily-reports', icon: ClipboardList, permission: 'daily_reports.view' },
      { label: 'Timesheets', to: '/timesheets', icon: Clock, permission: 'timesheets.view' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { label: 'Clients', to: '/clients', icon: Building2, permission: 'clients.view' },
      { label: 'Contracts', to: '/contracts', icon: ScrollText, permission: 'contracts.view' },
      {
        label: 'Purchase Orders',
        to: '/purchase-orders',
        icon: FileText,
        permission: 'purchase_orders.view',
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Estimates', to: '/estimates', icon: Calculator, permission: 'estimates.view' },
      { label: 'Invoices', to: '/invoices', icon: Receipt, permission: 'invoices.view' },
      { label: 'Receivables', to: '/receivables', icon: Coins, permission: 'payments.view' },
      { label: 'Expenses', to: '/expenses', icon: ReceiptText, permission: 'expenses.view' },
      { label: 'Reimbursements', to: '/reimbursements', icon: Wallet, permission: 'expenses.view' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Employees', to: '/resources/employees', icon: HardHat, permission: 'employees.view' },
      { label: 'Crews', to: '/resources/crews', icon: UsersRound, permission: 'crews.view' },
      { label: 'Vehicles', to: '/resources/vehicles', icon: Truck, permission: 'vehicles.view' },
      { label: 'Equipment', to: '/resources/equipment', icon: Wrench, permission: 'equipment.view' },
      { label: 'Documents', to: '/documents', icon: FileText, permission: 'documents.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', to: '/admin/users', icon: Users, permission: 'users.view' },
      { label: 'Roles', to: '/admin/roles', icon: Shield, permission: 'roles.view' },
      { label: 'Audit Logs', to: '/audit-logs', icon: FileClock, permission: 'audit_logs.view' },
    ],
  },
]
