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
  Trash2,
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
      const res = await apiFetch(`/api/transfers/${transfer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' })
      });
      if (!res.ok) {
        const message = await readApiError(res);
        throw new Error(message || 'Failed to complete transfer');
      }
      fetchData();
    } catch (err: any) {
      console.error('Transfer completion error:', err);
      alert(err.message || 'Failed to complete transfer');
    }
  };

  const handleCancelTransfer = async (id: string) => {
    try {
      const res = await apiFetch(`/api/transfers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (!res.ok) {
        const message = await readApiError(res);
        throw new Error(message || 'Failed to cancel transfer');
      }
      fetchData();
    } catch (err: any) {
      console.error('Transfer cancel error:', err);
      alert(err.message || 'Failed to cancel transfer');
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!window.confirm('Delete this transfer history entry? This will not revert inventory changes.')) return;

    try {
      const res = await apiFetch(`/api/transfers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const message = await readApiError(res);
        throw new Error(message || 'Failed to delete transfer');
      }
      fetchData();
    } catch (err: any) {
      console.error('Transfer delete error:', err);
      alert(err.message || 'Failed to delete transfer');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="app-h1">Stock Transfers</h1>
          <p className="app-subtitle">Move inventory between outlets and track logistics.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="app-btn-primary rounded-xl"
        >
          <Plus size={20} />
          New Transfer
        </button>
      </header>

      <div className="app-card">
        <div className="overflow-x-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Route</th>
                <th>Quantity</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transfers.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((transfer) => {
                const product = products.find(p => p.id === transfer.productId);
                const fromOutlet = outlets.find(o => o.id === transfer.fromOutletId);
                const toOutlet = outlets.find(o => o.id === transfer.toOutletId);

                return (
                  <tr key={transfer.id}>
                    <td>
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
                    <td>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-gray-900">{fromOutlet?.name}</span>
                        <ArrowRight size={14} className="text-gray-400" />
                        <span className="text-gray-900">{toOutlet?.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm font-bold text-gray-900">{transfer.quantity} units</span>
                    </td>
                    <td>
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        transfer.status === 'completed' ? "bg-green-50 text-green-700" :
                        transfer.status === 'pending' ? "bg-amber-50 text-amber-600" :
                        "bg-red-50 text-red-600"
                      )}>
                        {transfer.status === 'completed' ? <CheckCircle2 size={12} /> :
                         transfer.status === 'pending' ? <Clock size={12} /> :
                         <XCircle size={12} />}
                        {transfer.status}
                      </div>
                    </td>
                    <td className="text-right">
                      {transfer.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleCompleteTransfer(transfer)}
                            className="p-2 text-green-700 hover:bg-green-50 rounded-xl transition-all"
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
                          <button
                            onClick={() => handleDeleteTransfer(transfer.id)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            title="Delete History"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleDeleteTransfer(transfer.id)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            title="Delete History"
                          >
                            <Trash2 size={18} />
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
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
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
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[calc(100dvh-2rem)] overflow-y-auto"
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
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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

async function readApiError(res: Response) {
  try {
    const text = await res.text();
    if (!text) return `${res.status} ${res.statusText}`.trim();
    try {
      const parsed = JSON.parse(text);
      return parsed?.message || text;
    } catch {
      return text;
    }
  } catch {
    return `${res.status} ${res.statusText}`.trim();
  }
}
