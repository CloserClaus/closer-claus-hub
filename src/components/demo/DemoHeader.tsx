import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface DemoHeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export const DemoHeader = ({ title, breadcrumbs }: DemoHeaderProps) => {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur px-4">
      {/* Sidebar trigger placeholder */}
      <div className="w-6 h-6 flex items-center justify-center">
        <div className="w-4 h-0.5 bg-muted-foreground relative before:absolute before:w-4 before:h-0.5 before:bg-muted-foreground before:-top-1.5 after:absolute after:w-4 after:h-0.5 after:bg-muted-foreground after:top-1.5" />
      </div>
      
      <Separator orientation="vertical" className="h-6" />
      
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-muted-foreground">/</span>}
              <span className={index === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      ) : (
        <h1 className="text-lg font-semibold">{title}</h1>
      )}

      <div className="ml-auto">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
            3
          </span>
        </Button>
      </div>
    </header>
  );
};
