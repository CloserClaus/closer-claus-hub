import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

interface DashboardHeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export function DashboardHeader({ title, breadcrumbs }: DashboardHeaderProps) {
  return (
    <header 
      data-tour="dashboard-header"
      className="sticky top-0 z-10 flex h-12 md:h-14 items-center gap-2 md:gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 md:px-4"
    >
      {/* Hide sidebar trigger on mobile - we have bottom nav */}
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="h-6 hidden md:block" />
      
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb className="flex-1 min-w-0">
          <BreadcrumbList className="flex-nowrap overflow-hidden">
            {breadcrumbs.map((crumb, index) => (
              <BreadcrumbItem key={index} className="shrink-0 last:shrink last:min-w-0 last:truncate">
                {index > 0 && <BreadcrumbSeparator />}
                {crumb.href ? (
                  <BreadcrumbLink href={crumb.href} className="text-xs md:text-sm">{crumb.label}</BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="text-xs md:text-sm truncate">{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : (
        <h1 className="text-base md:text-lg font-semibold">{title}</h1>
      )}

      <div className="ml-auto shrink-0">
        <NotificationCenter />
      </div>
    </header>
  );
}
