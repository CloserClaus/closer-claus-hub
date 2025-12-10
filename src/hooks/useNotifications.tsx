import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Notification {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

interface LevelUpData {
  old_level: number;
  new_level: number;
  total_deals_closed: number;
  new_platform_cut: number;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [levelUpNotification, setLevelUpNotification] = useState<{
    isOpen: boolean;
    data: LevelUpData | null;
    notificationId: string | null;
  }>({ isOpen: false, data: null, notificationId: null });

  const handleLevelUpNotification = useCallback((notification: Notification) => {
    if (notification.type === 'level_up' && !notification.is_read) {
      const data = notification.data as unknown as LevelUpData | null;
      if (data && data.old_level !== undefined && data.new_level !== undefined) {
        setLevelUpNotification({
          isOpen: true,
          data,
          notificationId: notification.id,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter((n) => !n.is_read).length);
        
        // Check for unread level-up notifications
        const unreadLevelUp = data.find(
          (n) => n.type === 'level_up' && !n.is_read
        );
        if (unreadLevelUp) {
          handleLevelUpNotification(unreadLevelUp as Notification);
        }
      }
      setLoading(false);
    };

    fetchNotifications();

    // Subscribe to realtime notifications
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          
          // Handle level-up notifications immediately
          handleLevelUpNotification(newNotification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, handleLevelUpNotification]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const closeLevelUpCelebration = async () => {
    if (levelUpNotification.notificationId) {
      await markAsRead(levelUpNotification.notificationId);
    }
    setLevelUpNotification({ isOpen: false, data: null, notificationId: null });
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    levelUpNotification,
    closeLevelUpCelebration,
  };
}
