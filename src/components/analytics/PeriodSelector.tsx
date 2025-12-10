import { Button } from "@/components/ui/button";

interface PeriodSelectorProps {
  value: '7d' | '30d' | '90d';
  onChange: (period: '7d' | '30d' | '90d') => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const periods: { value: '7d' | '30d' | '90d'; label: string }[] = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
  ];

  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 md:p-1 bg-muted/30">
      {periods.map((period) => (
        <Button
          key={period.value}
          variant={value === period.value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onChange(period.value)}
          className="h-6 md:h-7 px-2 md:px-3 text-[10px] md:text-xs"
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}
