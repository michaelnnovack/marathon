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
}

export function CardHeader({ children, className, icon }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-center gap-2 mb-4', className)}>
      {icon}
      <h3 className="font-medium">{children}</h3>
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
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  className,
  loading = false 
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

  return (
    <Card className={className}>
      <div className="flex items-center gap-2 text-sm opacity-70 mb-1">
        {icon}
        {title}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {subtitle && (
        <div className="text-xs opacity-70 mt-1">{subtitle}</div>
      )}
    </Card>
  )
}