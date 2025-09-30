'use client';
import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Option = { label: string; value: string };

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  maxBadges?: number;
}

export default function MultiSelect({ options, value, onChange, placeholder = 'Filtrar...', emptyText = 'Nada encontrado', maxBadges = 3, className }: MultiSelectProps) {
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
        <Button variant="outline" className={className}>
          {value.length === 0 ? placeholder : (
            <div className="flex gap-1 flex-wrap">
              {value.slice(0, maxBadges).map(v => {
                const label = options.find(o => o.value === v)?.label ?? v;
                return <Badge key={v} variant="secondary" className="cursor-pointer" onClick={(e)=>{e.stopPropagation(); toggle(v)}}>{label} ✕</Badge>;
              })}
              {value.length > maxBadges && <Badge variant="secondary" >+{value.length - maxBadges}</Badge>}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup className="max-h-72 overflow-auto">
            {options.map(opt => {
              const active = selected.has(opt.value);
              return (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => toggle(opt.value)}
                  className="flex justify-between"
                >
                  <span>{opt.label}</span>
                  {active && <span className="text-primary">✓</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}