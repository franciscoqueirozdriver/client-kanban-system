'use client';

import { useMemo, useState } from 'react';
import { ChevronsUpDown, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type MultiSelectOption = { label: string; value: string };

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  maxBadges?: number;
  disabled?: boolean;
  id?: string;
  labelledBy?: string;
  ariaLabel?: string;
}

export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Filtrar...',
  emptyText = 'Nada encontrado',
  className,
  maxBadges = 3,
  disabled = false,
  id,
  labelledBy,
  ariaLabel,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);
  const selectedOptions = useMemo(() => {
    const optionMap = new Map(options.map((option) => [option.value, option.label]));
    return value
      .map((val) => ({ value: val, label: optionMap.get(val) ?? val }))
      .filter((opt) => opt.value);
  }, [options, value]);

  function toggleOption(optionValue: string) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(optionValue)) {
      next.delete(optionValue);
    } else {
      next.add(optionValue);
    }
    onChange(Array.from(next));
  }

  function removeOption(optionValue: string) {
    if (!selected.has(optionValue)) return;
    const next = value.filter((current) => current !== optionValue);
    onChange(next);
  }

  function clearAll() {
    if (!value.length) return;
    onChange([]);
  }

  const buttonAriaLabel = labelledBy ? undefined : ariaLabel ?? (value.length === 0 ? placeholder : `Selecionados: ${value.length}`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={buttonAriaLabel}
          aria-labelledby={labelledBy}
          disabled={disabled}
          className={cn(
            'w-full justify-between gap-2 rounded-xl border-border bg-background text-left text-sm text-foreground shadow-soft transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            value.length > 0 && 'min-h-[2.75rem] items-start',
            disabled && 'cursor-not-allowed opacity-60',
            className,
          )}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1">
            {selectedOptions.length === 0 ? (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {selectedOptions.slice(0, maxBadges).map((item) => (
                  <Badge
                    key={item.value}
                    variant="secondary"
                    className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs"
                  >
                    <span className="truncate" title={item.label}>
                      {item.label}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeOption(item.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          removeOption(item.value);
                        }
                      }}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      aria-label={`Remover ${item.label}`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))}
                {selectedOptions.length > maxBadges && (
                  <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-xs text-muted-foreground">
                    +{selectedOptions.length - maxBadges}
                  </Badge>
                )}
              </>
            )}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            {value.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  clearAll();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    clearAll();
                  }
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Limpar seleção"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-xl border-border bg-popover p-0 shadow-soft" align="start">
        <Command aria-label="Selecionar filtros">
          <CommandInput placeholder="Buscar..." className="h-10" />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup className="max-h-72 overflow-auto">
            {options.map((option) => {
              const isActive = selected.has(option.value);
              return (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggleOption(option.value)}
                  aria-checked={isActive}
                  role="option"
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm',
                    isActive && 'bg-muted/60 text-foreground',
                  )}
                >
                  <span className="truncate" title={option.label}>
                    {option.label}
                  </span>
                  {isActive && <span className="text-xs font-medium text-primary">Selecionado</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
