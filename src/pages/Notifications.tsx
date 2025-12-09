import { useState } from 'react';
import { Bell, CheckCheck, DollarSign, AlertTriangle, FileText, Users, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'commission_created':
    case 'commission_due':
    case 'commission_paid':
      return <DollarSign className="h-5 w-5 text-emerald-500" />;
    case 'commission_overdue':
    case 'account_locked':
      return <AlertTriangle className="h-5 w-5 text-destructive" />;
    case 'dispute_created':
    case 'dispute_resolved':
      return <FileText className="h-5 w-5 text-amber-500" />;
    case 'sdr_joined':
    case 'sdr_removed':
      return <Users className="h-5 w-5 text-primary" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
};

const getNotificationCategory = (type: string) => {
  if (type.startsWith('commission')) return 'commission';
  if (type.startsWith('dispute')) return 'dispute';
  if (type.startsWith('sdr')) return 'team';
  if (type === 'account_locked') return 'commission';
  return 'other';
};

type FilterStatus = 'all' | 'unread' | 'read';
type FilterCategory = 'all' | 'commission' | 'dispute' | 'team' | 'other';

export default function Notifications() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');

  const filteredNotifications = notifications.filter((notification) => {
    // Status filter
    if (statusFilter === 'unread' && notification.is_read) return false;
    if (statusFilter === 'read' && !notification.is_read) return false;

    // Category filter
    if (categoryFilter !== 'all') {
      const category = getNotificationCategory(notification.type);
      if (category !== categoryFilter) return false;
    }

    return true;
  });

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="unread">
                    Unread
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="read">Read</TabsTrigger>
                </TabsList>
              </Tabs>

              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as FilterCategory)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="commission">Commissions</SelectItem>
                  <SelectItem value="dispute">Disputes</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No notifications</p>
                <p className="text-sm mt-1">
                  {statusFilter !== 'all' || categoryFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : "You're all caught up!"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 sm:p-6 hover:bg-muted/50 cursor-pointer transition-colors',
                      !notification.is_read && 'bg-primary/5'
                    )}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    <div className="flex gap-4">
                      <div className="mt-1 p-2 rounded-full bg-muted">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className={cn(
                              'text-sm sm:text-base',
                              !notification.is_read && 'font-semibold'
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!notification.is_read && (
                              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(notification.created_at), 'MMM d, yyyy · h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
