"use client";
import { useEffect } from 'react'
import { useUserStore, users } from '@/store/user'

export function UserSelector() {
  const user = useUserStore((s) => s.user)
  const setUser = useUserStore((s) => s.setUser)
  const hydrate = useUserStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <div className="flex items-center gap-2">
      {users.map((u) => (
        <button
          key={u.id}
          onClick={() => setUser(u)}
      className={`px-3 py-1.5 rounded-full text-sm border transition ${
            user?.id === u.id
        ? 'bg-indigo-600 text-white border-indigo-700'
              : 'bg-white/60 dark:bg-black/30 border-black/10 dark:border-white/10 hover:bg-white/80 dark:hover:bg-black/50'
          }`}
        >
          {u.name}
        </button>
      ))}
    </div>
  )
}
