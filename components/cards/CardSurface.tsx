'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface CardSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  accentColor?: string;
}

const CardSurface = React.forwardRef<HTMLDivElement, CardSurfaceProps>(
  ({ accentColor = 'hsl(var(--primary))', className, style, children, ...props }, ref) => {
    const mergedStyle = React.useMemo<React.CSSProperties>(() => {
      return {
        ...style,
        ['--card-accent' as string]: accentColor,
      };
    }, [style, accentColor]);

    return (
      <div
        ref={ref}
        style={mergedStyle}
        className={cn(
          'relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 text-sm shadow-soft transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-4 left-0 w-1 rounded-full"
          style={{ background: 'var(--card-accent)' }}
        />
        {children}
      </div>
    );
  },
);

CardSurface.displayName = 'CardSurface';

export default CardSurface;
