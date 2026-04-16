import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Lock, Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';

const LoginPanel: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      let data: any = null;
      try {
        const contentType = response.headers.get('content-type') || '';
        data = contentType.includes('application/json') ? await response.json() : { message: await response.text() };
      } catch {
        data = null;
      }

      if (response.ok) {
        login(data.token, data.user);
        const from = (location.state as any)?.from?.pathname || '/app';
        navigate(from, { replace: true });
      } else {
        setError(data?.message || `Request failed (${response.status})`);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err?.message ? `Connection failed: ${err.message}` : 'Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full app-card shadow-2xl overflow-hidden"
    >
      <div className="p-6 text-center bg-gradient-to-br from-blue-500 to-blue-600 text-white relative overflow-hidden">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"
        />
        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm relative z-10">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-xl font-bold tracking-tight relative z-10 flex items-center justify-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-2xl bg-white/15 backdrop-blur-sm font-black">
            L
          </span>
          <span>LiquorLedger</span>
          <span aria-hidden="true" className="text-white/90 text-lg leading-none">
            ◆
          </span>
        </h1>
        <p className="text-blue-100 text-xs mt-1 relative z-10">Secure Enterprise Management (MongoDB)</p>
      </div>

      <div className="p-6">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold">Welcome Back</h2>
            <p className="text-sm mt-1 app-muted">Enter your credentials to continue</p>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6 p-4 border text-sm rounded-xl flex items-center gap-2 bg-red-500/10 border-red-500/20 text-red-600"
          >
            <div className="w-1 h-1 rounded-full shrink-0 bg-red-500" />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold app-muted ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 app-muted" size={18} />
              <input
                required
                type="email"
                placeholder="name@company.com"
                className="app-input pl-12 pr-4 py-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold app-muted ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 app-muted" size={18} />
              <input
                required
                type="password"
                placeholder="••••••••"
                className="app-input pl-12 pr-4 py-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="app-btn-primary-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={20} />
                <span>Login to Dashboard</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] font-black app-muted">Account Access</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-[color:var(--app-muted)]">
            For new account creation, contact Super Admin:{' '}
            <span className="font-black text-[color:var(--app-fg)]">Requin Solution Pvt Ltd</span>
          </p>
        </div>

        <div className="mt-6 pt-6 border-t app-divider text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] font-black app-muted">Enterprise Grade Security</p>
        </div>
      </div>
    </motion.div>
  );
};

export default LoginPanel;
