import { 
  LayoutDashboard, Briefcase, Users, Search, Database, 
  Phone, FileText, DollarSign, Settings, MessageSquare 
} from 'lucide-react';
import logoFull from '@/assets/logo-full.png';

interface DemoSidebarProps {
  activePage: string;
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Briefcase, label: 'Jobs', id: 'jobs' },
  { icon: Users, label: 'Team', id: 'team' },
  { icon: Search, label: 'Leads', id: 'leads' },
  { icon: Database, label: 'CRM', id: 'crm' },
  { icon: Phone, label: 'Dialer', id: 'dialer' },
  { icon: FileText, label: 'Contracts', id: 'contracts' },
  { icon: DollarSign, label: 'Commissions', id: 'commissions' },
  { icon: MessageSquare, label: 'Messages', id: 'messages' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

export const DemoSidebar = ({ activePage }: DemoSidebarProps) => {
  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <img src={logoFull} alt="Closer Claus" className="h-8" />
      </div>
      
      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activePage;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive 
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </div>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">John Demo</p>
            <p className="text-xs text-muted-foreground truncate">Agency Owner</p>
          </div>
        </div>
      </div>
    </div>
  );
};
