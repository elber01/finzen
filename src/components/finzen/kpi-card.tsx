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
}: KpiCardProps) {
  const colorVar =
    color === 'income'
      ? 'var(--income)'
      : color === 'expense'
      ? 'var(--expense)'
      : color === 'warning'
      ? 'var(--warning)'
      : 'var(--primary)';

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-border',
        size === 'hero' ? 'p-6' : 'p-4',
        className
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          {delta && deltaDirection !== 'neutral' && (
            <span
              className={cn(
                'text-xs font-semibold flex items-center gap-0.5',
                deltaDirection === 'up' ? 'text-income' : 'text-expense'
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
            'font-bold tabular-nums mt-1',
            size === 'hero' ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'
          )}
          style={{ color: size === 'hero' ? 'var(--foreground)' : colorVar }}
        >
          {amount}
        </div>
        {suffix && <div className="text-xs text-muted-foreground mt-1">{suffix}</div>}

        {sparkData && sparkData.length > 1 && (
          <div className={cn('w-full', size === 'hero' ? 'h-14 mt-3' : 'h-8 mt-2')}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData.map((v, i) => ({ i, v }))}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colorVar} stopOpacity={0.3} />
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
