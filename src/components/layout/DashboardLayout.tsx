import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { LevelUpCelebration } from '@/components/LevelUpCelebration';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';

const SIDEBAR_STORAGE_KEY = 'sidebar-open';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, userRole, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { levelUpNotification, closeLevelUpCelebration } = useNotifications();
  
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  const handleSidebarOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    if (!loading && user && !userRole) {
      navigate('/role-select');
      return;
    }

    if (!loading && user && userRole && !profile?.onboarding_completed) {
      navigate('/onboarding');
    }
  }, [user, userRole, profile, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarOpenChange}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          {children}
        </SidebarInset>
        <MobileBottomNav />
      </div>
      
      {/* Level Up Celebration Modal */}
      {levelUpNotification.data && (
        <LevelUpCelebration
          isOpen={levelUpNotification.isOpen}
          onClose={closeLevelUpCelebration}
          oldLevel={levelUpNotification.data.old_level}
          newLevel={levelUpNotification.data.new_level}
          totalDeals={levelUpNotification.data.total_deals_closed}
        />
      )}
    </SidebarProvider>
  );
}
