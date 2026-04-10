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
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTheme } from '../ThemeContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Layout: React.FC = () => {
  const { profile, isAdmin, isSuperAdmin, isManager, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
    <div className="flex min-h-screen bg-transparent font-sans">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="fixed inset-y-0 left-0 z-50 flex flex-col app-sidebar"
      >
        <div className="p-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.h1
                key="logo-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-bold text-xl tracking-tight truncate"
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
            className="p-2 rounded-xl transition-colors app-sidebar-action"
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
                "app-sidebar-link",
                isActive && "is-active"
              )}
            >
              <item.icon size={22} className={cn(
                "shrink-0 transition-colors",
                "group-hover:opacity-100"
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

        <div className="p-4 space-y-3">
          {isSidebarOpen && (
            <div className="mb-4 px-3 py-2 rounded-2xl app-sidebar-userbox">
              <p className="text-xs font-semibold uppercase tracking-wider app-sidebar-muted">User</p>
              <p className="text-sm font-medium truncate">{profile?.displayName || profile?.email}</p>
              <p className="text-[10px] font-bold text-blue-400 uppercase">{profile?.role.replace('_', ' ')}</p>
              {profile?.role === 'manager' && managerOutletLabel && (
                <p className="text-[10px] font-bold uppercase mt-1 truncate app-sidebar-muted">
                  Outlet: {managerOutletLabel}
                </p>
              )}
            </div>
          )}

          <div className={cn("p-2 rounded-2xl app-sidebar-userbox", !isSidebarOpen && "p-1")}>
            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                "text-[color:var(--app-fg)] hover:bg-[color:var(--app-icon-hover-bg)]",
                !isSidebarOpen && "justify-center px-2"
              )}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              {isSidebarOpen && <span className="font-semibold">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
            </button>

            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors mt-1",
                "app-sidebar-logout",
                !isSidebarOpen && "justify-center px-2"
              )}
            >
              <LogOut size={20} />
              {isSidebarOpen && <span className="font-semibold">Logout</span>}
            </button>
          </div>
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
