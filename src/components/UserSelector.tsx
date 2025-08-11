"use client"
import { useEffect, useState } from 'react'
import { useUserStore, users } from '@/store/user'
import ProfileCard from './ProfileCard'
import { Card } from '@/components/ui/Card'
import { UserIcon, PlusIcon } from '@heroicons/react/24/outline'

interface UserSelectorProps {
  variant?: 'compact' | 'cards'
  showStats?: boolean
}

export function UserSelector({ variant = 'compact', showStats = false }: UserSelectorProps = {}) {
  const user = useUserStore((s) => s.user)
  const setUser = useUserStore((s) => s.setUser)
  const hydrate = useUserStore((s) => s.hydrate)
  const isLoading = useUserStore((s) => s.isLoading)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    hydrate()
    setMounted(true)
  }, [hydrate])

  if (!mounted) {
    return (
      <div className="animate-pulse">
        {variant === 'compact' ? (
          <div className="flex items-center gap-2">
            <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          </div>
        )}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => setUser(u)}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-full text-sm border transition-all disabled:opacity-50 ${
              user?.id === u.id
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
                : 'bg-white/60 dark:bg-black/30 border-black/10 dark:border-white/10 hover:bg-white/80 dark:hover:bg-black/50 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                user?.id === u.id ? 'bg-white' : 'bg-indigo-500'
              }`}></div>
              {u.name}
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserIcon className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Select Your Profile</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {users.map((u) => (
          <ProfileCard
            key={u.id}
            user={u}
            isActive={user?.id === u.id}
            onClick={() => setUser(u)}
            showStats={showStats}
          />
        ))}
        
        {/* Future: Add new profile option */}
        <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600 hover:border-indigo-400 transition-colors cursor-pointer opacity-60 hover:opacity-100">
          <div className="p-8 text-center">
            <PlusIcon className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <div className="text-sm opacity-60">Add Profile</div>
            <div className="text-xs opacity-40 mt-1">Coming soon</div>
          </div>
        </Card>
      </div>
      
      {user && (
        <div className="text-sm text-center opacity-60">
          Training as <span className="font-medium">{user.name}</span>
        </div>
      )}
    </div>
  )
}
