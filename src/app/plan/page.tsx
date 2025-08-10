"use client";
import Link from 'next/link'
import { useUserStore } from '@/store/user'
import { generatePlan } from '@/utils/plan'
import { toISODate } from '@/utils/dates'

export default function PlanPage() {
  const user = useUserStore((s) => s.user)
  if (!user?.raceDate) return <div>Set your race date in <Link className="underline" href="/setup">Setup</Link>.</div>
  const todayISO = toISODate(new Date())
  const plan = generatePlan(user.id, todayISO, user.raceDate)
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Training Plan</h1>
      <div className="grid gap-4">
    {plan.weeks.map((w) => (
          <div key={w.start} className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-white/60 dark:bg-black/30">
      <h3 className="font-medium mb-2">Week of {w.start}{w.phase ? ` · ${w.phase.toUpperCase()}` : ''}</h3>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {w.days.map((d) => (
                <li key={d.id} className="rounded-lg p-3 border border-black/10 dark:border-white/10">
                  <Link className="text-sm font-medium underline" href={`/plan/${encodeURIComponent(d.date)}`}>{d.date} · {d.type}</Link>
                  <div className="text-sm opacity-80">{d.description}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
