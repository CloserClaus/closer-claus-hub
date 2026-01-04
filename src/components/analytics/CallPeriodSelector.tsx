import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { CallPeriod } from '@/hooks/useCallAnalytics';

interface CallPeriodSelectorProps {
  value: CallPeriod;
  onChange: (period: CallPeriod) => void;
  customStartDate?: Date;
  customEndDate?: Date;
  onCustomDateChange?: (start: Date | undefined, end: Date | undefined) => void;
}

export function CallPeriodSelector({
  value,
  onChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
}: CallPeriodSelectorProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(customStartDate);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(customEndDate);
  const [selectingStart, setSelectingStart] = useState(true);

  const periods: { value: CallPeriod; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
  ];

  const handleDateSelect = (date: Date | undefined) => {
    if (selectingStart) {
      setTempStartDate(date);
      setTempEndDate(undefined);
      setSelectingStart(false);
    } else {
      if (date && tempStartDate && date < tempStartDate) {
        // If end date is before start date, swap them
        setTempEndDate(tempStartDate);
        setTempStartDate(date);
      } else {
        setTempEndDate(date);
      }
      
      // Apply the custom date range
      if (date && tempStartDate) {
        const finalStart = date < tempStartDate ? date : tempStartDate;
        const finalEnd = date < tempStartDate ? tempStartDate : date;
        onCustomDateChange?.(finalStart, finalEnd);
        onChange('custom');
        setIsCalendarOpen(false);
        setSelectingStart(true);
      }
    }
  };

  const handlePresetClick = (period: CallPeriod) => {
    onChange(period);
    setTempStartDate(undefined);
    setTempEndDate(undefined);
    setSelectingStart(true);
  };

  const formatCustomLabel = () => {
    if (customStartDate && customEndDate) {
      return `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d')}`;
    }
    return 'Custom';
  };

  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 md:p-1 bg-muted/30 gap-0.5">
      {periods.map((period) => (
        <Button
          key={period.value}
          variant={value === period.value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => handlePresetClick(period.value)}
          className="h-6 md:h-7 px-2 md:px-3 text-[10px] md:text-xs"
        >
          {period.label}
        </Button>
      ))}
      
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={value === 'custom' ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              "h-6 md:h-7 px-2 md:px-3 text-[10px] md:text-xs gap-1",
              value === 'custom' && "min-w-[100px]"
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {value === 'custom' ? formatCustomLabel() : 'Custom'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 border-b border-border">
            <p className="text-xs text-muted-foreground">
              {selectingStart ? 'Select start date' : 'Select end date'}
            </p>
            {tempStartDate && !tempEndDate && (
              <p className="text-xs font-medium mt-1">
                Start: {format(tempStartDate, 'MMM d, yyyy')}
              </p>
            )}
          </div>
          <Calendar
            mode="single"
            selected={selectingStart ? tempStartDate : tempEndDate}
            onSelect={handleDateSelect}
            disabled={(date) => date > new Date()}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
