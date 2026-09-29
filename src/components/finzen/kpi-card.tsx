'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface KpiCardProps {
  label: string;
  amount: string;
  delta?: string;
  deltaDirection?: 'up' | 'down' | 'neutral';
  className?: string;
  size?: 'default' | 'hero';
  sparkData?: number[];
  color?: 'income' | 'expense' | 'warning' | 'primary';
  suffix?: string;
  variant?: 'default' | 'gradient';
}

export function KpiCard({
  label,
  amount,
  delta,
  deltaDirection = 'neutral',
  className,
  size = 'default',
  sparkData,
  color = 'primary',
  suffix,
  variant = 'default',
}: KpiCardProps) {
  const isGradient = variant === 'gradient';
  const colorVar =
    isGradient
      ? 'rgba(255, 255, 255, 0.95)'
      : color === 'income'
      ? 'var(--income)'
      : color === 'expense'
      ? 'var(--expense)'
      : color === 'warning'
      ? 'var(--warning)'
      : 'var(--primary)';

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-border/60',
        size === 'hero' ? 'p-6' : 'p-4',
        isGradient &&
          'bg-gradient-to-br from-primary via-primary to-[color-mix(in_oklab,var(--primary)_78%,var(--info))] text-primary-foreground border-transparent shadow-md',
        className
      )}
    >
      {isGradient && (
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none"
        />
      )}
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'text-xs font-medium uppercase tracking-wide',
              isGradient ? 'text-white/70' : 'text-muted-foreground'
            )}
          >
            {label}
          </span>
          {delta && deltaDirection !== 'neutral' && (
            <span
              className={cn(
                'text-xs font-semibold flex items-center gap-0.5 rounded-full px-1.5 py-0.5',
                isGradient
                  ? 'bg-white/15 text-white'
                  : deltaDirection === 'up'
                  ? 'text-income bg-income-soft/60'
                  : 'text-expense bg-expense-soft/60'
              )}
            >
              {deltaDirection === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {delta}
            </span>
          )}
        </div>

        <div
          className={cn(
            'font-bold tabular-nums mt-1 tracking-tight',
            size === 'hero' ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'
          )}
          style={{ color: isGradient ? undefined : size === 'hero' ? 'var(--foreground)' : colorVar }}
        >
          {amount}
        </div>
        {suffix && (
          <div className={cn('text-xs mt-1', isGradient ? 'text-white/70' : 'text-muted-foreground')}>
            {suffix}
          </div>
        )}

        {sparkData && sparkData.length > 1 && (
          <div className={cn('w-full', size === 'hero' ? 'h-14 mt-3' : 'h-8 mt-2')}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData.map((v, i) => ({ i, v }))}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colorVar} stopOpacity={isGradient ? 0.45 : 0.3} />
                    <stop offset="100%" stopColor={colorVar} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={colorVar}
                  strokeWidth={2}
                  fill={`url(#spark-${label})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
