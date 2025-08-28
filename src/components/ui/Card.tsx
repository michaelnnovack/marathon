import { ReactNode } from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outlined' | 'elevated'
}

export function Card({ 
  children, 
  className, 
  padding = 'md',
  variant = 'default'
}: CardProps) {
  return (
    <div className={clsx(
      'rounded-2xl border border-black/10 dark:border-white/10',
      {
        'bg-white/60 dark:bg-black/30': variant === 'default',
        'bg-transparent border-2': variant === 'outlined',
        'bg-white dark:bg-gray-900 shadow-lg': variant === 'elevated',
        'p-0': padding === 'none',
        'p-3': padding === 'sm',
        'p-4 sm:p-6': padding === 'md',
        'p-6 sm:p-8': padding === 'lg'
      },
      className
    )}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function CardHeader({ children, className, icon, size = 'md' }: CardHeaderProps) {
  const headingClasses = clsx({
    'text-sm font-medium': size === 'sm',
    'text-base font-medium': size === 'md', 
    'text-lg font-semibold': size === 'lg'
  })
  
  return (
    <div className={clsx('flex items-center gap-2 mb-4', className)}>
      {icon}
      <h3 className={headingClasses}>{children}</h3>
    </div>
  )
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={clsx('space-y-4', className)}>
      {children}
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  className?: string
  loading?: boolean
  trend?: 'positive' | 'negative' | 'neutral'
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  className,
  loading = false,
  trend = 'neutral'
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <div className="animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <div className="w-20 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
          <div className="w-16 h-8 bg-gray-300 dark:bg-gray-600 rounded mb-1"></div>
          <div className="w-24 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>
      </Card>
    )
  }

  const trendColor = trend === 'positive' 
    ? 'text-green-600 dark:text-green-400'
    : trend === 'negative' 
    ? 'text-red-600 dark:text-red-400'
    : 'text-gray-600 dark:text-gray-400'

  return (
    <Card className={clsx(className, 
      trend === 'positive' && 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10',
      trend === 'negative' && 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
    )}>
      <div className="flex items-center gap-2 text-sm opacity-70 mb-1">
        {icon}
        {title}
      </div>
      <div className={clsx("text-2xl font-semibold", trendColor)}>{value}</div>
      {subtitle && (
        <div className="text-xs opacity-70 mt-1">{subtitle}</div>
      )}
    </Card>
  )
}