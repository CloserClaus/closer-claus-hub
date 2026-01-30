import { useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, Phone, MessageSquare, GraduationCap, FileText, DollarSign, Settings, Shield, Building2, LogOut, ChevronDown, CreditCard, AlertTriangle, Tag, UserCircle, Handshake, FileSignature, Bug, Lightbulb, Wallet, Search, Database, ClipboardCheck, Gift } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import { SDRLevelProgress } from '@/components/SDRLevelProgress';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import logoIcon from '@/assets/logo-icon.png';
import logoFull from '@/assets/logo-full.png';
interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tourId?: string;
}
const platformAdminNav: NavItem[] = [{
  title: 'Overview',
  url: '/admin',
  icon: LayoutDashboard
}, {
  title: 'Agencies',
  url: '/admin?tab=agencies',
  icon: Building2,
  tourId: 'nav-agencies'
}, {
  title: 'SDRs',
  url: '/admin?tab=sdrs',
  icon: Users,
  tourId: 'nav-sdrs'
}, {
  title: 'Jobs',
  url: '/admin?tab=jobs',
  icon: Briefcase,
  tourId: 'nav-jobs'
}, {
  title: 'Applications',
  url: '/admin?tab=applications',
  icon: FileText
}, {
  title: 'Leads',
  url: '/admin?tab=leads',
  icon: UserCircle
}, {
  title: 'Master Leads',
  url: '/admin?tab=master',
  icon: Database
}, {
  title: 'Deals',
  url: '/admin?tab=deals',
  icon: Handshake
}, {
  title: 'Contracts',
  url: '/admin?tab=contracts',
  icon: FileSignature
}, {
  title: 'Calls',
  url: '/admin?tab=calls',
  icon: Phone
}, {
  title: 'Trainings',
  url: '/admin?tab=trainings',
  icon: GraduationCap
}, {
  title: 'Disputes',
  url: '/admin?tab=disputes',
  icon: AlertTriangle,
  tourId: 'disputes'
}, {
  title: 'Payouts',
  url: '/admin?tab=payouts',
  icon: DollarSign
}, {
  title: 'Salaries',
  url: '/admin?tab=salaries',
  icon: Wallet
}, {
  title: 'Coupons',
  url: '/admin?tab=coupons',
  icon: Tag
}, {
  title: 'Support',
  url: '/admin?tab=support',
  icon: MessageSquare
}, {
  title: 'Bug Reports',
  url: '/admin?tab=bugs',
  icon: Bug
}, {
  title: 'Features',
  url: '/admin?tab=features',
  icon: Lightbulb
}, {
  title: 'Referrals',
  url: '/admin?tab=referrals',
  icon: Gift
}, {
  title: 'Conversations',
  url: '/conversations',
  icon: MessageSquare
}, {
  title: 'Admin Controls',
  url: '/admin?tab=settings',
  icon: Shield,
  tourId: 'admin-controls'
}];
const agencyOwnerNav: NavItem[] = [{
  title: 'Dashboard',
  url: '/dashboard',
  icon: LayoutDashboard
}, {
  title: 'Offer Diagnostic',
  url: '/offer-diagnostic',
  icon: ClipboardCheck
}, {
  title: 'Jobs',
  url: '/jobs',
  icon: Briefcase,
  tourId: 'nav-jobs'
}, {
  title: 'Team',
  url: '/team',
  icon: Users,
  tourId: 'nav-team'
}, {
  title: 'CRM',
  url: '/crm',
  icon: FileText,
  tourId: 'nav-crm'
}, {
  title: 'Leads',
  url: '/leads',
  icon: Search,
  tourId: 'nav-leads'
}, {
  title: 'Dialer',
  url: '/dialer',
  icon: Phone,
  tourId: 'nav-dialer'
}, {
  title: 'Conversations',
  url: '/conversations',
  icon: MessageSquare
}, {
  title: 'Trainings',
  url: '/trainings',
  icon: GraduationCap
}, {
  title: 'Contracts',
  url: '/contracts',
  icon: FileText
}, {
  title: 'Commissions',
  url: '/commissions',
  icon: DollarSign,
  tourId: 'nav-commissions'
}, {
  title: 'Subscription',
  url: '/subscription',
  icon: Tag
}, {
  title: 'Billing',
  url: '/billing',
  icon: CreditCard
}, {
  title: 'Refer & Earn',
  url: '/refer',
  icon: Gift
}];
const sdrNav: NavItem[] = [{
  title: 'Dashboard',
  url: '/dashboard',
  icon: LayoutDashboard
}, {
  title: 'Find Jobs',
  url: '/jobs',
  icon: Briefcase,
  tourId: 'nav-jobs'
}, {
  title: 'My Companies',
  url: '/team',
  icon: Building2,
  tourId: 'nav-team'
}, {
  title: 'CRM',
  url: '/crm',
  icon: FileText,
  tourId: 'nav-crm'
}, {
  title: 'Leads',
  url: '/leads',
  icon: Search,
  tourId: 'nav-leads'
}, {
  title: 'Dialer',
  url: '/dialer',
  icon: Phone,
  tourId: 'nav-dialer'
}, {
  title: 'Conversations',
  url: '/conversations',
  icon: MessageSquare
}, {
  title: 'Trainings',
  url: '/trainings',
  icon: GraduationCap
}, {
  title: 'Contracts',
  url: '/contracts',
  icon: FileSignature,
  tourId: 'nav-contracts'
}, {
  title: 'My Earnings',
  url: '/commissions',
  icon: DollarSign,
  tourId: 'nav-earnings'
}];
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const location = useLocation();
  const {
    userRole,
    profile,
    signOut
  } = useAuth();
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
  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
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
  return <Sidebar collapsible="icon" className="border-r border-border" data-tour="sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {collapsed ? <img src={logoIcon} alt="Closer Claus" className="h-8 w-8 object-contain" /> : <img src={logoFull} alt="Closer Claus" className="h-8 object-contain" />}
        </div>
      </SidebarHeader>

      {(userRole === 'sdr' || userRole === 'agency_owner') && !collapsed && <>
          <SidebarSeparator />
          <div data-tour="workspace-switcher" className="py-0 px-0">
            <WorkspaceSwitcher />
          </div>
          {userRole === 'sdr' && <>
              <SidebarSeparator />
              <div className="px-3 py-2" data-tour="sdr-level">
                <SDRLevelProgress />
              </div>
            </>}
        </>}

      {userRole === 'sdr' && collapsed && <div className="px-2 py-2" data-tour="sdr-level">
          <SDRLevelProgress compact />
        </div>}

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
              const itemUrl = new URL(item.url, window.location.origin);
              const isActive = item.url.includes('?') ? location.pathname + location.search === item.url : location.pathname === item.url && !location.search;
              return <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary" data-tour={item.tourId}>
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>;
            })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/settings'} tooltip="Settings">
                  <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary">
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
            <Button variant="ghost" className={`w-full justify-start gap-3 px-2 py-6 hover:bg-sidebar-accent ${collapsed ? 'justify-center' : ''}`}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && <div className="flex flex-1 items-center justify-between">
                  <div className="text-left">
                    <p className="text-sm font-medium truncate max-w-[120px]">
                      {profile?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground">{getRoleLabel()}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>}
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
    </Sidebar>;
}