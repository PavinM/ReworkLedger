import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type ReworkPoint = { date: string; label: string; hours: number; average: number }

export default function ReworkChart({ data }: { data: ReworkPoint[] }) {
  return <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="label" interval={Math.max(0, Math.ceil(data.length / 7) - 1)} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 9 }} minTickGap={12} />
      <YAxis width={32} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 9 }} allowDecimals domain={[0, 'auto']} />
      <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} h`]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 10 }} />
      <ReferenceLine y={data[0]?.average ?? 0} stroke="var(--muted)" strokeDasharray="4 4" />
      <Line type="monotone" dataKey="hours" name="Rework hours" stroke="var(--lime)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
    </LineChart>
  </ResponsiveContainer>
}
