import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, Phone, MessageSquare, GraduationCap, FileText, DollarSign, Settings, Shield, Building2, LogOut, ChevronDown, CreditCard, AlertTriangle, Tag, UserCircle, Handshake, FileSignature, Bug, Lightbulb, Wallet, Search, Database, ClipboardCheck, Gift, Target, ScrollText, BarChart3, Mail } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import { SDRLevelProgress } from '@/components/SDRLevelProgress';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import logoIcon from '@/assets/logo-icon.png';
import logoFull from '@/assets/logo-full.png';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  tourId?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const platformAdminNav: NavItem[] = [
  { title: 'Overview', url: '/admin', icon: LayoutDashboard },
  { title: 'Analytics', url: '/admin?tab=analytics', icon: BarChart3 },
  { title: 'Agencies', url: '/admin?tab=agencies', icon: Building2, tourId: 'nav-agencies' },
  { title: 'SDRs', url: '/admin?tab=sdrs', icon: Users, tourId: 'nav-sdrs' },
  { title: 'Jobs', url: '/admin?tab=jobs', icon: Briefcase, tourId: 'nav-jobs' },
  { title: 'Applications', url: '/admin?tab=applications', icon: FileText },
  { title: 'Leads', url: '/admin?tab=leads', icon: UserCircle },
  { title: 'Master Leads', url: '/admin?tab=master', icon: Database },
  { title: 'Deals', url: '/admin?tab=deals', icon: Handshake },
  { title: 'Contracts', url: '/admin?tab=contracts', icon: FileSignature },
  { title: 'Calls', url: '/admin?tab=calls', icon: Phone },
  { title: 'Email Tracking', url: '/admin?tab=email_tracking', icon: Mail },
  { title: 'Trainings', url: '/admin?tab=trainings', icon: GraduationCap },
  { title: 'Disputes', url: '/admin?tab=disputes', icon: AlertTriangle, tourId: 'disputes' },
  { title: 'Payouts', url: '/admin?tab=payouts', icon: DollarSign },
  { title: 'Salaries', url: '/admin?tab=salaries', icon: Wallet },
  { title: 'Coupons', url: '/admin?tab=coupons', icon: Tag },
  { title: 'Support', url: '/admin?tab=support', icon: MessageSquare },
  { title: 'Bug Reports', url: '/admin?tab=bugs', icon: Bug },
  { title: 'Features', url: '/admin?tab=features', icon: Lightbulb },
  { title: 'Referrals', url: '/admin?tab=referrals', icon: Gift },
  { title: 'Diagnostic Leads', url: '/admin?tab=diagnostic_leads', icon: Target },
  { title: 'Conversations', url: '/conversations', icon: MessageSquare },
  { title: 'Admin Controls', url: '/admin?tab=settings', icon: Shield, tourId: 'admin-controls' },
];

const agencyOwnerSections: NavSection[] = [
  {
    label: 'Setup',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Offer Diagnostic', url: '/app/offer-diagnostic', icon: ClipboardCheck },
      { title: 'Script Builder', url: '/app/script-builder', icon: ScrollText },
    ],
  },
  {
    label: 'Hiring',
    items: [
      { title: 'Jobs', url: '/jobs', icon: Briefcase, tourId: 'nav-jobs' },
      { title: 'Team', url: '/team', icon: Users, tourId: 'nav-team' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { title: 'Leads', url: '/leads', icon: Search, tourId: 'nav-leads' },
      { title: 'CRM', url: '/crm', icon: FileText, tourId: 'nav-crm' },
      { title: 'Dialer', url: '/dialer', icon: Phone, tourId: 'nav-dialer' },
      { title: 'Email', url: '/email', icon: Mail },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Trainings', url: '/trainings', icon: GraduationCap },
      { title: 'Contracts', url: '/contracts', icon: FileText },
      { title: 'Commissions', url: '/commissions', icon: DollarSign, tourId: 'nav-commissions' },
      { title: 'Conversations', url: '/conversations', icon: MessageSquare },
    ],
  },
];

