import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import { Outlet, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  MapPin, 
  User, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Store,
  X,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { differenceInCalendarDays, format } from 'date-fns';

const Outlets: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    managerId: '',
    licenseNumber: '',
    licenseValidUntil: ''
  });

  const fetchData = async () => {
    try {
      const [outRes, userRes] = await Promise.all([
        apiFetch('/api/outlets'),
        apiFetch('/api/users')
      ]);

      if (outRes.ok) setOutlets(await outRes.ok ? await outRes.json() : []);
      if (userRes.ok) setUsers(await userRes.ok ? await userRes.json() : []);
    } catch (err) {
      console.error('Error fetching outlets data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        location: formData.location,
        managerId: formData.managerId || null,
        licenseNumber: formData.licenseNumber || null,
        licenseValidUntil: formData.licenseValidUntil ? new Date(formData.licenseValidUntil).toISOString() : null
      };

      if (editingOutlet) {
        await apiFetch(`/api/outlets/${editingOutlet.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/outlets', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setIsModalOpen(false);
      setEditingOutlet(null);
      setFormData({ name: '', location: '', managerId: '', licenseNumber: '', licenseValidUntil: '' });
      fetchData();
    } catch (err) {
      console.error('Error saving outlet:', err);
    }
  };

  const handleDeleteOutlet = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this outlet?')) {
      await apiFetch(`/api/outlets/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Outlets</h1>
          <p className="text-gray-500 mt-1">Manage physical store locations and assignments.</p>
        </div>
        <button
          onClick={() => {
            setEditingOutlet(null);
            setFormData({ name: '', location: '', managerId: '', licenseNumber: '', licenseValidUntil: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={20} />
          Add Outlet
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {outlets.map((outlet, i) => {
          const manager = users.find(u => u.uid === outlet.managerId);
          const daysLeft = outlet.licenseValidUntil
            ? differenceInCalendarDays(new Date(outlet.licenseValidUntil), new Date())
            : null;
          const licenseUntilLabel = outlet.licenseValidUntil
            ? format(new Date(outlet.licenseValidUntil), 'MMM dd, yyyy')
            : null;

          return (
            <motion.div
              key={outlet.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all duration-300"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Store size={24} />
                  </div>
                  <div className="relative group/menu">
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50">
                      <MoreVertical size={18} />
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-10 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all">
                      <button
                        onClick={() => {
                          setEditingOutlet(outlet);
                          setFormData({
                            name: outlet.name,
                            location: outlet.location,
                            managerId: outlet.managerId || '',
                            licenseNumber: outlet.licenseNumber || '',
                            licenseValidUntil: toDateInputValue(outlet.licenseValidUntil)
                          });
                          setIsModalOpen(true);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteOutlet(outlet.id)}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900">{outlet.name}</h3>
                
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <MapPin size={16} className="text-blue-500" />
                    <span>{outlet.location}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <User size={16} className="text-blue-500" />
                    <span>{manager?.displayName || manager?.email || 'No Manager Assigned'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                      L
                    </span>
                    {!outlet.licenseValidUntil ? (
                      <span>License not set</span>
                    ) : daysLeft !== null && daysLeft < 0 ? (
                      <span className="text-red-600 font-medium">
                        License expired (until {licenseUntilLabel})
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium">
                        {daysLeft} day(s) left (until {licenseUntilLabel})
                        {outlet.licenseNumber ? ` • #${outlet.licenseNumber}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Active Location
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/inventory?outletId=${encodeURIComponent(outlet.id)}`)}
                  className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:gap-2 transition-all"
                >
                  View Inventory <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
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
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingOutlet ? 'Edit Outlet' : 'Add New Outlet'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSaveOutlet} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Outlet Name</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Location</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Manager</label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.managerId}
                      onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    >
                      <option value="">Select a Manager</option>
                      {managers.map(m => (
                        <option key={m.uid} value={m.uid}>
                          {m.displayName || m.email} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">License Number (optional)</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                      placeholder="e.g. LIC-2026-0001"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">License Valid Until</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.licenseValidUntil}
                      onChange={(e) => setFormData({ ...formData, licenseValidUntil: e.target.value })}
                    />
                    <p className="text-xs text-gray-400 font-medium">
                      Used to calculate how many days remain to sell alcohol for this outlet.
                    </p>
                  </div>

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
                      className="flex-1 py-4 text-sm font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      {editingOutlet ? 'Update Outlet' : 'Create Outlet'}
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

export default Outlets;

function toDateInputValue(value?: string) {
  if (!value) return '';
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}
