import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/formatters'
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/api/notifications.api'

const PAGE_SIZE = 20

type FilterValue = 'all' | 'unread'

export function NotificationsPage() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<FilterValue>('all')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { page, filter }],
    queryFn: () =>
      fetchNotifications({
        page,
        pageSize: PAGE_SIZE,
        isRead: filter === 'unread' ? false : undefined,
      }),
  })

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  function handleFilterChange(value: string) {
    setFilter(value as FilterValue)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        actions={
          <Button
            variant="outline"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            Mark all as read
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={handleFilterChange}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-5 w-5 text-brand-600" />
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No notifications" description="You're all caught up." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.data.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!notification.isRead) markReadMutation.mutate(notification.id)
                  }}
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <p
                      className={cn(
                        'text-sm',
                        notification.isRead ? 'font-normal text-slate-700' : 'font-semibold text-slate-900',
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">{notification.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(notification.createdAt)}</p>
                  </div>
                  {!notification.isRead ? (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        {data ? (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </div>
  )
}
