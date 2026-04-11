import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import { Outlet, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search,
  Filter,
  MapPin, 
  User, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Store,
  X,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Table2
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
  const [searchTerm, setSearchTerm] = useState('');
  const [licenseFilter, setLicenseFilter] = useState<'all' | 'active' | 'expiring' | 'expired' | 'not_set'>('all');
  const [managerFilter, setManagerFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('outlets:viewMode');
      return saved === 'table' ? 'table' : 'grid';
    } catch {
      return 'grid';
    }
  });

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

  const openEditOutlet = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    setFormData({
      name: outlet.name,
      location: outlet.location,
      managerId: outlet.managerId || '',
      licenseNumber: outlet.licenseNumber || '',
      licenseValidUntil: toDateInputValue(outlet.licenseValidUntil)
    });
    setIsModalOpen(true);
  };

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');
  const managerToOutletId = new Map<string, string>();
  for (const outlet of outlets) {
    if (outlet.managerId) managerToOutletId.set(outlet.managerId, outlet.id);
  }
  const editingOutletId = editingOutlet?.id || '';

  const userById = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const u of users) map.set(u.uid, u);
    return map;
  }, [users]);

  const now = useMemo(() => new Date(), []);
  const EXPIRING_SOON_DAYS = 30;

  const getDaysLeft = (outlet: Outlet) => {
    if (!outlet.licenseValidUntil) return null;
    return differenceInCalendarDays(new Date(outlet.licenseValidUntil), now);
  };

  const getLicenseStatus = (outlet: Outlet) => {
    const daysLeft = getDaysLeft(outlet);
    if (!outlet.licenseValidUntil || daysLeft === null) return 'not_set' as const;
    if (daysLeft < 0) return 'expired' as const;
    if (daysLeft <= EXPIRING_SOON_DAYS) return 'expiring' as const;
    return 'active' as const;
  };

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const filteredOutlets = outlets.filter((outlet) => {
    const manager = outlet.managerId ? userById.get(outlet.managerId) : undefined;
    const searchHaystack = [
      outlet.name,
      outlet.location,
      outlet.licenseNumber || '',
      manager?.displayName || '',
      manager?.email || ''
    ].join(' ').toLowerCase();

    const matchesSearch = !normalizedSearch || searchHaystack.includes(normalizedSearch);

    const status = getLicenseStatus(outlet);
    const matchesLicense = licenseFilter === 'all' || status === licenseFilter;

    const isAssigned = !!outlet.managerId;
    const matchesManager =
      managerFilter === 'all' ||
      (managerFilter === 'assigned' && isAssigned) ||
      (managerFilter === 'unassigned' && !isAssigned);

    return matchesSearch && matchesLicense && matchesManager;
  });

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="app-h1">Outlets</h1>
          <p className="app-subtitle">Manage physical store locations and assignments.</p>
        </div>
        <button
          onClick={() => {
            setEditingOutlet(null);
            setFormData({ name: '', location: '', managerId: '', licenseNumber: '', licenseValidUntil: '' });
            setIsModalOpen(true);
          }}
          className="app-btn-primary rounded-xl"
        >
          <Plus size={20} />
          Add Outlet
        </button>
      </header>

      {/* Filters */}
      <div className="app-card p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by outlet, location, manager, or license..."
            className="app-input pl-10 pr-4 py-2 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center rounded-xl border border-[color:var(--app-card-border)] bg-[color:var(--app-card-bg)] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setViewMode('grid');
                try { localStorage.setItem('outlets:viewMode', 'grid'); } catch {}
              }}
              className={cn(
                "px-3 py-2 text-xs font-bold flex items-center gap-2 transition-colors",
                viewMode === 'grid'
                  ? "bg-blue-600 text-white"
                  : "text-[color:var(--app-fg)] hover:bg-[color:var(--app-icon-hover-bg)]"
              )}
              aria-pressed={viewMode === 'grid'}
              aria-label="Grid view"
            >
              <LayoutGrid size={16} />
              Grid
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('table');
                try { localStorage.setItem('outlets:viewMode', 'table'); } catch {}
              }}
              className={cn(
                "px-3 py-2 text-xs font-bold flex items-center gap-2 transition-colors",
                viewMode === 'table'
                  ? "bg-blue-600 text-white"
                  : "text-[color:var(--app-fg)] hover:bg-[color:var(--app-icon-hover-bg)]"
              )}
              aria-pressed={viewMode === 'table'}
              aria-label="Table view"
            >
              <Table2 size={16} />
              Table
            </button>
          </div>

          <div className="relative">
            <select
              className="app-select appearance-none pl-4 pr-10 py-2 text-sm font-medium text-gray-700 cursor-pointer"
              value={licenseFilter}
              onChange={(e) => setLicenseFilter(e.target.value as any)}
            >
              <option value="all">All Licenses</option>
              <option value="active">Active</option>
              <option value="expiring">Expiring Soon</option>
              <option value="expired">Expired</option>
              <option value="not_set">Not Set</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>

          <div className="relative">
            <select
              className="app-select appearance-none pl-4 pr-10 py-2 text-sm font-medium text-gray-700 cursor-pointer"
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value as any)}
            >
              <option value="all">All Managers</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>

          <button className="app-btn-icon" type="button" aria-label="Filters">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOutlets.map((outlet, i) => {
          const manager = outlet.managerId ? userById.get(outlet.managerId) : undefined;
          const daysLeft = getDaysLeft(outlet);
          const licenseUntilLabel = outlet.licenseValidUntil
            ? format(new Date(outlet.licenseValidUntil), 'MMM dd, yyyy')
            : null;

          return (
            <motion.div
              key={outlet.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="app-card group hover:shadow-md transition-all duration-300"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Store size={24} />
                  </div>
                  <div className="relative group/menu">
                    <button type="button" className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50">
                      <MoreVertical size={18} />
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-10 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all">
                      <button
                        type="button"
                        onClick={() => openEditOutlet(outlet)}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <button
                        type="button"
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
                      <span className="text-green-700 font-medium">
                        {daysLeft} day(s) left (until {licenseUntilLabel})
                        {outlet.licenseNumber ? ` • #${outlet.licenseNumber}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200/70 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.22em]">
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

          {!loading && filteredOutlets.length === 0 && (
            <div className="p-10 text-center text-gray-400 text-sm md:col-span-2 lg:col-span-3">
              No outlets match your filters.
            </div>
          )}
        </div>
      ) : (
        <div className="app-card overflow-x-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Location</th>
                <th>Manager</th>
                <th>License</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOutlets.map((outlet) => {
                const manager = outlet.managerId ? userById.get(outlet.managerId) : undefined;
                const daysLeft = getDaysLeft(outlet);
                const licenseUntilLabel = outlet.licenseValidUntil
                  ? format(new Date(outlet.licenseValidUntil), 'MMM dd, yyyy')
                  : null;

                return (
                  <tr key={outlet.id}>
                    <td>
                      <div className="font-bold text-gray-900">{outlet.name}</div>
                      {outlet.licenseNumber && (
                        <div className="text-xs text-gray-500">#{outlet.licenseNumber}</div>
                      )}
                    </td>
                    <td className="text-sm text-gray-700">{outlet.location}</td>
                    <td className="text-sm text-gray-700">
                      {manager?.displayName || manager?.email || <span className="text-gray-400">Unassigned</span>}
                    </td>
                    <td className="text-sm">
                      {!outlet.licenseValidUntil ? (
                        <span className="text-gray-400">Not set</span>
                      ) : daysLeft !== null && daysLeft < 0 ? (
                        <span className="text-red-600 font-bold">Expired</span>
                      ) : daysLeft !== null && daysLeft <= EXPIRING_SOON_DAYS ? (
                        <span className="text-amber-600 font-bold">Expiring</span>
                      ) : (
                        <span className="text-green-700 font-bold">Active</span>
                      )}
                      {licenseUntilLabel && (
                        <span className="text-xs text-gray-400 ml-2">(until {licenseUntilLabel})</span>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => navigate(`/inventory?outletId=${encodeURIComponent(outlet.id)}`)}
                        className="text-xs font-bold text-blue-600 hover:underline mr-3"
                      >
                        Inventory
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditOutlet(outlet)}
                        className="text-xs font-bold text-gray-700 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOutlet(outlet.id)}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!loading && filteredOutlets.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-400 text-sm">
                    No outlets match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
                        <option
                          key={m.uid}
                          value={m.uid}
                          disabled={!!(managerToOutletId.get(m.uid) && managerToOutletId.get(m.uid) !== editingOutletId)}
                        >
                          {m.displayName || m.email} ({m.role})
                        </option>
                      ))}
                    </select>
                    {formData.managerId && managerToOutletId.get(formData.managerId) && managerToOutletId.get(formData.managerId) !== editingOutletId && (
                      <p className="text-xs text-red-600 font-medium">
                        This manager is already assigned to another outlet.
                      </p>
                    )}
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