const agencyOwnerFooterNav: NavItem[] = [
  { title: 'Subscription', url: '/subscription', icon: Tag },
  { title: 'Billing', url: '/billing', icon: CreditCard },
  { title: 'Refer & Earn', url: '/refer', icon: Gift },
];

const sdrSections: NavSection[] = [
  {
    label: 'Home',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Find Jobs', url: '/jobs', icon: Briefcase, tourId: 'nav-jobs' },
      { title: 'My Companies', url: '/team', icon: Building2, tourId: 'nav-team' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { title: 'Leads', url: '/leads', icon: Search, tourId: 'nav-leads' },
      { title: 'CRM', url: '/crm', icon: FileText, tourId: 'nav-crm' },
      { title: 'Dialer', url: '/dialer', icon: Phone, tourId: 'nav-dialer' },
      { title: 'Email', url: '/email', icon: Mail },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Trainings', url: '/trainings', icon: GraduationCap },
      { title: 'Contracts', url: '/contracts', icon: FileSignature, tourId: 'nav-contracts' },
      { title: 'My Earnings', url: '/commissions', icon: DollarSign, tourId: 'nav-earnings' },
      { title: 'Conversations', url: '/conversations', icon: MessageSquare },
    ],
  },
];

function NavItemRenderer({ item, collapsed, location }: { item: NavItem; collapsed: boolean; location: ReturnType<typeof useLocation> }) {
  const isActive = item.url.includes('?')
    ? location.pathname + location.search === item.url
    : location.pathname === item.url && !location.search;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
        <NavLink
          to={item.url}
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent"
          activeClassName="bg-sidebar-accent text-sidebar-primary"
          data-tour={item.tourId}
        >
          <item.icon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SectionedNav({ sections, collapsed, location }: { sections: NavSection[]; collapsed: boolean; location: ReturnType<typeof useLocation> }) {
  return (
    <>
      {sections.map((section, idx) => (
        <div key={section.label}>
          {idx > 0 && <SidebarSeparator />}
          <SidebarGroup>
            <SidebarGroupLabel className={collapsed ? 'sr-only' : 'text-[11px] uppercase tracking-wider text-muted-foreground'}>
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <NavItemRenderer key={item.title} item={item} collapsed={collapsed} location={location} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      ))}
    </>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole, profile, signOut } = useAuth();
  const collapsed = state === 'collapsed';

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const getRoleLabel = () => {
    switch (userRole) {
      case 'platform_admin': return 'Platform Admin';
      case 'agency_owner': return 'Agency Owner';
      case 'sdr': return 'SDR';
      default: return 'User';
    }
  };

  const isPlatformAdmin = userRole === 'platform_admin';
  const isSectioned = userRole === 'agency_owner' || userRole === 'sdr';
  const sections = userRole === 'agency_owner' ? agencyOwnerSections : sdrSections;
  const footerNavItems = userRole === 'agency_owner' ? agencyOwnerFooterNav : [];

  return (
    <Sidebar collapsible="icon" className="border-r border-border" data-tour="sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {collapsed
            ? <img src={logoIcon} alt="Closer Claus" className="h-8 w-8 object-contain" />
            : <img src={logoFull} alt="Closer Claus" className="h-8 object-contain" />}
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

      {userRole === 'sdr' && collapsed && (
        <div className="px-2 py-2" data-tour="sdr-level">
          <SDRLevelProgress compact />
        </div>
      )}

      <SidebarSeparator />

      <SidebarContent>
        {isSectioned && (
          <SectionedNav sections={sections} collapsed={collapsed} location={location} />
        )}

        {isPlatformAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {platformAdminNav.map((item) => (
                  <NavItemRenderer key={item.title} item={item} collapsed={collapsed} location={location} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* removed footer nav — items moved to user dropdown */}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`w-full justify-start gap-3 px-2 py-6 hover:bg-sidebar-accent ${collapsed ? 'justify-center' : ''}`}
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
          <DropdownMenuContent align="end" className="w-56 bg-popover border border-border z-50">
            {footerNavItems.map((item) => (
              <DropdownMenuItem key={item.title} onClick={() => navigate(item.url)} className="cursor-pointer">
                <item.icon className="h-4 w-4 mr-2" />
                {item.title}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
