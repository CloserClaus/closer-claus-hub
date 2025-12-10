import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Home, Users, Phone, MessageSquare, Settings, MoreHorizontal,
  Briefcase, GraduationCap, DollarSign, FileText, Building2,
  AlertTriangle, Tag, Shield, UserCircle, Handshake, FileSignature,
  CreditCard, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const platformAdminPrimary: NavItem[] = [
  { icon: Home, label: "Overview", path: "/admin" },
  { icon: Building2, label: "Agencies", path: "/admin?tab=agencies" },
  { icon: Users, label: "SDRs", path: "/admin?tab=sdrs" },
  { icon: AlertTriangle, label: "Disputes", path: "/admin?tab=disputes" },
];

const platformAdminMore: NavItem[] = [
  { icon: Briefcase, label: "Jobs", path: "/admin?tab=jobs" },
  { icon: FileText, label: "Applications", path: "/admin?tab=applications" },
  { icon: UserCircle, label: "Leads", path: "/admin?tab=leads" },
  { icon: Handshake, label: "Deals", path: "/admin?tab=deals" },
  { icon: FileSignature, label: "Contracts", path: "/admin?tab=contracts" },
  { icon: Phone, label: "Calls", path: "/admin?tab=calls" },
  { icon: GraduationCap, label: "Trainings", path: "/admin?tab=trainings" },
  { icon: DollarSign, label: "Payouts", path: "/admin?tab=payouts" },
  { icon: Tag, label: "Coupons", path: "/admin?tab=coupons" },
  { icon: MessageSquare, label: "Conversations", path: "/conversations" },
  { icon: Shield, label: "Admin Controls", path: "/admin?tab=settings" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const agencyOwnerPrimary: NavItem[] = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: FileText, label: "CRM", path: "/crm" },
  { icon: Phone, label: "Dialer", path: "/dialer" },
  { icon: MessageSquare, label: "Chat", path: "/conversations" },
];

const agencyOwnerMore: NavItem[] = [
  { icon: Briefcase, label: "Jobs", path: "/jobs" },
  { icon: Users, label: "Team", path: "/team" },
  { icon: GraduationCap, label: "Trainings", path: "/trainings" },
  { icon: FileSignature, label: "Contracts", path: "/contracts" },
  { icon: DollarSign, label: "Commissions", path: "/commissions" },
  { icon: CreditCard, label: "Billing", path: "/billing" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const sdrPrimary: NavItem[] = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: FileText, label: "CRM", path: "/crm" },
  { icon: Phone, label: "Dialer", path: "/dialer" },
  { icon: MessageSquare, label: "Chat", path: "/conversations" },
];

const sdrMore: NavItem[] = [
  { icon: Briefcase, label: "Find Jobs", path: "/jobs" },
  { icon: GraduationCap, label: "Trainings", path: "/trainings" },
  { icon: DollarSign, label: "My Earnings", path: "/earnings" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const getPrimaryNav = (): NavItem[] => {
    switch (userRole) {
      case 'platform_admin':
        return platformAdminPrimary;
      case 'agency_owner':
        return agencyOwnerPrimary;
      case 'sdr':
        return sdrPrimary;
      default:
        return agencyOwnerPrimary;
    }
  };

  const getMoreNav = (): NavItem[] => {
    switch (userRole) {
      case 'platform_admin':
        return platformAdminMore;
      case 'agency_owner':
        return agencyOwnerMore;
      case 'sdr':
        return sdrMore;
      default:
        return agencyOwnerMore;
    }
  };

  const primaryNav = getPrimaryNav();
  const moreNav = getMoreNav();

  const isActive = (path: string) => {
    if (path.includes('?')) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path && !location.search;
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMoreOpen(false);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {primaryNav.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
        
        {/* More Menu */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                moreOpen 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-xl">
            <SheetHeader className="pb-4">
              <SheetTitle>More Options</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-4 gap-4 pb-6">
              {moreNav.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-3 rounded-lg transition-colors",
                      active 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-medium text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
