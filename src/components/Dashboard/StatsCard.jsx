export default function StatsCard({ icon, label, value, sub, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  }

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.primary} transition-all duration-200 hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium opacity-70 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold font-heading mt-2">{value}</p>
          {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
        </div>
        <span className="text-2xl opacity-80">{icon}</span>
      </div>
    </div>
  )
}
