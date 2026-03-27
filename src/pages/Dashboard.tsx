import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import { Sale, InventoryItem, Product } from '../types';
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
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const Dashboard: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const outletId = profile?.outletId;
        const salesUrl = isAdmin ? '/api/sales' : `/api/sales?outletId=${outletId}`;
        const invUrl = isAdmin ? '/api/inventory' : `/api/inventory?outletId=${outletId}`;

        const [salesRes, invRes, prodRes] = await Promise.all([
          apiFetch(salesUrl),
          apiFetch(invUrl),
          apiFetch('/api/products')
        ]);

        if (salesRes.ok) setSales(await salesRes.json());
        if (invRes.ok) setInventory(await invRes.json());
        if (prodRes.ok) setProducts(await prodRes.json());
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile) {
      fetchData();
    }
  }, [isAdmin, profile]);

  const totalSalesAmount = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const lowStockItems = inventory.filter(item => item.quantity < 10);
  const totalProducts = products.length;

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'MMM dd');
    const daySales = sales.filter(sale => {
      const saleDate = new Date(sale.timestamp);
      return saleDate >= startOfDay(date) && saleDate <= endOfDay(date);
    });
    return {
      name: dateStr,
      sales: daySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
    };
  });

  const stats = [
    { name: 'Total Revenue', value: `$${totalSalesAmount.toLocaleString()}`, icon: DollarSign, color: 'bg-emerald-500', trend: '+12.5%', isUp: true },
    { name: 'Active Inventory', value: inventory.length.toString(), icon: Package, color: 'bg-blue-500', trend: '+3.2%', isUp: true },
    { name: 'Low Stock Alerts', value: lowStockItems.length.toString(), icon: AlertTriangle, color: 'bg-amber-500', trend: '-2.1%', isUp: false },
    { name: 'Total Products', value: totalProducts.toString(), icon: TrendingUp, color: 'bg-indigo-500', trend: '+0.5%', isUp: true },
  ];

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
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back, {profile?.displayName || 'User'}. Here's what's happening today.</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current Session</p>
          <p className="text-sm font-medium text-gray-700 flex items-center gap-2 justify-end mt-1">
            <Clock size={16} className="text-blue-500" />
            {format(new Date(), 'EEEE, MMMM do')}
          </p>
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
                stat.isUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
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
            <select className="text-sm border-gray-200 rounded-lg bg-gray-50 px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
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
                  barSize={40}
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
          <button className="mt-8 w-full py-3 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
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
