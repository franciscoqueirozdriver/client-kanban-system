'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type Option = { label: string; value: string };

export interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  maxBadges?: number;
}

export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Filtrar...',
  emptyText = 'Nada encontrado',
  className,
  maxBadges = 3
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);

  function toggle(val: string) {
    const next = new Set(selected);
    next.has(val) ? next.delete(val) : next.add(val);
    onChange(Array.from(next));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('justify-start gap-2 min-w-[12rem] max-w-full', className)}
        >
          {value.length === 0 ? (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {value.slice(0, maxBadges).map((v) => {
                const label = options.find((o) => o.value === v)?.label ?? v;
                return (
                  <Badge
                    key={v}
                    className="cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggle(v);
                    }}
                  >
                    {label} ✕
                  </Badge>
                );
              })}
              {value.length > maxBadges && <Badge>+{value.length - maxBadges}</Badge>}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 bg-card border border-border shadow-lg">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup className="max-h-72 overflow-auto">
            {options.map((opt) => {
              const active = selected.has(opt.value);
              return (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => toggle(opt.value)}
                  className="flex justify-between"
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <span>✓</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
