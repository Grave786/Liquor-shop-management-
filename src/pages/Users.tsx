import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import { UserProfile, Outlet, UserRole } from '../types';
import { 
  Users as UsersIcon, 
  Shield, 
  Store, 
  Mail, 
  MoreVertical, 
  Edit2, 
  X,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Users: React.FC = () => {
  const { user: currentUser, isSuperAdmin, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'user' as UserRole,
    outletId: ''
  });

  const canManageUser = (targetUser: UserProfile) => {
    if (isSuperAdmin) return true;
    if (isAdmin) {
      // Admins cannot manage super_admin or other admins
      return !['super_admin', 'admin'].includes(targetUser.role);
    }
    return false;
  };

  const getAvailableRoles = () => {
    if (isSuperAdmin) return ['super_admin', 'admin', 'manager', 'user'] as UserRole[];
    if (isAdmin) return ['manager', 'user'] as UserRole[];
    return [] as UserRole[];
  };

  const fetchData = async () => {
    try {
      const [userRes, outRes] = await Promise.all([
        apiFetch('/api/users'),
        apiFetch('/api/outlets')
      ]);

      if (userRes.ok) setUsers(await userRes.json());
      if (outRes.ok) setOutlets(await outRes.json());
    } catch (err) {
      console.error('Error fetching users data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        // Update
        const updateData: any = { role: formData.role, outletId: formData.outletId };
        if (formData.password) updateData.password = formData.password;
        if (formData.displayName) updateData.displayName = formData.displayName;

        await apiFetch(`/api/users/${editingUser.uid}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData)
        });
      } else {
        // Create
        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ email: '', password: '', displayName: '', role: 'user', outletId: '' });
      fetchData();
    } catch (err) {
      console.error('Error saving user:', err);
    }
  };

  const availableRoles = getAvailableRoles();

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage user roles and outlet assignments across the enterprise.</p>
        </div>
        {(isSuperAdmin || isAdmin) && (
          <button
            onClick={() => {
              setEditingUser(null);
              setFormData({ email: '', password: '', displayName: '', role: 'user', outletId: '' });
              setIsModalOpen(true);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <UsersIcon size={20} />
            Add New User
          </button>
        )}
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Outlet Assignment</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => {
                const outlet = outlets.find(o => o.id === user.outletId);
                return (
                  <tr key={user.uid} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                          {user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{user.displayName || 'Unnamed User'}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail size={12} /> {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        user.role === 'super_admin' ? "bg-purple-50 text-purple-600" :
                        user.role === 'admin' ? "bg-blue-50 text-blue-600" :
                        user.role === 'manager' ? "bg-amber-50 text-amber-600" :
                        "bg-gray-50 text-gray-600"
                      )}>
                        <Shield size={12} />
                        {user.role.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {outlet ? (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Store size={14} className="text-blue-500" />
                          {outlet.name}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No outlet assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canManageUser(user) && user.uid !== currentUser?.id && (
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setFormData({ 
                              email: user.email, 
                              password: '', 
                              displayName: user.displayName || '', 
                              role: user.role, 
                              outletId: user.outletId || '' 
                            });
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
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
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingUser ? 'Edit User Access' : 'Create New User'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                {editingUser && (
                  <div className="mb-8 p-4 bg-blue-50 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 font-bold text-lg">
                      {editingUser?.displayName?.charAt(0) || editingUser?.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{editingUser?.displayName}</p>
                      <p className="text-sm text-gray-500">{editingUser?.email}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSaveUser} className="space-y-6">
                  {!editingUser && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Email Address</label>
                        <input
                          type="email"
                          required
                          className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="user@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Display Name</label>
                        <input
                          type="text"
                          className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                          value={formData.displayName}
                          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">
                      {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">System Role</label>
                    <div className="grid grid-cols-2 gap-3">
                      {availableRoles.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setFormData({ ...formData, role })}
                          className={cn(
                            "px-4 py-3 rounded-xl text-sm font-bold transition-all border-2",
                            formData.role === role 
                              ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100" 
                              : "bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100"
                          )}
                        >
                          {role.replace('_', ' ').toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Outlet Assignment</label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.outletId}
                      onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                    >
                      <option value="">No Outlet Assignment</option>
                      {outlets.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
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
                      className="flex-1 py-4 text-sm font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={20} />
                      Save Changes
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

export default Users;

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
