import { ReactNode } from 'react'
import { clsx } from 'clsx'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className
}: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center justify-center font-medium rounded-full',
      {
        // Variants
        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300': variant === 'default',
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300': variant === 'primary',
        'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300': variant === 'success',
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300': variant === 'warning',
        'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300': variant === 'danger',
        'border border-gray-300 bg-transparent text-gray-700 dark:border-gray-600 dark:text-gray-300': variant === 'outline',
        
        // Sizes
        'px-2 py-0.5 text-xs': size === 'sm',
        'px-2.5 py-1 text-sm': size === 'md',
        'px-3 py-1.5 text-base': size === 'lg'
      },
      className
    )}>
      {children}
    </span>
  )
}

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'loading' | 'error' | 'success'
  className?: string
  showText?: boolean
}

export function StatusBadge({ 
  status, 
  className, 
  showText = false 
}: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          color: 'bg-green-500',
          text: 'Online',
          animate: false
        }
      case 'offline':
        return {
          color: 'bg-gray-400',
          text: 'Offline',
          animate: false
        }
      case 'loading':
        return {
          color: 'bg-yellow-500',
          text: 'Loading',
          animate: true
        }
      case 'error':
        return {
          color: 'bg-red-500',
          text: 'Error',
          animate: false
        }
      case 'success':
        return {
          color: 'bg-green-500',
          text: 'Success',
          animate: false
        }
      default:
        return {
          color: 'bg-gray-400',
          text: 'Unknown',
          animate: false
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      <div
        className={clsx(
          'w-2 h-2 rounded-full',
          config.color,
          {
            'animate-pulse': config.animate
          }
        )}
      />
      {showText && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {config.text}
        </span>
      )}
    </div>
  )
}