import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Store, 
  Users, 
  ArrowLeftRight, 
  LogOut, 
  Menu, 
  X,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Layout: React.FC = () => {
  const { profile, isAdmin, isSuperAdmin, isManager, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [managerOutletLabel, setManagerOutletLabel] = useState<string>('');
  const navigate = useNavigate();

  const handleLogout = async () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, show: true },
    { name: 'Inventory', path: '/inventory', icon: Package, show: true },
    { name: 'Sales', path: '/sales', icon: ShoppingCart, show: true },
    { name: 'Stock Transfer', path: '/transfers', icon: ArrowLeftRight, show: isManager },
    { name: 'Outlets', path: '/outlets', icon: Store, show: isAdmin },
    { name: 'Users', path: '/users', icon: Users, show: isAdmin },
  ];

  useEffect(() => {
    const loadManagerOutlet = async () => {
      if (!profile || profile.role !== 'manager') {
        setManagerOutletLabel('');
        return;
      }

      try {
        const res = await apiFetch('/api/outlets');
        if (!res.ok) return;
        const outletList = await res.json();
        const outlet =
          (profile.outletId && outletList.find((o: any) => o.id === profile.outletId)) ||
          outletList.find((o: any) => o.managerId === profile.uid);

        if (!outlet) {
          setManagerOutletLabel('Not assigned');
          return;
        }

        setManagerOutletLabel(outlet.location ? `${outlet.name} • ${outlet.location}` : outlet.name);
      } catch (err) {
        console.error('Failed to load manager outlet:', err);
      }
    };

    loadManagerOutlet();
  }, [profile?.outletId, profile?.role, profile?.uid]);

  return (
    <div className="flex min-h-screen bg-transparent text-slate-200 font-sans">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="fixed inset-y-0 left-0 bg-slate-800 border-r border-white/10 z-50 flex flex-col shadow-xl shadow-black/30"
      >
        <div className="p-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.h1
                key="logo-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-bold text-xl tracking-tight text-blue-400 truncate"
              >
                InventoryPro
              </motion.h1>
            ) : (
              <motion.div
                key="logo-icon"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold"
              >
                IP
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.filter(item => item.show).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-white/10 text-slate-100 font-bold" 
                  : "text-slate-300 hover:bg-white/5"
              )}
            >
              <item.icon size={22} className={cn(
                "shrink-0 transition-colors",
                "group-hover:text-slate-100"
              )} />
              {isSidebarOpen && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="truncate"
                >
                  {item.name}
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          {isSidebarOpen && (
            <div className="mb-4 px-3 py-2 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">User</p>
              <p className="text-sm font-medium truncate text-slate-100">{profile?.displayName || profile?.email}</p>
              <p className="text-[10px] font-bold text-blue-400 uppercase">{profile?.role.replace('_', ' ')}</p>
              {profile?.role === 'manager' && managerOutletLabel && (
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 truncate">
                  Outlet: {managerOutletLabel}
                </p>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-300 hover:bg-red-500/10 transition-colors",
              !isSidebarOpen && "justify-center"
            )}
          >
            <LogOut size={22} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 transition-all duration-300",
          isSidebarOpen ? "ml-[260px]" : "ml-[80px]"
        )}
      >
        <div className="w-full p-4 sm:p-6 lg:p-8">
          <div className="app-content min-h-[calc(100dvh-2rem)]">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
