export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Overview</h1>
        <p className="text-neutral-400">
            Welcome back, Betty. Here's what's happening today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Placeholder Stat Cards */}
        {[
            { label: "Total Orders", value: "124", change: "+12.5%", color: "text-emerald-500" },
            { label: "Total Sales", value: "€3,450", change: "+8.2%", color: "text-emerald-500" },
            { label: "Avg. Order Value", value: "€27.80", change: "-2.1%", color: "text-rose-500" },
        ].map((stat, i) => (
            <div key={i} className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg group hover:border-neutral-700 transition-colors">
                <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">{stat.label}</p>
                <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-white">{stat.value}</span>
                    <span className={`text-sm font-medium ${stat.color}`}>{stat.change}</span>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}
