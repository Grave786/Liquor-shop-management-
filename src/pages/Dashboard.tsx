import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import { Sale, InventoryItem, Product, Outlet } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  Store, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  DollarSign,
  ShoppingCart
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

const Dashboard: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const outletIdParam = (searchParams.get('outletId') || '').trim();
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const effectiveOutletId = isAdmin ? outletIdParam : (profile?.outletId || '');
        const salesUrl = effectiveOutletId
          ? `/api/sales?outletId=${encodeURIComponent(effectiveOutletId)}`
          : '/api/sales';
        const invUrl = effectiveOutletId
          ? `/api/inventory?outletId=${encodeURIComponent(effectiveOutletId)}`
          : '/api/inventory';

        const [salesRes, invRes, prodRes, outRes] = await Promise.all([
          apiFetch(salesUrl),
          apiFetch(invUrl),
          apiFetch('/api/products'),
          isAdmin ? apiFetch('/api/outlets') : Promise.resolve(null as any)
        ]);

        if (salesRes.ok) setSales(await salesRes.json());
        if (invRes.ok) setInventory(await invRes.json());
        if (prodRes.ok) setProducts(await prodRes.json());
        if (outRes?.ok) setOutlets(await outRes.json());
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile) {
      setLoading(true);
      fetchData();
    }
  }, [isAdmin, outletIdParam, profile]);

  const now = useMemo(() => new Date(), [rangeDays, sales]);

  const salesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of sales) {
      const ts = new Date(sale.timestamp);
      if (Number.isNaN(ts.getTime())) continue;
      const key = format(ts, 'yyyy-MM-dd');
      map.set(key, (map.get(key) || 0) + (sale.totalAmount || 0));
    }
    return map;
  }, [sales]);

  const chartData = useMemo(() => {
    return Array.from({ length: rangeDays }).map((_, i) => {
      const date = subDays(now, rangeDays - 1 - i);
      const key = format(date, 'yyyy-MM-dd');
      return {
        name: format(date, rangeDays === 30 ? 'MMM d' : 'MMM dd'),
        sales: salesByDay.get(key) || 0,
      };
    });
  }, [now, rangeDays, salesByDay]);

  const lowStockCount = useMemo(() => inventory.reduce((sum, item) => sum + (item.quantity < 10 ? 1 : 0), 0), [inventory]);
  const totalProducts = products.length;

  const { totalSalesAmount, revenueTrend, revenueIsUp } = useMemo(() => {
    const currentStart = startOfDay(subDays(now, rangeDays - 1));
    const currentEnd = endOfDay(now);
    const prevStart = startOfDay(subDays(now, rangeDays * 2 - 1));
    const prevEnd = endOfDay(subDays(now, rangeDays));

    let currentRevenue = 0;
    let prevRevenue = 0;

    for (const sale of sales) {
      const ts = new Date(sale.timestamp);
      if (Number.isNaN(ts.getTime())) continue;

      if (isWithinInterval(ts, { start: currentStart, end: currentEnd })) currentRevenue += sale.totalAmount || 0;
      else if (isWithinInterval(ts, { start: prevStart, end: prevEnd })) prevRevenue += sale.totalAmount || 0;
    }

    const pct = prevRevenue === 0 ? (currentRevenue > 0 ? 100 : 0) : ((currentRevenue - prevRevenue) / prevRevenue) * 100;
    const isUp = pct >= 0;
    const label = `${isUp ? '+' : ''}${pct.toFixed(1)}%`;

    return { totalSalesAmount: currentRevenue, revenueTrend: label, revenueIsUp: isUp };
  }, [now, rangeDays, sales]);

  const stats = [
    { name: `Revenue (Last ${rangeDays}d)`, value: `$${totalSalesAmount.toLocaleString()}`, icon: DollarSign, color: 'bg-emerald-500', trend: revenueTrend, isUp: revenueIsUp },
    { name: 'Inventory Rows', value: inventory.length.toString(), icon: Package, color: 'bg-blue-500', trend: '—', isUp: true },
    { name: 'Low Stock Alerts', value: lowStockCount.toString(), icon: AlertTriangle, color: 'bg-amber-500', trend: '—', isUp: false },
    { name: 'Total Products', value: totalProducts.toString(), icon: TrendingUp, color: 'bg-indigo-500', trend: '—', isUp: true },
  ];

  const selectedOutletName = useMemo(() => {
    if (!isAdmin) return '';
    if (!outletIdParam) return 'All Outlets';
    return outlets.find(o => o.id === outletIdParam)?.name || 'Selected Outlet';
  }, [isAdmin, outletIdParam, outlets]);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl" />)}
      </div>
      <div className="h-96 bg-gray-200 rounded-2xl" />
    </div>;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, {profile?.displayName || 'User'}. Here's what's happening today.
            {isAdmin && (
              <span className="ml-2 text-gray-400">- {selectedOutletName}</span>
            )}
          </p>
        </div>
        <div className="text-right space-y-3 w-full sm:w-auto">
          {isAdmin && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest self-end sm:self-auto">Outlet View</p>
              <select
                className="text-sm border-gray-200 rounded-lg bg-gray-50 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                value={outletIdParam}
                onChange={(e) => {
                  const next = e.target.value;
                  const nextParams = new URLSearchParams(searchParams);
                  if (!next) nextParams.delete('outletId');
                  else nextParams.set('outletId', next);
                  setSearchParams(nextParams);
                }}
              >
                <option value="">All Outlets</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col sm:items-end">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current Session</p>
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2 justify-end mt-1">
              <Clock size={16} className="text-blue-500" />
              {format(new Date(), 'EEEE, MMMM do')}
            </p>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-xl text-white", stat.color)}>
                <stat.icon size={24} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                stat.trend === '—'
                  ? "bg-gray-100 text-gray-600"
                  : stat.isUp
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-red-50 text-red-600"
              )}>
                {stat.trend !== '—' && (stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
                {stat.trend}
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500">{stat.name}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-gray-900">Sales Performance</h3>
            <select
              className="text-sm border-gray-200 rounded-lg bg-gray-50 px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500"
              value={rangeDays}
              onChange={(e) => setRangeDays((parseInt(e.target.value, 10) === 30 ? 30 : 7) as 7 | 30)}
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#94a3b8' }} 
                  dy={10}
                  interval={rangeDays === 30 ? 4 : 0}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#94a3b8' }} 
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="sales" 
                  fill="#3b82f6" 
                  radius={[6, 6, 0, 0]} 
                  barSize={rangeDays === 30 ? 14 : 40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Sales</h3>
          <div className="flex-1 space-y-6 overflow-y-auto pr-2">
            {sales.slice(0, 5).map((sale, i) => (
              <div key={sale.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {sale.userId.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Sale #{sale.id.slice(-4)}</p>
                    <p className="text-xs text-gray-500">{format(new Date(sale.timestamp), 'h:mm a')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">${sale.totalAmount.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Completed</p>
                </div>
              </div>
            ))}
            {sales.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                <ShoppingCart size={48} className="opacity-20 mb-4" />
                <p className="text-sm font-medium">No sales recorded yet</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              const qs = outletIdParam ? `?outletId=${encodeURIComponent(outletIdParam)}` : '';
              navigate(`/transactions${qs}`);
            }}
            className="mt-8 w-full py-3 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
          >
            View All Transactions
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
