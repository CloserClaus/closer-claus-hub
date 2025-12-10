import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Home, Users, Phone, MessageSquare, Settings, MoreHorizontal,
  Briefcase, GraduationCap, DollarSign, FileText, Building2,
  AlertTriangle, Tag, Shield, UserCircle, Handshake, FileSignature,
  CreditCard
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

// Haptic feedback utility
const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30,
    };
    navigator.vibrate(patterns[style]);
  }
};

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pressedItem, setPressedItem] = useState<string | null>(null);

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

  const handlePress = (path: string) => {
    setPressedItem(path);
    triggerHaptic('light');
  };

  const handleRelease = () => {
    setPressedItem(null);
  };

  const handleNavigate = (path: string) => {
    triggerHaptic('medium');
    navigate(path);
    setMoreOpen(false);
  };

  const handleMoreOpen = (open: boolean) => {
    if (open) {
      triggerHaptic('medium');
    }
    setMoreOpen(open);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {primaryNav.map((item) => {
          const active = isActive(item.path);
          const pressed = pressedItem === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onTouchStart={() => handlePress(item.path)}
              onTouchEnd={handleRelease}
              onMouseDown={() => handlePress(item.path)}
              onMouseUp={handleRelease}
              onMouseLeave={handleRelease}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-150 relative",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground",
                pressed && "scale-90"
              )}
            >
              {/* Active indicator */}
              {active && (
                <span className="absolute top-1 w-1 h-1 rounded-full bg-primary animate-scale-in" />
              )}
              <Icon 
                className={cn(
                  "h-5 w-5 transition-all duration-150",
                  active && "scale-110",
                  pressed && "scale-75"
                )} 
              />
              <span 
                className={cn(
                  "text-[10px] font-medium transition-all duration-150",
                  active && "font-semibold"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
        
        {/* More Menu */}
        <Sheet open={moreOpen} onOpenChange={handleMoreOpen}>
          <SheetTrigger asChild>
            <button
              onTouchStart={() => handlePress('more')}
              onTouchEnd={handleRelease}
              onMouseDown={() => handlePress('more')}
              onMouseUp={handleRelease}
              onMouseLeave={handleRelease}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-150",
                moreOpen 
                  ? "text-primary" 
                  : "text-muted-foreground",
                pressedItem === 'more' && "scale-90"
              )}
            >
              <MoreHorizontal 
                className={cn(
                  "h-5 w-5 transition-all duration-150",
                  moreOpen && "rotate-90",
                  pressedItem === 'more' && "scale-75"
                )} 
              />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl">
            <SheetHeader className="pb-4">
              <SheetTitle>More Options</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-4 gap-3 pb-6">
              {moreNav.map((item, index) => {
                const active = isActive(item.path);
                const pressed = pressedItem === `more-${item.path}`;
                const Icon = item.icon;
                
                return (
                  <button
                    key={item.path}
                    onTouchStart={() => handlePress(`more-${item.path}`)}
                    onTouchEnd={handleRelease}
                    onMouseDown={() => handlePress(`more-${item.path}`)}
                    onMouseUp={handleRelease}
                    onMouseLeave={handleRelease}
                    onClick={() => handleNavigate(item.path)}
                    style={{ animationDelay: `${index * 30}ms` }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all duration-150 animate-fade-in",
                      active 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-muted",
                      pressed && "scale-90 bg-muted"
                    )}
                  >
                    <Icon 
                      className={cn(
                        "h-6 w-6 transition-transform duration-150",
                        pressed && "scale-75"
                      )} 
                    />
                    <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
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
