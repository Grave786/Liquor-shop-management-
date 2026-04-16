import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import { Product, InventoryItem, Outlet, StockTransfer, StockTransferEvent } from '../types';
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
  const [trackingTransfer, setTrackingTransfer] = useState<StockTransfer | null>(null);
  const [trackingNote, setTrackingNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
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

  const handleAddTrackingNote = async () => {
    if (!trackingTransfer) return;
    const note = trackingNote.trim();
    if (!note) return;

    setSavingNote(true);
    try {
      const res = await apiFetch(`/api/transfers/${trackingTransfer.id}/events`, {
        method: 'POST',
        body: JSON.stringify({ note })
      });
      if (!res.ok) {
        const message = await readApiError(res);
        throw new Error(message || 'Failed to add note');
      }

      const updated: StockTransfer = await res.json();
      setTransfers(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      setTrackingTransfer(updated);
      setTrackingNote('');
    } catch (err: any) {
      console.error('Add tracking note error:', err);
      alert(err.message || 'Failed to add note');
    } finally {
      setSavingNote(false);
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
                            onClick={() => setTrackingTransfer(transfer)}
                            className="p-2 text-blue-700 hover:bg-blue-50 rounded-xl transition-all"
                            title="Track / Notes"
                          >
                            <ChevronRight size={18} />
                          </button>
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
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setTrackingTransfer(transfer)}
                            className="p-2 text-blue-700 hover:bg-blue-50 rounded-xl transition-all"
                            title="Track / Notes"
                          >
                            <ChevronRight size={18} />
                          </button>
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
                      className="app-select w-full"
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
                        className="app-select w-full"
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
                        className="app-select w-full"
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

      {/* Tracking / Notes */}
      <AnimatePresence>
        {trackingTransfer && (
          <div className="fixed inset-0 z-[110] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTrackingTransfer(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[calc(100dvh-2rem)] overflow-y-auto"
            >
              {(() => {
                const product = products.find(p => p.id === trackingTransfer.productId);
                const fromOutlet = outlets.find(o => o.id === trackingTransfer.fromOutletId);
                const toOutlet = outlets.find(o => o.id === trackingTransfer.toOutletId);

                const baseEvents: StockTransferEvent[] = Array.isArray(trackingTransfer.events) ? trackingTransfer.events : [];
                const hasCreated = baseEvents.some(e => e.type === 'created');
                const inferredCreated: StockTransferEvent = { type: 'created', timestamp: trackingTransfer.timestamp };
                const events: StockTransferEvent[] = [
                  ...(hasCreated ? [] : [inferredCreated]),
                  ...baseEvents,
                ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                const canAddNotes = Boolean(isAdmin || isManager);

                return (
                  <div className="p-8">
                    <div className="flex justify-between items-start gap-4 mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Transfer Tracking</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          {product?.name || 'Unknown Product'} • {trackingTransfer.quantity} units
                        </p>
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                          <span className="font-medium">{fromOutlet?.name || 'Unknown'}</span>
                          <ArrowRight size={14} className="text-gray-400" />
                          <span className="font-medium">{toOutlet?.name || 'Unknown'}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          trackingTransfer.status === 'completed' ? "bg-green-50 text-green-700" :
                          trackingTransfer.status === 'pending' ? "bg-amber-50 text-amber-600" :
                          "bg-red-50 text-red-600"
                        )}>
                          {trackingTransfer.status === 'completed' ? <CheckCircle2 size={12} /> :
                           trackingTransfer.status === 'pending' ? <Clock size={12} /> :
                           <XCircle size={12} />}
                          {trackingTransfer.status}
                        </div>
                        <button
                          onClick={() => setTrackingTransfer(null)}
                          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                          aria-label="Close"
                        >
                          <X size={22} />
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-5">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Timeline</p>
                      <div className="space-y-4">
                        {events.length === 0 ? (
                          <p className="text-sm text-gray-600">No tracking events yet.</p>
                        ) : (
                          events.map((e, idx) => {
                            const who = e.userId
                              ? (e.userId === profile?.uid ? 'You' : `User ${String(e.userId).slice(0, 6)}…`)
                              : 'System';

                            let title = 'Update';
                            let detail = '';
                            if (e.type === 'created') {
                              title = 'Created';
                            } else if (e.type === 'status_changed') {
                              title = 'Status changed';
                              if (e.statusFrom && e.statusTo) detail = `${e.statusFrom} → ${e.statusTo}`;
                            } else if (e.type === 'note') {
                              title = 'Note';
                              detail = e.note || '';
                            }

                            return (
                              <div key={`${e.type}-${e.timestamp}-${idx}`} className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-gray-200 text-gray-700">
                                  {e.type === 'note' ? <AlertCircle size={18} /> : <Clock size={18} />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-baseline justify-between gap-4">
                                    <p className="text-sm font-bold text-gray-900">{title}</p>
                                    <p className="text-xs text-gray-500">
                                      {format(new Date(e.timestamp), 'MMM dd, h:mm a')}
                                    </p>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">By {who}</p>
                                  {detail ? (
                                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{detail}</p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {canAddNotes && (
                      <div className="mt-6">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Add Note</p>
                        <div className="flex gap-3">
                          <input
                            value={trackingNote}
                            onChange={(e) => setTrackingNote(e.target.value)}
                            placeholder="E.g., Driver picked up stock, ETA 6pm"
                            className="flex-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={handleAddTrackingNote}
                            disabled={savingNote || !trackingNote.trim()}
                            className={cn(
                              "px-5 py-3 text-sm font-bold rounded-xl transition-all",
                              savingNote || !trackingNote.trim()
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
                            )}
                          >
                            {savingNote ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
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
