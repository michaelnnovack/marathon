import DayClient from './DayClient'

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  return <DayClient date={decodeURIComponent(date)} />
}
