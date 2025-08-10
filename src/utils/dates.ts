export const toISODate = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (d: Date, n: number) => {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}
export const startOfWeek = (d: Date) => {
  const c = new Date(d)
  const day = c.getDay() || 7
  if (day !== 1) c.setHours(-24 * (day - 1))
  c.setHours(0, 0, 0, 0)
  return c
}
