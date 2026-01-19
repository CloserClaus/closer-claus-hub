import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

export interface ComboboxOption {
  value: string;
  label: string;
  group?: string;
}

interface MultiSelectComboboxProps {
  options: ComboboxOption[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  maxDisplayed?: number;
  allowCustom?: boolean;
}

export function MultiSelectCombobox({
  options,
  selected,
  onSelectionChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  className,
  maxDisplayed = 3,
  allowCustom = false,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options;
    const query = searchValue.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query)
    );
  }, [options, searchValue]);

  // Group options by their group property
  const groupedOptions = React.useMemo(() => {
    const groups: Record<string, ComboboxOption[]> = {};
    filteredOptions.forEach((option) => {
      const group = option.group || 'default';
      if (!groups[group]) groups[group] = [];
      groups[group].push(option);
    });
    return groups;
  }, [filteredOptions]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter((v) => v !== value));
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  const removeOption = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selected.filter((v) => v !== value));
  };

  const handleAddCustom = () => {
    if (allowCustom && searchValue.trim() && !selected.includes(searchValue.trim())) {
      onSelectionChange([...selected, searchValue.trim()]);
      setSearchValue('');
    }
  };

  const getLabel = (value: string) => {
    const option = options.find((o) => o.value === value);
    return option?.label || value;
  };

  const displayedBadges = selected.slice(0, maxDisplayed);
  const remainingCount = selected.length - maxDisplayed;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between min-h-[40px] h-auto', className)}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {displayedBadges.map((value) => (
                  <Badge
                    key={value}
                    variant="secondary"
                    className="gap-1 text-xs"
                  >
                    {getLabel(value)}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={(e) => removeOption(value, e)}
                    />
                  </Badge>
                ))}
                {remainingCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    +{remainingCount} more
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[300px] p-0 z-50 bg-popover" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && allowCustom && searchValue.trim()) {
                e.preventDefault();
                handleAddCustom();
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              {allowCustom && searchValue.trim() ? (
                <button
                  className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent cursor-pointer"
                  onClick={handleAddCustom}
                >
                  Add "{searchValue}"
                </button>
              ) : (
                emptyMessage
              )}
            </CommandEmpty>
            {Object.entries(groupedOptions).map(([group, groupOptions]) => (
              <CommandGroup key={group} heading={group !== 'default' ? group : undefined}>
                {groupOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => toggleOption(option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selected.includes(option.value) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
