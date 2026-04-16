import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import { Product, InventoryItem, SaleItem } from '../types';
import { CATEGORIES } from '../constants';
import { 
  Plus, 
  Search, 
  Filter,
  ShoppingCart, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  Minus,
  X,
  Package,
  LayoutGrid,
  Table2,
  Printer,
  FileText,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Sales: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [receiptPhone, setReceiptPhone] = useState('');
  const [receiptSmsStatus, setReceiptSmsStatus] = useState<string | null>(null);
  const [receiptSmsError, setReceiptSmsError] = useState<string | null>(null);
  const [receiptSmsLoading, setReceiptSmsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('sales:viewMode');
      return saved === 'table' ? 'table' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  type ReceiptLine = {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
  };

  type ReceiptData = {
    id: string;
    outletId: string;
    cashier: string;
    timestamp: string;
    lines: ReceiptLine[];
    subtotal: number;
    discountType?: 'amount' | 'percent';
    discountValue?: number;
    discountAmount?: number;
    totalAmount: number;
    customerName?: string;
  };

  const stockByProductId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of inventory) {
      map.set(row.productId, (map.get(row.productId) || 0) + (row.quantity || 0));
    }
    return map;
  }, [inventory]);

  const getStockForProduct = (productId: string) => stockByProductId.get(productId) || 0;

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const formatMoney = (amount: number) => `$${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;

  const formatDateTime = (iso: string) => {
    try {
      const dt = new Date(iso);
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(dt);
    } catch {
      return iso;
    }
  };

  const printReceipt = (data: ReceiptData) => {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Receipt ${data.id}</title>
    <style>
      :root { --accent: ${'#7c3aed'}; }
      body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 24px; color: #0b1220; }
      .wrap { max-width: 420px; margin: 0 auto; }
      .brand { display:flex; align-items:center; gap:10px; margin-bottom: 10px; }
      .logo { width: 34px; height: 34px; border-radius: 10px; background: rgba(124,58,237,0.12); color: var(--accent); display:flex; align-items:center; justify-content:center; font-weight: 900; }
      h1 { font-size: 18px; margin: 0; }
      .muted { color: #64748b; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 14px; }
      th, td { padding: 8px 0; font-size: 12px; }
      th { text-align: left; color: #334155; border-bottom: 1px solid #e2e8f0; }
      td { border-bottom: 1px dashed #e2e8f0; vertical-align: top; }
      .right { text-align: right; }
      .totals { margin-top: 12px; }
      .row { display:flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 4px 0; }
      .row.total { font-size: 14px; font-weight: 900; padding-top: 10px; border-top: 1px solid #e2e8f0; }
      .thanks { margin-top: 14px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="brand">
        <div class="logo">L</div>
        <div>
          <h1>LiquorLedger</h1>
          <div class="muted">Receipt • ${data.id}</div>
        </div>
      </div>
      <div class="muted">Date: ${formatDateTime(data.timestamp)}</div>
      <div class="muted">Outlet: ${data.outletId}</div>
      <div class="muted">Cashier: ${data.cashier}</div>
      <div class="muted">Customer: ${data.customerName || 'Walk-in'}</div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="right">Qty</th>
            <th class="right">Price</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.lines.map((l) => `
            <tr>
              <td>${escapeHtml(l.name)}</td>
              <td class="right">${l.quantity}</td>
              <td class="right">${formatMoney(l.price)}</td>
              <td class="right">${formatMoney(l.lineTotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${formatMoney(data.subtotal)}</span></div>
        ${data.discountAmount ? `<div class="row"><span>Discount</span><span>- ${formatMoney(data.discountAmount)}</span></div>` : ''}
        <div class="row total"><span>Total</span><span>${formatMoney(data.totalAmount)}</span></div>
      </div>

      <div class="thanks">Thank you!</div>
    </div>
    <script>window.onload = () => { window.print(); window.close(); };</script>
  </body>
</html>`;

    const w = window.open('', '_blank', 'noopener,noreferrer,width=480,height=720');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const escapeHtml = (value: string) =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const fetchData = async () => {
    try {
      const outletId = profile?.outletId;
      const invUrl = isAdmin ? '/api/inventory' : `/api/inventory?outletId=${outletId}`;

      const [prodRes, invRes] = await Promise.all([
        apiFetch('/api/products'),
        apiFetch(invUrl)
      ]);

      if (prodRes.ok) setProducts(await prodRes.json());
      if (invRes.ok) setInventory(await invRes.json());
    } catch (err) {
      console.error('Error fetching sales data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchData();
    }
  }, [isAdmin, profile]);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    const stock = getStockForProduct(product.id);

    if (existing) {
      if (existing.quantity + 1 > stock) {
        setError(`Not enough stock for ${product.name}`);
        setTimeout(() => setError(null), 3000);
        return;
      }
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      if (stock < 1) {
        setError(`Out of stock: ${product.name}`);
        setTimeout(() => setError(null), 3000);
        return;
      }
      setCart([...cart, { productId: product.id, quantity: 1, price: product.unitPrice }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;

    const stock = getStockForProduct(productId);
    const newQty = item.quantity + delta;

    if (newQty < 1) {
      removeFromCart(productId);
      return;
    }

    if (newQty > stock) {
      setError('Insufficient stock');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setCart(cart.map(i => i.productId === productId ? { ...i, quantity: newQty } : i));
  };

  const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
  const discountAmount = discountType === 'percent'
    ? (subtotal * Math.min(100, Math.max(0, discountValue))) / 100
    : Math.min(subtotal, Math.max(0, discountValue));
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const handleCheckout = async () => {
    if (!profile?.outletId) {
      setError('No outlet assigned to your profile');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          outletId: profile.outletId,
          userId: profile.uid,
          items: cart,
          discountType: discountAmount > 0 ? discountType : undefined,
          discountValue: discountAmount > 0 ? discountValue : undefined,
          totalAmount,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to complete checkout');
      }

      const sale = await response.json();
      const lines: ReceiptLine[] = (Array.isArray(sale.items) ? sale.items : []).map((it: any) => {
        const pid = String(it.productId || '');
        const qty = Number(it.quantity || 0);
        const price = Number(it.price || 0);
        const product = productById.get(pid);
        return {
          productId: pid,
          name: product?.name || 'Unknown item',
          quantity: qty,
          price,
          lineTotal: qty * price,
        };
      });

      const receiptData: ReceiptData = {
        id: String(sale.id || ''),
        outletId: String(sale.outletId || profile.outletId),
        cashier: profile?.displayName || profile?.email || profile.uid,
        timestamp: String(sale.timestamp || new Date().toISOString()),
        lines,
        subtotal: Number(sale.subtotal ?? subtotal),
        discountType: sale.discountType === 'percent' ? 'percent' : sale.discountType === 'amount' ? 'amount' : undefined,
        discountValue: sale.discountValue !== undefined ? Number(sale.discountValue) : undefined,
        discountAmount: sale.discountAmount !== undefined ? Number(sale.discountAmount) : (discountAmount > 0 ? discountAmount : undefined),
        totalAmount: Number(sale.totalAmount ?? totalAmount),
        customerName: customerName.trim() || undefined,
      };

      setReceipt(receiptData);
      setIsReceiptOpen(true);
      setReceiptPhone('');
      setReceiptSmsStatus(null);
      setReceiptSmsError(null);

      setCart([]);
      setDiscountValue(0);
      setCustomerName('');
      fetchData();
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to complete checkout');
    } finally {
      setLoading(false);
    }
  };

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const filteredProducts = products.filter(p => {
    const matchesSearch =
      !normalizedSearch ||
      p.name.toLowerCase().includes(normalizedSearch) ||
      p.category.toLowerCase().includes(normalizedSearch) ||
      (p.description || '').toLowerCase().includes(normalizedSearch);

    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;

    const stock = getStockForProduct(p.id);
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'in' && stock > 0) ||
      (stockFilter === 'out' && stock === 0) ||
      (stockFilter === 'low' && stock > 0 && stock < 10);

    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-220px)]">
      {/* Product Selection Area */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <header>
          <h1 className="app-h1">New Sale</h1>
          <p className="app-subtitle">Select products to add to the transaction.</p>
        </header>

        {/* Filters */}
        <div className="app-card p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, category, or description..."
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
                  try { localStorage.setItem('sales:viewMode', 'grid'); } catch {}
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
                  try { localStorage.setItem('sales:viewMode', 'table'); } catch {}
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
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option>All</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>

            <div className="relative">
              <select
                className="app-select appearance-none pl-4 pr-10 py-2 text-sm font-medium text-gray-700 cursor-pointer"
                value={stockFilter}
                onChange={(e) => {
                  const v = e.target.value as 'all' | 'in' | 'low' | 'out';
                  setStockFilter(v);
                }}
              >
                <option value="all">All Stock</option>
                <option value="in">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>

            <button className="app-btn-icon" type="button" aria-label="Filters">
              <Filter size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const stock = getStockForProduct(product.id);
                const inCart = cart.find(item => item.productId === product.id);

                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={stock === 0}
                    className={cn(
                      "p-5 text-left rounded-2xl border border-[color:var(--app-card-border)] bg-[color:var(--app-card-bg)] text-[color:var(--app-fg)] transition-all duration-200 group relative",
                      stock === 0 ? "opacity-50 grayscale cursor-not-allowed" : "hover:border-blue-600 hover:shadow-lg hover:shadow-blue-600/10",
                      inCart ? "border-blue-600 ring-1 ring-blue-600/20" : ""
                    )}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded tracking-wider">
                        {product.category}
                      </div>
                      {inCart && (
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {inCart.quantity}
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold truncate">{product.name}</h3>
                    
                    <div className="mt-4 flex items-end justify-between">
                      <p className="text-lg font-bold">${product.unitPrice.toFixed(2)}</p>
                      <p className={cn(
                        "text-xs font-bold",
                        stock < 10 ? "text-amber-500" : "text-green-600"
                      )}>
                        {stock} in stock
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="app-card overflow-x-auto">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Unit Price</th>
                    <th>Stock</th>
                    <th>In Cart</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const stock = getStockForProduct(product.id);
                    const inCartQty = cart.find((item) => item.productId === product.id)?.quantity || 0;
                    const isLowStock = stock > 0 && stock < 10;

                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="font-bold text-gray-900">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-gray-500 max-w-[520px] truncate" title={product.description}>
                              {product.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="inline-flex px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded tracking-wider">
                            {product.category}
                          </span>
                        </td>
                        <td className="text-sm font-bold text-gray-900">${product.unitPrice.toFixed(2)}</td>
                        <td>
                          <div className={cn(
                            "inline-flex items-center gap-1.5 font-bold",
                            stock === 0 ? "text-red-600" : isLowStock ? "text-amber-600" : "text-green-700"
                          )}>
                            {stock === 0 && <AlertCircle size={14} />}
                            {stock}
                          </div>
                        </td>
                        <td>
                          {inCartQty > 0 ? (
                            <span className="inline-flex px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                              {inCartQty}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            disabled={stock === 0}
                            className={cn(
                              "app-btn-primary rounded-xl py-2 px-3 text-xs inline-flex items-center gap-2",
                              stock === 0 ? "opacity-50 cursor-not-allowed" : ""
                            )}
                          >
                            <Plus size={16} />
                            Add
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredProducts.length === 0 && (
            <div className="p-10 text-center text-gray-400 text-sm">
              No products match your search.
            </div>
          )}
        </div>
      </div>

      {/* Cart / Checkout Area */}
      <div className="app-card w-full lg:w-[400px] flex flex-col">
        <div className="app-card-header">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl">
              <ShoppingCart size={20} />
            </div>
            <h2 className="font-bold">Current Order</h2>
          </div>
          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
            {cart.reduce((sum, i) => sum + i.quantity, 0)} items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold app-muted ml-1">Customer (optional)</label>
            <input
              type="text"
              placeholder="Walk-in customer"
              className="app-input py-2.5 text-sm"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <AnimatePresence initial={false}>
            {cart.map((item) => {
              const product = products.find(p => p.id === item.productId);
              if (!product) return null;

              return (
                <motion.div
                  key={item.productId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <Package size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{product.name}</p>
                    <p className="text-xs app-muted">${product.unitPrice.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <button 
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="p-1 rounded transition-all app-muted hover:bg-[color:var(--app-icon-hover-bg)] hover:text-[color:var(--app-fg)]"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="p-1 rounded transition-all app-muted hover:bg-[color:var(--app-icon-hover-bg)] hover:text-[color:var(--app-fg)]"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.productId)}
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart size={32} className="opacity-20" />
              </div>
              <p className="text-sm font-medium">Your cart is empty</p>
              <p className="text-xs mt-1">Select products to start a sale</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-50 text-red-600 text-xs font-medium rounded-xl flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="p-6 bg-slate-50/70 border-t border-slate-200/70 space-y-4">
          <div className="flex justify-between items-center text-gray-500 text-sm">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <span>Discount</span>
              <select
                className="text-xs border-gray-200 rounded-lg bg-white px-2 py-1 focus:ring-blue-600 focus:border-blue-600"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value === 'percent' ? 'percent' : 'amount')}
                disabled={cart.length === 0}
              >
                <option value="amount">$</option>
                <option value="percent">%</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                className="w-24 text-right px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm font-bold text-gray-900"
                value={discountValue}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                disabled={cart.length === 0}
              />
              <span className="text-xs font-bold text-gray-400">
                -${discountAmount.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center text-gray-500 text-sm">
            <span>Tax (0%)</span>
            <span>$0.00</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-lg font-bold">Total</span>
            <span className="text-2xl font-black text-blue-700">${totalAmount.toFixed(2)}</span>
          </div>
          <button
            disabled={cart.length === 0 || loading}
            onClick={handleCheckout}
            className="app-btn-primary-lg flex items-center justify-center gap-2 mt-4 disabled:grayscale"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={20} />
                Complete Transaction
              </>
            )}
          </button>

          {receipt && (
            <button
              type="button"
              onClick={() => setIsReceiptOpen(true)}
              className="app-btn-secondary-lg flex items-center justify-center gap-2 mt-3"
            >
              <FileText size={18} />
              View Bill
            </button>
          )}
        </div>
      </div>

      {/* Receipt Modal */}
      <AnimatePresence>
        {isReceiptOpen && receipt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReceiptOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-lg app-card overflow-hidden"
            >
              <div className="app-card-header">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-[color:var(--app-accent-soft-2)] text-[color:var(--app-accent)] flex items-center justify-center font-black shrink-0">
                    L
                  </div>
                  <div className="min-w-0">
                    <div className="font-black truncate">LiquorLedger • Bill</div>
                    <div className="text-xs app-muted truncate">Receipt #{receipt.id}</div>
                  </div>
                </div>
                <button type="button" onClick={() => setIsReceiptOpen(false)} className="app-btn-icon" aria-label="Close receipt">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="app-muted">Date</div>
                  <div className="text-right font-bold">{formatDateTime(receipt.timestamp)}</div>
                  <div className="app-muted">Outlet</div>
                  <div className="text-right font-bold">{receipt.outletId}</div>
                  <div className="app-muted">Cashier</div>
                  <div className="text-right font-bold truncate">{receipt.cashier}</div>
                  <div className="app-muted">Customer</div>
                  <div className="text-right font-bold truncate">{receipt.customerName || 'Walk-in'}</div>
                </div>

                <div className="app-card overflow-hidden">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipt.lines.map((l) => (
                        <tr key={`${l.productId}:${l.price}`}>
                          <td className="font-bold text-gray-900">{l.name}</td>
                          <td className="text-right font-bold">{l.quantity}</td>
                          <td className="text-right font-bold">{formatMoney(l.price)}</td>
                          <td className="text-right font-black">{formatMoney(l.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="app-muted">Subtotal</span>
                    <span className="font-bold">{formatMoney(receipt.subtotal)}</span>
                  </div>
                  {receipt.discountAmount ? (
                    <div className="flex justify-between">
                      <span className="app-muted">Discount</span>
                      <span className="font-bold">- {formatMoney(receipt.discountAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-2 border-t app-divider">
                    <span className="text-lg font-black">Total</span>
                    <span className="text-lg font-black text-[color:var(--app-accent)]">{formatMoney(receipt.totalAmount)}</span>
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <label className="text-xs font-bold app-muted ml-1">Phone number (E.164)</label>
                  <input
                    type="tel"
                    placeholder="+14155552671"
                    className="app-input py-2.5 text-sm"
                    value={receiptPhone}
                    onChange={(e) => setReceiptPhone(e.target.value)}
                  />
                  {receiptSmsStatus && (
                    <div className="text-xs font-bold text-green-600">{receiptSmsStatus}</div>
                  )}
                  {receiptSmsError && (
                    <div className="text-xs font-bold text-red-600">{receiptSmsError}</div>
                  )}
                  <div className="text-[11px] app-muted">
                    Requires Twilio env vars on the server: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => printReceipt(receipt)}
                    className="app-btn-primary rounded-2xl flex-1"
                  >
                    <Printer size={18} />
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setReceiptSmsLoading(true);
                      setReceiptSmsStatus(null);
                      setReceiptSmsError(null);
                      try {
                        const res = await apiFetch(`/api/sales/${encodeURIComponent(receipt.id)}/send-sms`, {
                          method: 'POST',
                          body: JSON.stringify({
                            phoneNumber: receiptPhone.trim(),
                            customerName: receipt.customerName || undefined,
                          }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data?.message || 'Failed to send SMS');
                        setReceiptSmsStatus('Bill sent to phone successfully.');
                      } catch (e: any) {
                        setReceiptSmsError(e?.message || 'Failed to send SMS');
                      } finally {
                        setReceiptSmsLoading(false);
                      }
                    }}
                    disabled={!receiptPhone.trim() || receiptSmsLoading}
                    className="app-btn-secondary rounded-2xl flex-1 disabled:opacity-50"
                  >
                    {receiptSmsLoading ? (
                      <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                    ) : (
                      <>
                        <Phone size={18} />
                        Send
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReceiptOpen(false)}
                    className="app-btn-secondary rounded-2xl flex-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Sales;

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
