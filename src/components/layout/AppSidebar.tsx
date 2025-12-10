import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Phone,
  MessageSquare,
  GraduationCap,
  FileText,
  DollarSign,
  Settings,
  Shield,
  Building2,
  LogOut,
  ChevronDown,
  CreditCard,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import logoIcon from '@/assets/logo-icon.png';
import logoFull from '@/assets/logo-full.png';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const platformAdminNav: NavItem[] = [
  { title: 'Admin Panel', url: '/admin', icon: Shield },
  { title: 'Conversations', url: '/conversations', icon: MessageSquare },
];

const agencyOwnerNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Jobs', url: '/jobs', icon: Briefcase },
  { title: 'Team', url: '/team', icon: Users },
  { title: 'CRM', url: '/crm', icon: FileText },
  { title: 'Dialer', url: '/dialer', icon: Phone },
  { title: 'Conversations', url: '/conversations', icon: MessageSquare },
  { title: 'Trainings', url: '/trainings', icon: GraduationCap },
  { title: 'Contracts', url: '/contracts', icon: FileText },
  { title: 'Commissions', url: '/commissions', icon: DollarSign },
  { title: 'Billing', url: '/billing', icon: CreditCard },
];

const sdrNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Find Jobs', url: '/jobs', icon: Briefcase },
  { title: 'CRM', url: '/crm', icon: FileText },
  { title: 'Dialer', url: '/dialer', icon: Phone },
  { title: 'Conversations', url: '/conversations', icon: MessageSquare },
  { title: 'Trainings', url: '/trainings', icon: GraduationCap },
  { title: 'My Earnings', url: '/earnings', icon: DollarSign },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { userRole, profile, signOut } = useAuth();
  const collapsed = state === 'collapsed';

  const getNavItems = (): NavItem[] => {
    switch (userRole) {
      case 'platform_admin':
        return platformAdminNav;
      case 'agency_owner':
        return agencyOwnerNav;
      case 'sdr':
        return sdrNav;
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const getRoleLabel = () => {
    switch (userRole) {
      case 'platform_admin':
        return 'Platform Admin';
      case 'agency_owner':
        return 'Agency Owner';
      case 'sdr':
        return 'SDR';
      default:
        return 'User';
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {collapsed ? (
            <img src={logoIcon} alt="Closer Claus" className="h-8 w-8 object-contain" />
          ) : (
            <img src={logoFull} alt="Closer Claus" className="h-8 object-contain" />
          )}
        </div>
      </SidebarHeader>

      {userRole === 'sdr' && !collapsed && (
        <>
          <SidebarSeparator />
          <div className="px-3 py-2">
            <WorkspaceSwitcher />
          </div>
        </>
      )}

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/settings'}
                  tooltip="Settings"
                >
                  <NavLink
                    to="/settings"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-primary"
                  >
                    <Settings className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`w-full justify-start gap-3 px-2 py-6 hover:bg-sidebar-accent ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <div className="text-left">
                    <p className="text-sm font-medium truncate max-w-[120px]">
                      {profile?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground">{getRoleLabel()}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
