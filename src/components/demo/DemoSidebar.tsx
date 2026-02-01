import { 
  LayoutDashboard, Briefcase, Users, Search, 
  Phone, FileText, DollarSign, Settings, MessageSquare,
  GraduationCap, Tag, CreditCard, Gift, ClipboardCheck,
  ChevronDown
} from 'lucide-react';
import logoFull from '@/assets/logo-full.png';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface DemoSidebarProps {
  activePage: string;
}

const agencyOwnerNav = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: ClipboardCheck, label: 'Offer Diagnostic', id: 'offer-diagnostic' },
  { icon: Briefcase, label: 'Jobs', id: 'jobs' },
  { icon: Users, label: 'Team', id: 'team' },
  { icon: FileText, label: 'CRM', id: 'crm' },
  { icon: Search, label: 'Leads', id: 'leads' },
  { icon: Phone, label: 'Dialer', id: 'dialer' },
  { icon: MessageSquare, label: 'Conversations', id: 'conversations' },
  { icon: GraduationCap, label: 'Trainings', id: 'trainings' },
  { icon: FileText, label: 'Contracts', id: 'contracts' },
  { icon: DollarSign, label: 'Commissions', id: 'commissions' },
  { icon: Tag, label: 'Subscription', id: 'subscription' },
  { icon: CreditCard, label: 'Billing', id: 'billing' },
  { icon: Gift, label: 'Refer & Earn', id: 'refer' },
];

export const DemoSidebar = ({ activePage }: DemoSidebarProps) => {
  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <img src={logoFull} alt="Closer Claus" className="h-8 object-contain" />
      </div>
      
      <div className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-sidebar-accent/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-primary text-xs font-medium">W</div>
            <span className="text-sm font-medium">Wick Enterprises</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      <div className="px-6 py-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Navigation</span>
      </div>
      
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {agencyOwnerNav.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activePage;
          return (
            <div key={item.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </div>
          );
        })}
      </nav>
      
      <div className="px-3 pb-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 cursor-pointer">
          <Settings className="h-5 w-5 shrink-0" />
          Settings
        </div>
      </div>
      
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent/50 cursor-pointer">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">JW</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 items-center justify-between">
            <div className="text-left">
              <p className="text-sm font-medium truncate max-w-[120px]">John Wick</p>
              <p className="text-xs text-muted-foreground">Agency Owner</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
};
