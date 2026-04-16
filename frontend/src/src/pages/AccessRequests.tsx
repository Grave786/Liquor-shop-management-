import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Mail, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import { Outlet, UserRole } from '../types';

type AccessRequest = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  businessName: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const AccessRequests: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState<AccessRequest | null>(null);
  const [approveForm, setApproveForm] = useState({
    password: '',
    userRole: 'user' as UserRole,
    outletId: '',
    displayName: '',
  });
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const availableRoles: UserRole[] = ['admin', 'manager', 'user'];

  const fetchData = async () => {
    if (!isSuperAdmin) return;
    try {
      setRequestsLoading(true);
      const [outRes, reqRes] = await Promise.all([
        apiFetch('/api/outlets'),
        apiFetch('/api/access-requests?status=pending'),
      ]);

      if (outRes.ok) setOutlets(await outRes.json());
      if (reqRes.ok) setAccessRequests(await reqRes.json());
    } catch (err) {
      console.error('Error fetching access requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isSuperAdmin]);

  const openApprove = (req: AccessRequest) => {
    setApprovingRequest(req);
    setApproveForm({
      password: '',
      userRole: 'user',
      outletId: '',
      displayName: req.fullName || '',
    });
    setIsApproveModalOpen(true);
  };

  const generatePassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#';
    let out = '';
    for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    setApproveForm((s) => ({ ...s, password: out }));
  };

  const copyCredentials = async () => {
    if (!approvingRequest) return;
    const email = approvingRequest.email;
    const password = approveForm.password;
    if (!email || !password) return;
    const msg = `Your LiquorLedger access request is approved.\n\nEmail: ${email}\nPassword: ${password}\n\nLogin: ${window.location.origin}/?login=1`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopyNotice('Copied login details to clipboard.');
      window.setTimeout(() => setCopyNotice(null), 2500);
    } catch {
      setCopyNotice('Copy failed. Please select and copy manually.');
      window.setTimeout(() => setCopyNotice(null), 2500);
    }
  };

  const openWhatsApp = () => {
    if (!approvingRequest) return;
    const email = approvingRequest.email;
    const password = approveForm.password;
    if (!email || !password) return;

    let phone = String(approvingRequest.phone || '').trim();
    phone = phone.replace(/[^\d]/g, '');
    if (phone.startsWith('00')) phone = phone.slice(2);
    if (!phone) return;

    const msg = `Your LiquorLedger access request is approved.\n\nEmail: ${email}\nPassword: ${password}\n\nLogin: ${window.location.origin}/?login=1`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const approveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingRequest) return;
    try {
      await apiFetch(`/api/access-requests/${approvingRequest._id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          password: approveForm.password,
          userRole: approveForm.userRole,
          outletId: approveForm.outletId,
          displayName: approveForm.displayName,
        }),
      });
      setIsApproveModalOpen(false);
      setApprovingRequest(null);
      fetchData();
    } catch (err) {
      console.error('Error approving request:', err);
    }
  };

  const rejectRequest = async (req: AccessRequest) => {
    if (!window.confirm(`Reject access request for ${req.email}?`)) return;
    try {
      await apiFetch(`/api/access-requests/${req._id}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      fetchData();
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="app-h1">Access Requests</h1>
          <p className="app-subtitle">Review and approve new user access requests.</p>
        </div>
      </header>

      <div className="app-card">
        <div className="app-card-header">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">New user approvals</p>
            <p className="text-lg font-black">Pending requests</p>
          </div>
          <span className="text-xs font-black text-[color:var(--app-muted)]">Pending: {accessRequests.length}</span>
        </div>
        <div className="p-6">
          {requestsLoading ? (
            <p className="text-sm font-bold text-gray-500">Loading requests...</p>
          ) : accessRequests.length === 0 ? (
            <p className="text-sm font-bold text-gray-500">No pending access requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Requester</th>
                    <th>Business</th>
                    <th>Country</th>
                    <th>Contact</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accessRequests.map((req) => (
                    <tr key={req._id} className="group">
                      <td>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{req.fullName}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail size={12} /> {req.email}
                          </p>
                        </div>
                      </td>
                      <td>
                        <p className="text-sm font-semibold text-gray-700">{req.businessName}</p>
                        {req.message ? <p className="text-xs text-gray-400 line-clamp-1">{req.message}</p> : null}
                      </td>
                      <td>
                        <span className="text-sm font-semibold text-gray-700">{req.country}</span>
                      </td>
                      <td>
                        <span className="text-sm font-semibold text-gray-700">{req.phone}</span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <button onClick={() => openApprove(req)} className="app-btn-primary px-3 py-2 text-sm">
                            Approve
                          </button>
                          <button onClick={() => rejectRequest(req)} className="app-btn-secondary px-3 py-2 text-sm">
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isApproveModalOpen && approvingRequest && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsApproveModalOpen(false)}
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
                  <h2 className="text-2xl font-bold text-gray-900">Approve access request</h2>
                  <button
                    onClick={() => setIsApproveModalOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="mb-6 p-4 bg-blue-50 rounded-2xl">
                  <p className="text-sm font-bold text-gray-900">{approvingRequest.fullName}</p>
                  <p className="text-sm text-gray-600">{approvingRequest.email}</p>
                  <p className="text-sm text-gray-600">
                    {approvingRequest.phone} • {approvingRequest.country}
                  </p>
                  <p className="text-sm text-gray-600">{approvingRequest.businessName}</p>
                </div>

                <form onSubmit={approveRequest} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Display Name</label>
                    <input
                      className="app-input"
                      value={approveForm.displayName}
                      onChange={(e) => setApproveForm((s) => ({ ...s, displayName: e.target.value }))}
                      placeholder="User display name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Password (share with user)</label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        className="app-input flex-1"
                        value={approveForm.password}
                        onChange={(e) => setApproveForm((s) => ({ ...s, password: e.target.value }))}
                        placeholder="Set a password"
                      />
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="app-btn-secondary px-4 py-3 text-sm shrink-0 whitespace-nowrap"
                      >
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={copyCredentials}
                        disabled={!approveForm.password}
                        className="app-btn-secondary px-4 py-3 text-sm shrink-0 whitespace-nowrap disabled:opacity-60"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={openWhatsApp}
                        disabled={!approveForm.password}
                        className="app-btn-secondary px-4 py-3 text-sm shrink-0 whitespace-nowrap disabled:opacity-60"
                      >
                        WhatsApp
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">User can login only after approval.</p>
                    {copyNotice ? <p className="text-xs font-bold text-[color:var(--app-muted)]">{copyNotice}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">System Role</label>
                    <div className="grid grid-cols-2 gap-3">
                      {availableRoles.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setApproveForm((s) => ({ ...s, userRole: role }))}
                          className={cn(
                            'px-4 py-3 rounded-xl text-sm font-bold transition-all border-2',
                            approveForm.userRole === role
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                              : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
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
                      className="app-select w-full"
                      value={approveForm.outletId}
                      onChange={(e) => setApproveForm((s) => ({ ...s, outletId: e.target.value }))}
                    >
                      <option value="">No Outlet Assignment</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2 flex gap-4">
                    <button
                      type="button"
                      onClick={() => setIsApproveModalOpen(false)}
                      className="flex-1 app-btn-secondary-lg text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 app-btn-primary-lg text-sm flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={20} />
                      Approve & Create User
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

export default AccessRequests;

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
