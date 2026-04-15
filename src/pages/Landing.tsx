import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronRight,
  FileBarChart2,
  Lock,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import LoginPanel from '../components/LoginPanel';

type NavItem = { label: string; href: string };
type ScreenshotId = 'dashboard' | 'inventory' | 'sales' | 'outlet' | 'users';

const Landing: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const loginRequested = searchParams.get('login') === '1';
  const [loginOpen, setLoginOpen] = useState(loginRequested);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessSuccess, setAccessSuccess] = useState<string | null>(null);
  const [screenshotOpen, setScreenshotOpen] = useState<null | ScreenshotId>(null);
  const [activePreview, setActivePreview] = useState<ScreenshotId>('dashboard');
  const [accessForm, setAccessForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
    businessName: '',
    message: '',
  });

  const [statusForm, setStatusForm] = useState({ email: '', phone: '' });
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<any | null>(null);

  const screenshots = useMemo(
    () => [
      {
        id: 'dashboard' as const,
        title: 'Dashboard preview',
        src: '/dashboard.png',
      },
      {
        id: 'inventory' as const,
        title: 'Inventory preview',
        src: '/inventory.png',
      },
      {
        id: 'sales' as const,
        title: 'Sales preview',
        src: '/sales.png',
      },
      {
        id: 'outlet' as const,
        title: 'Outlets preview',
        src: '/outlet.png',
      },
      {
        id: 'users' as const,
        title: 'Users preview',
        src: '/user_management.png',
      },
    ],
    [],
  );

  const navItems: NavItem[] = useMemo(
    () => [
      { label: 'Features', href: '#features' },
      { label: 'Modules', href: '#modules' },
      { label: 'Security', href: '#security' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Contact', href: '#contact' },
    ],
    [],
  );

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('access_request_last');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.email === 'string' && typeof parsed.phone === 'string') {
        setStatusForm({ email: parsed.email, phone: parsed.phone });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setLoginOpen(loginRequested);
  }, [loginRequested]);

  useEffect(() => {
    if (user && loginRequested) {
      const from = (location.state as any)?.from;
      if (from?.pathname) {
        navigate(`${from.pathname}${from.search || ''}`, { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    }
  }, [user, loginRequested, navigate, location.state, location.hash]);

  const openLogin = () => {
    setLoginOpen(true);
    closeMobile();
    navigate({ pathname: '/', search: '?login=1', hash: location.hash }, { replace: true, state: location.state });
  };

  const closeLogin = () => {
    setLoginOpen(false);
    navigate({ pathname: '/', search: '', hash: location.hash }, { replace: true, state: location.state });
  };

  const openAccessModal = () => setAccessModalOpen(true);
  const closeAccessModal = () => setAccessModalOpen(false);
  const closeScreenshot = () => setScreenshotOpen(null);

  const submitAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessSubmitting(true);
    setAccessError(null);
    setAccessSuccess(null);
    try {
      const submittedEmail = accessForm.email;
      const submittedPhone = accessForm.phone;
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: accessForm.fullName,
          email: accessForm.email,
          phone: accessForm.phone,
          country: accessForm.country,
          businessName: accessForm.businessName,
          message: accessForm.message || undefined,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null;

      if (!res.ok) {
        setAccessError(data?.message || `Request failed (${res.status})`);
        return;
      }

      setAccessSuccess('Request sent to Super Admin. After approval, you can login.');
      closeAccessModal();
      setStatusForm({ email: submittedEmail, phone: submittedPhone });
      try {
        localStorage.setItem('access_request_last', JSON.stringify({ email: submittedEmail, phone: submittedPhone }));
      } catch {
        // ignore
      }
      setAccessForm({ fullName: '', email: '', phone: '', country: '', businessName: '', message: '' });
    } catch (err: any) {
      console.error('Access request error:', err);
      setAccessError(err?.message ? `Connection failed: ${err.message}` : 'Connection failed. Please try again.');
    } finally {
      setAccessSubmitting(false);
    }
  };

  const checkAccessStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusLoading(true);
    setStatusError(null);
    setStatusResult(null);
    try {
      const email = statusForm.email.trim();
      const phone = statusForm.phone.trim();
      const qs = new URLSearchParams({ email, phone });
      const res = await fetch(`/api/access-requests/status?${qs.toString()}`);

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null;
      if (!res.ok) {
        setStatusError(data?.message || `Request failed (${res.status})`);
        return;
      }
      setStatusResult(data);
      try {
        localStorage.setItem('access_request_last', JSON.stringify({ email, phone }));
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.error('Access status error:', err);
      setStatusError(err?.message ? `Connection failed: ${err.message}` : 'Connection failed. Please try again.');
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div id="top" className="min-h-screen overflow-x-hidden text-[color:var(--app-fg)]">
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[color:var(--app-accent)]/10 blur-[90px]" />
        <div className="absolute top-28 -left-24 h-[380px] w-[380px] rounded-full bg-fuchsia-500/10 blur-[90px]" />
        <div className="absolute bottom-0 right-0 h-[520px] w-[520px] rounded-full bg-blue-500/10 blur-[110px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[color:var(--app-surface-bg)]/70 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-12 2xl:px-20">
          <Link to="/" className="flex items-center gap-2 font-black tracking-tight">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft-2)] text-[color:var(--app-accent)]">
              LL
            </span>
            <span className="leading-none">
              <span className="block text-[15px] sm:text-base">LiquorLedger</span>
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                Inventory & Sales Pro
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((it) => (
              <a
                key={it.href}
                href={it.href}
                className="rounded-xl px-3 py-2 text-sm font-bold text-[color:var(--app-muted)] transition-colors hover:bg-white/5 hover:text-[color:var(--app-fg)]"
              >
                {it.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="app-btn-icon"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {user ? (
              <Link
                to="/app"
                className="hidden sm:inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--app-accent)] px-4 py-2 text-sm font-black text-[color:var(--app-accent-contrast)] shadow-[0_12px_30px_var(--app-accent-soft-2)] transition-colors hover:bg-[color:var(--app-accent-hover)]"
              >
                Open Dashboard
                <ArrowUpRight size={16} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={openLogin}
                className="hidden sm:inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--app-accent)] px-4 py-2 text-sm font-black text-[color:var(--app-accent-contrast)] shadow-[0_12px_30px_var(--app-accent-soft-2)] transition-colors hover:bg-[color:var(--app-accent-hover)]"
              >
                Login
                <ArrowUpRight size={16} />
              </button>
            )}

            <button
              type="button"
              className="md:hidden app-btn-icon"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="md:hidden border-t border-white/10 bg-[color:var(--app-surface-bg)]/90 backdrop-blur-xl"
            >
              <div className="w-full px-4 py-3 sm:px-6 lg:px-12 2xl:px-20">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                    Menu
                  </p>
                  <button type="button" className="app-btn-icon" onClick={closeMobile} aria-label="Close menu">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-1">
                  {navItems.map((it) => (
                    <a
                      key={it.href}
                      href={it.href}
                      onClick={closeMobile}
                      className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-bold text-[color:var(--app-fg)] hover:bg-white/5"
                    >
                      {it.label}
                      <ChevronRight size={16} className="opacity-70" />
                    </a>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {user ? (
                    <Link to="/app" onClick={closeMobile} className="app-btn-primary-lg">
                      Open Dashboard
                      <ArrowRight size={18} />
                    </Link>
                  ) : (
                    <button type="button" onClick={openLogin} className="app-btn-primary-lg">
                      Login
                      <ArrowRight size={18} />
                    </button>
                  )}
                  <a href="#features" onClick={closeMobile} className="app-btn-secondary-lg">
                    Explore features
                    <Sparkles size={18} />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {loginOpen && !user && (
          <motion.div
            key="login-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
            onClick={closeLogin}
            role="dialog"
            aria-modal="true"
            aria-label="Login"
          >
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="relative w-full max-w-md max-h-[95dvh] overflow-y-auto no-scrollbar"
                onClick={(e) => e.stopPropagation()}
              >
              <button
                type="button"
                onClick={closeLogin}
                className="absolute top-3 right-3 app-btn-icon bg-[color:var(--app-surface-bg)] shadow-lg"
                aria-label="Close login"
                title="Close"
              >
                <X size={18} />
              </button>
              <LoginPanel />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {accessModalOpen && (
          <motion.div
            key="access-request-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
            onClick={closeAccessModal}
            role="dialog"
            aria-modal="true"
            aria-label="Request access"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative w-full max-w-2xl max-h-[90dvh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeAccessModal}
                className="absolute top-3 right-3 app-btn-icon bg-[color:var(--app-surface-bg)] shadow-lg"
                aria-label="Close request access"
                title="Close"
              >
                <X size={18} />
              </button>

              <div className="app-card overflow-y-auto max-h-[90dvh]">
                <div className="app-card-header">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">New account</p>
                    <p className="text-lg font-black">Request access</p>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-[color:var(--app-muted)]">
                      Super Admin approval is required before you can login.
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  <form onSubmit={submitAccessRequest} className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                        Full name *
                      </label>
                      <input
                        required
                        className="app-input"
                        value={accessForm.fullName}
                        onChange={(e) => setAccessForm((s) => ({ ...s, fullName: e.target.value }))}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                        Contact number *
                      </label>
                      <input
                        required
                        className="app-input"
                        value={accessForm.phone}
                        onChange={(e) => setAccessForm((s) => ({ ...s, phone: e.target.value }))}
                        placeholder="Phone / WhatsApp"
                        inputMode="tel"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                        Email *
                      </label>
                      <input
                        required
                        type="email"
                        className="app-input"
                        value={accessForm.email}
                        onChange={(e) => setAccessForm((s) => ({ ...s, email: e.target.value }))}
                        placeholder="name@company.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                        Country *
                      </label>
                      <input
                        required
                        className="app-input"
                        value={accessForm.country}
                        onChange={(e) => setAccessForm((s) => ({ ...s, country: e.target.value }))}
                        placeholder="India"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                        Business / shop name *
                      </label>
                      <input
                        required
                        className="app-input"
                        value={accessForm.businessName}
                        onChange={(e) => setAccessForm((s) => ({ ...s, businessName: e.target.value }))}
                        placeholder="Your business name"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                        Requirements (optional)
                      </label>
                      <textarea
                        className="app-input min-h-[96px] py-3"
                        value={accessForm.message}
                        onChange={(e) => setAccessForm((s) => ({ ...s, message: e.target.value }))}
                        placeholder="e.g., number of outlets, barcode, GST invoice, etc."
                      />
                    </div>

                    {accessError && (
                      <div className="sm:col-span-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-600">
                        {accessError}
                      </div>
                    )}
                    {accessSuccess && (
                      <div className="sm:col-span-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-600">
                        {accessSuccess}
                      </div>
                    )}

                    <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-bold text-[color:var(--app-muted)]">
                        Super Admin: <span className="text-[color:var(--app-fg)]">Requin Solution Pvt Ltd</span>
                      </p>
                      <button type="submit" disabled={accessSubmitting} className="app-btn-primary-lg disabled:opacity-60">
                        {accessSubmitting ? 'Sending...' : 'Request Access'}
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!!screenshotOpen && (
          <motion.div
            key="screenshot-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
            onClick={closeScreenshot}
            role="dialog"
            aria-modal="true"
            aria-label="Screenshot preview"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative w-full max-w-6xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeScreenshot}
                className="absolute top-3 right-3 app-btn-icon bg-[color:var(--app-surface-bg)] shadow-lg"
                aria-label="Close preview"
                title="Close"
              >
                <X size={18} />
              </button>

              <div className="app-card overflow-hidden">
                <div className="app-card-header">
                  <p className="text-sm font-black">
                    {screenshots.find((s) => s.id === screenshotOpen)?.title || 'Preview'}
                  </p>
                  <span className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                    Click outside to close
                  </span>
                </div>
                <div className="p-4 sm:p-6">
                  <img
                    className="w-full max-h-[75dvh] object-contain rounded-3xl border border-white/10 bg-black/20"
                    src={screenshots.find((s) => s.id === screenshotOpen)?.src}
                    alt={screenshots.find((s) => s.id === screenshotOpen)?.title || 'Preview'}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* Hero */}
        <section className="relative border-b border-white/10">
          <div className="grid min-h-[calc(100dvh-64px)] w-full items-center gap-10 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-2 lg:gap-14 lg:px-12 2xl:px-20">
            <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                  <ShieldCheck size={16} className="text-[color:var(--app-accent)]" />
                Role-based access • Multi-outlet • Fast setup
                </div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 text-4xl font-black tracking-tight sm:text-5xl"
              >
                Run your liquor shop operations{' '}
                <span className="bg-gradient-to-r from-[color:var(--app-accent)] to-fuchsia-400 bg-clip-text text-transparent">
                  faster
                </span>
                .
              </motion.h1>

              <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-[color:var(--app-muted)]">
                LiquorLedger is an inventory & sales management tool with products, per-outlet stock tracking, low-stock
                alerts, secure sales transactions, and stock transfers between outlets.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                {user ? (
                  <Link to="/app" className="app-btn-primary">
                    Open Dashboard
                    <ArrowRight size={18} />
                  </Link>
                ) : (
                  <button type="button" onClick={openLogin} className="app-btn-primary">
                    Login
                    <ArrowRight size={18} />
                  </button>
                )}
                <a href="#modules" className="app-btn-secondary">
                  See modules
                  <ChevronRight size={18} />
                </a>
              </div>

              {!user && (
                <p className="mt-3 text-xs font-bold text-[color:var(--app-muted)]">
                  For new account creation, contact admin: <span className="text-[color:var(--app-fg)]">Requin Solution Pvt Ltd</span>
                </p>
              )}

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { k: 'Roles', v: 'super_admin → terminal' },
                  { k: 'Outlets', v: 'multi-branch ready' },
                  { k: 'Sales', v: 'inventory-safe updates' },
                ].map((s) => (
                  <div key={s.k} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                      {s.k}
                    </p>
                    <p className="mt-1 text-sm font-extrabold">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="app-card lg:justify-self-end lg:max-w-[720px] w-full"
            >
              <div className="app-card-header">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                    What you get
                  </p>
                  <p className="text-lg font-black">All-in-one dashboard</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black">
                  <Lock size={16} className="text-[color:var(--app-accent)]" />
                  Secure access
                </span>
              </div>

              <div className="p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: Boxes, title: 'Products', desc: 'Create and manage your catalog.' },
                    { icon: Store, title: 'Inventory', desc: 'Track stock by outlet with alerts.' },
                    { icon: BarChart3, title: 'Sales', desc: 'Record sales and decrement stock safely.' },
                    { icon: FileBarChart2, title: 'Reports', desc: 'Transaction history and summaries.' },
                    { icon: Users, title: 'Users & Roles', desc: 'Fine-grained access control.' },
                    { icon: ShieldCheck, title: 'Transfers', desc: 'Move stock between outlets.' },
                  ].map((c) => (
                    <div key={c.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft-2)] text-[color:var(--app-accent)]">
                          <c.icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black">{c.title}</p>
                          <p className="text-sm text-[color:var(--app-muted)]">{c.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black">Designed for fast counter work</p>
                      <p className="text-xs font-bold text-[color:var(--app-muted)]">Responsive, keyboard-friendly UI</p>
                    </div>
                  </div>
                  <a
                    href="#features"
                    className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black text-[color:var(--app-fg)] hover:bg-white/5"
                  >
                    Explore
                    <ChevronRight size={16} />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Full-width feature strip */}
          <div className="border-t border-white/10 bg-white/5">
            <div className="w-full px-4 py-4 sm:px-6 lg:px-12 2xl:px-20">
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                {[
                  'Inventory Tracking',
                  'Low-Stock Alerts',
                  'Sales & Receipts',
                  'Transactions',
                  'Stock Transfers',
                  'Multi-Outlet',
                  'Users & Roles',
                  'Secure Login',
                ].map((t) => (
                  <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 border-t border-white/10">
          <div className="w-full px-4 py-14 sm:px-6 lg:px-12 2xl:px-20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                  Features
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Everything you need to manage stock & sales</h2>
              </div>
              <a href="#contact" className="inline-flex items-center gap-2 text-sm font-black text-[color:var(--app-accent)]">
                Request setup help <ArrowUpRight size={16} />
              </a>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Users,
                  title: 'Role-based access',
                  desc: 'Super admins, admins, managers, users, and terminals — each with the right permissions.',
                },
                {
                  icon: Store,
                  title: 'Multi-outlet management',
                  desc: 'Create and manage outlets. See stock and sales per location.',
                },
                {
                  icon: Boxes,
                  title: 'Products catalog',
                  desc: 'CRUD for products and a clean, searchable inventory view.',
                },
                {
                  icon: BarChart3,
                  title: 'Sales that update inventory',
                  desc: 'Sales reduce inventory with database-safe operations to prevent drift.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Stock transfers',
                  desc: 'Move stock between outlets with status workflows (pending → completed/cancelled).',
                },
                {
                  icon: Lock,
                  title: 'Secure login',
                  desc: 'Protected access to the dashboard and sensitive actions.',
                },
              ].map((f, idx) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ delay: idx * 0.03 }}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft-2)] text-[color:var(--app-accent)]">
                    <f.icon size={20} />
                  </div>
                  <p className="mt-4 text-base font-black">{f.title}</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[color:var(--app-muted)]">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Modules */}
        <section id="modules" className="scroll-mt-24 border-t border-white/10">
          <div className="w-full px-4 py-14 sm:px-6 lg:px-12 2xl:px-20">
            <div className="grid gap-10 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">Modules</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">A clear workflow from stock → sale → report</h2>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-[color:var(--app-muted)]">
                  Each screen is built to be practical: quick filters, readable tables, and consistent actions so staff
                  can work faster with fewer mistakes.
                </p>

                <div className="mt-6 space-y-3">
                  {[
                    'Dashboard with low-stock highlights',
                    'Inventory per outlet with adjustments',
                    'Sales entry and transaction history',
                    'Stock transfers between outlets',
                    'Outlet setup (admins) and user management',
                  ].map((t) => (
                    <div key={t} className="flex items-start gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                      <CheckCircle2 size={18} className="mt-0.5 text-emerald-400" />
                      <p className="text-sm font-bold">{t}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2 lg:col-span-2">
                <div className="app-card">
                  <div className="app-card-header">
                    <p className="text-sm font-black">Typical flow</p>
                    <span className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                      3 steps
                    </span>
                  </div>
                  <div className="p-6">
                    <ol className="space-y-4">
                      {[
                        {
                          n: '01',
                          title: 'Set up outlets & roles',
                          desc: 'Admins create outlets and users; managers operate assigned outlets.',
                        },
                        {
                          n: '02',
                          title: 'Maintain products & stock',
                          desc: 'Add products and update inventory by outlet. Catch low stock early.',
                        },
                        {
                          n: '03',
                          title: 'Record sales & review reports',
                          desc: 'Sales decrement inventory safely. Review transactions anytime.',
                        },
                      ].map((s) => (
                        <li key={s.n} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                          <div className="flex items-start gap-4">
                            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-sm font-black">
                              {s.n}
                            </div>
                            <div className="min-w-0">
                              <p className="text-base font-black">{s.title}</p>
                              <p className="mt-1 text-sm font-semibold leading-relaxed text-[color:var(--app-muted)]">
                                {s.desc}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          icon: ShieldCheck,
                          title: 'Role control',
                          desc: 'Clear access by role.',
                        },
                        {
                          icon: Store,
                          title: 'Multi-outlet',
                          desc: 'Track stock per outlet.',
                        },
                        {
                          icon: BarChart3,
                          title: 'Sales insights',
                          desc: 'Reports that update fast.',
                        },
                      ].map((c) => (
                        <div key={c.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-start gap-3">
                            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft-2)] text-[color:var(--app-accent)]">
                              <c.icon size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black">{c.title}</p>
                              <p className="mt-1 text-xs font-semibold text-[color:var(--app-muted)]">{c.desc}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                  <div className="app-card">
                    <div className="app-card-header">
                      <p className="text-sm font-black">App previews</p>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {screenshots.map((shot) => (
                          <button
                            key={shot.id}
                            type="button"
                            onClick={() => setActivePreview(shot.id)}
                            className={[
                              'rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] transition',
                              activePreview === shot.id
                                ? 'bg-[color:var(--app-accent)] text-[color:var(--app-accent-contrast)] shadow'
                                : 'border border-white/10 bg-white/5 text-[color:var(--app-muted)] hover:bg-white/10',
                            ].join(' ')}
                          >
                            {shot.title.replace(' preview', '')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-6">
                    <button
                      type="button"
                      onClick={() => setScreenshotOpen(activePreview)}
                      className="group block w-full text-left"
                      title="Open preview"
                    >
                      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 aspect-[16/9]">
                        <div className="absolute inset-0 p-3 sm:p-4">
                          <img
                            src={screenshots.find((s) => s.id === activePreview)?.src}
                            alt={screenshots.find((s) => s.id === activePreview)?.title || 'Preview'}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-contain object-center opacity-95 transition group-hover:opacity-100"
                          />
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-4">
                          <p className="text-sm font-black">
                            {screenshots.find((s) => s.id === activePreview)?.title || 'Preview'}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black">
                            Zoom <ArrowUpRight size={14} />
                          </span>
                        </div>
                      </div>
                    </button>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {screenshots.map((shot) => (
                          <button
                            key={shot.id}
                            type="button"
                            onClick={() => setActivePreview(shot.id)}
                            className={[
                              'group relative overflow-hidden rounded-3xl border bg-white/5 text-left transition',
                              activePreview === shot.id ? 'border-white/30' : 'border-white/10 hover:border-white/20',
                            ].join(' ')}
                            title="Switch preview"
                          >
                            <img
                              src={shot.src}
                              alt={shot.title}
                              loading="lazy"
                              decoding="async"
                              className="h-24 w-full object-cover opacity-90 transition group-hover:opacity-100"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                              <p className="text-xs font-black">{shot.title}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-24 border-t border-white/10">
          <div className="w-full px-4 py-14 sm:px-6 lg:px-12 2xl:px-20">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">Security</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Protected screens and clean permissions</h2>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-[color:var(--app-muted)]">
                  Secure login and protected screens. Roles help keep sensitive actions limited to the right users.
                </p>
              </div>

              <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: Lock,
                    title: 'Secure login',
                    desc: 'Sign in to access the dashboard and protected screens.',
                  },
                  {
                    icon: Users,
                    title: 'Role-based access',
                    desc: 'Admins manage outlets and users. Managers handle stock transfers.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Guarded UI routes',
                    desc: 'Unauthorized users are redirected away from restricted pages.',
                  },
                  {
                    icon: Sparkles,
                    title: 'Optional AI hook',
                    desc: 'Gemini API key is optional — ready when you decide to add AI features.',
                  },
                ].map((c) => (
                  <div key={c.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft-2)] text-[color:var(--app-accent)]">
                        <c.icon size={20} />
                      </div>
                      <p className="text-base font-black">{c.title}</p>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-[color:var(--app-muted)]">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 border-t border-white/10">
          <div className="w-full px-4 py-14 sm:px-6 lg:px-12 2xl:px-20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">FAQ</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Quick answers</h2>
              </div>
              <a href="#contact" className="text-sm font-black text-[color:var(--app-accent)]">
                Still have questions?
              </a>
            </div>

            <div className="mt-8 grid gap-3">
              {[
                {
                  q: 'Does it support multiple outlets/branches?',
                  a: 'Yes. Outlets can be created and managed, and stock/sales can be viewed per outlet.',
                },
                {
                  q: 'How does it prevent inventory mismatch after sales?',
                  a: 'Sales are designed to decrement inventory in a database-safe operation to reduce drift and keep counts accurate.',
                },
                {
                  q: 'What roles are supported?',
                  a: 'Roles include super_admin, admin, manager, user, and terminal — each with permissions for relevant screens.',
                },
                {
                  q: 'Is setup required?',
                  a: 'Yes. A Super Admin approves new requests and shares login credentials.',
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-3xl border border-white/10 bg-white/5 p-5 open:bg-white/10"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <span className="text-sm font-black">{item.q}</span>
                    <ChevronRight className="h-5 w-5 shrink-0 opacity-70 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-[color:var(--app-muted)]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Contact / Footer */}
        <section id="contact" className="scroll-mt-24 border-t border-white/10">
          <div className="w-full px-4 py-14 sm:px-6 lg:px-12 2xl:px-20">
            <div className="app-card">
              <div className="app-card-header">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                    Get started
                  </p>
                  <p className="text-lg font-black">Launch your setup</p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black">
                  <Sparkles size={16} className="text-[color:var(--app-accent)]" />
                  Clean, scrollable landing
                </span>
              </div>
              <div className="p-6">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-black">Request access</p>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-[color:var(--app-muted)]">
                      New user? Fill this form. Super Admin approval is required before you can login.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <button type="button" onClick={openAccessModal} className="app-btn-primary-lg sm:col-span-2">
                        Request Access
                        <ArrowRight size={18} />
                      </button>
                      {accessError && (
                        <div className="sm:col-span-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-600">
                          {accessError}
                        </div>
                      )}
                      {accessSuccess && (
                        <div className="sm:col-span-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-600">
                          {accessSuccess}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
                      <p className="text-sm font-black">Check request status</p>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-[color:var(--app-muted)]">
                        Use the same email and phone number you submitted.
                      </p>
                      <form onSubmit={checkAccessStatus} className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                            Email
                          </label>
                          <input
                            required
                            type="email"
                            className="app-input"
                            value={statusForm.email}
                            onChange={(e) => setStatusForm((s) => ({ ...s, email: e.target.value }))}
                            placeholder="name@company.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                            Phone
                          </label>
                          <input
                            required
                            className="app-input"
                            value={statusForm.phone}
                            onChange={(e) => setStatusForm((s) => ({ ...s, phone: e.target.value }))}
                            placeholder="Phone / WhatsApp"
                            inputMode="tel"
                          />
                        </div>

                        {statusError && (
                          <div className="sm:col-span-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-600">
                            {statusError}
                          </div>
                        )}
                        {statusResult && (
                          <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                              Status
                            </p>
                            <p className="mt-1 text-sm font-black">
                              {String(statusResult.status || '').toUpperCase() || 'UNKNOWN'}
                            </p>
                            {statusResult.status === 'pending' ? (
                              <p className="mt-2 text-sm font-semibold text-[color:var(--app-muted)]">
                                Your request is waiting for Super Admin approval.
                              </p>
                            ) : statusResult.status === 'approved' ? (
                              <p className="mt-2 text-sm font-semibold text-[color:var(--app-muted)]">
                                Your request is approved. Super Admin will share your login credentials (usually via WhatsApp/SMS). Then use the Login button.
                              </p>
                            ) : statusResult.status === 'rejected' ? (
                              <p className="mt-2 text-sm font-semibold text-[color:var(--app-muted)]">
                                Your request was rejected{statusResult.rejectionReason ? `: ${statusResult.rejectionReason}` : '.'}
                              </p>
                            ) : null}
                            {statusResult.supportContact?.phone || statusResult.supportContact?.email ? (
                              <p className="mt-3 text-xs font-bold text-[color:var(--app-muted)]">
                                Support:{' '}
                                <span className="text-[color:var(--app-fg)]">
                                  {statusResult.supportContact?.phone ? `${statusResult.supportContact.phone} ` : ''}
                                  {statusResult.supportContact?.email ? statusResult.supportContact.email : ''}
                                </span>
                              </p>
                            ) : null}
                          </div>
                        )}

                        <div className="sm:col-span-2 flex items-center justify-end">
                          <button
                            type="submit"
                            disabled={statusLoading}
                            className="app-btn-secondary px-6 py-3 text-sm disabled:opacity-60"
                          >
                            {statusLoading ? 'Checking...' : 'Check Status'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-black">Open the app</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                      Admin access
                    </p>
                    <div className="mt-4 grid gap-2">
                      {user ? (
                        <Link to="/app" className="app-btn-primary-lg">
                          Open Dashboard
                          <ArrowRight size={18} />
                        </Link>
                      ) : (
                        <button type="button" onClick={openLogin} className="app-btn-primary-lg">
                          Login
                          <ArrowRight size={18} />
                        </button>
                      )}
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold leading-relaxed text-[color:var(--app-muted)]">
                        For new account creation, contact admin:{' '}
                        <span className="font-black text-[color:var(--app-fg)]">Requin Solution Pvt Ltd</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer border-t border-white/10">
        <div className="landing-footer-accent" aria-hidden="true" />
        <div className="w-full px-4 py-12 sm:px-6 lg:px-12 2xl:px-20">
          <div className="landing-footer-surface rounded-3xl border border-white/10 p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <p className="text-lg font-black tracking-tight">LiquorLedger</p>
                <p className="mt-2 text-sm font-semibold text-[color:var(--app-muted)]">
                  A clean, role-based system for managing inventory, sales, and multi-outlet operations.
                </p>
                <p className="mt-4 text-sm font-semibold text-[color:var(--app-muted)]">
                  Powered by <span className="text-[color:var(--app-fg)] font-black">Requin Solution Pvt Ltd</span>
                </p>
              </div>

              <div className="lg:col-span-7 grid gap-8 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">Quick links</p>
                  <nav className="mt-3 grid gap-2 text-sm font-bold text-[color:var(--app-muted)]">
                    <a href="#features" className="landing-footer-link">
                      Features
                    </a>
                    <a href="#modules" className="landing-footer-link">
                      Modules
                    </a>
                    <a href="#security" className="landing-footer-link">
                      Security
                    </a>
                    <a href="#faq" className="landing-footer-link">
                      FAQ
                    </a>
                    <a href="#contact" className="landing-footer-link">
                      Contact
                    </a>
                  </nav>
                </div>

                <div className="footer-links">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">Company</p>
                  <div className="mt-3 grid gap-2 text-sm font-bold text-[color:var(--app-muted)]">
                    <a
                      href="https://www.requingroup.com/#about"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="landing-footer-link"
                    >
                      About Us
                    </a>
                    <a
                      href="https://www.requingroup.com/contact"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="landing-footer-link"
                    >
                      Contact
                    </a>
                    <a
                      href="https://www.requingroup.com/ourproduct"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="landing-footer-link"
                    >
                      Our Product
                    </a>
                    <a
                      href="https://www.requingroup.com/termsandconditions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="landing-footer-link"
                    >
                      Privacy Policy
                    </a>
                    <a
                      href="https://www.requingroup.com/termsandconditions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="landing-footer-link"
                    >
                      Terms
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                © {new Date().getFullYear()} Requin Solution Pvt Ltd. All rights reserved.
              </p>
              <a href="#top" className="inline-flex items-center gap-2 text-sm font-black text-[color:var(--app-accent)]">
                Back to top <ChevronRight size={16} className="-rotate-90" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

