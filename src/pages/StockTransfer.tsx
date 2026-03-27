import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import { Product, InventoryItem, Outlet, StockTransfer } from '../types';
import { 
  Plus, 
  ArrowRight, 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ArrowLeftRight,
  ChevronRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

const StockTransfers: React.FC = () => {
  const { profile, isAdmin, isManager } = useAuth();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fromOutletId: '',
    toOutletId: '',
    productId: '',
    quantity: 0
  });

  const fetchData = async () => {
    try {
      const [transRes, prodRes, outRes, invRes] = await Promise.all([
        apiFetch('/api/transfers'),
        apiFetch('/api/products'),
        apiFetch('/api/outlets'),
        apiFetch('/api/inventory')
      ]);

      if (transRes.ok) setTransfers(await transRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (outRes.ok) setOutlets(await outRes.json());
      if (invRes.ok) setInventory(await invRes.json());
    } catch (err) {
      console.error('Error fetching transfers data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.fromOutletId === formData.toOutletId) {
      setError('Source and destination outlets must be different');
      return;
    }

    const sourceStock = inventory.find(i => i.productId === formData.productId && i.outletId === formData.fromOutletId)?.quantity || 0;
    if (sourceStock < formData.quantity) {
      setError('Insufficient stock in source outlet');
      return;
    }

    try {
      await apiFetch('/api/transfers', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setIsModalOpen(false);
      setFormData({ fromOutletId: '', toOutletId: '', productId: '', quantity: 0 });
      setError(null);
      fetchData();
    } catch (err) {
      console.error('Error creating transfer:', err);
    }
  };

  const handleCompleteTransfer = async (transfer: StockTransfer) => {
    try {
      const res = await apiFetch(`/api/transfers/${transfer.id}/complete`, {
        method: 'POST'
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to complete transfer');
      }
      fetchData();
    } catch (err: any) {
      console.error('Transfer completion error:', err);
      alert(err.message || 'Failed to complete transfer');
    }
  };

  const handleCancelTransfer = async (id: string) => {
    await apiFetch(`/api/transfers/${id}/cancel`, { method: 'POST' });
    fetchData();
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Stock Transfers</h1>
          <p className="text-gray-500 mt-1">Move inventory between outlets and track logistics.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={20} />
          New Transfer
        </button>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Product</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Route</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Quantity</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transfers.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((transfer) => {
                const product = products.find(p => p.id === transfer.productId);
                const fromOutlet = outlets.find(o => o.id === transfer.fromOutletId);
                const toOutlet = outlets.find(o => o.id === transfer.toOutletId);

                return (
                  <tr key={transfer.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                          <Package size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{product?.name || 'Unknown Product'}</p>
                          <p className="text-xs text-gray-500">{format(new Date(transfer.timestamp), 'MMM dd, h:mm a')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-gray-900">{fromOutlet?.name}</span>
                        <ArrowRight size={14} className="text-gray-400" />
                        <span className="text-gray-900">{toOutlet?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">{transfer.quantity} units</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        transfer.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                        transfer.status === 'pending' ? "bg-amber-50 text-amber-600" :
                        "bg-red-50 text-red-600"
                      )}>
                        {transfer.status === 'completed' ? <CheckCircle2 size={12} /> :
                         transfer.status === 'pending' ? <Clock size={12} /> :
                         <XCircle size={12} />}
                        {transfer.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {transfer.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleCompleteTransfer(transfer)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Complete Transfer"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button
                            onClick={() => handleCancelTransfer(transfer.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Cancel Transfer"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">New Stock Transfer</h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleCreateTransfer} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Product</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.productId}
                      onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    >
                      <option value="">Select a Product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">From Outlet</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                        value={formData.fromOutletId}
                        onChange={(e) => setFormData({ ...formData, fromOutletId: e.target.value })}
                      >
                        <option value="">Source</option>
                        {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">To Outlet</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                        value={formData.toOutletId}
                        onChange={(e) => setFormData({ ...formData, toOutletId: e.target.value })}
                      >
                        <option value="">Destination</option>
                        {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Quantity</label>
                    <input
                      required
                      type="number"
                      min="1"
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl flex items-center gap-2">
                      <AlertCircle size={18} />
                      {error}
                    </div>
                  )}

                  <div className="pt-4 flex gap-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 text-sm font-bold text-gray-500 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-4 text-sm font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                    >
                      <ArrowLeftRight size={20} />
                      Initiate Transfer
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StockTransfers;

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
