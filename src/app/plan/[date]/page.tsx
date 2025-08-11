import EnhancedDayClient from './EnhancedDayClient'

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  return <EnhancedDayClient date={decodeURIComponent(date)} />
}
