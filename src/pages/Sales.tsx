import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import { Product, InventoryItem, Sale, SaleItem } from '../types';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Minus,
  X,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

const Sales: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const stock = inventory.find(i => i.productId === product.id)?.quantity || 0;

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

    const stock = inventory.find(i => i.productId === productId)?.quantity || 0;
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

  const totalAmount = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);

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
          totalAmount,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to complete checkout');
      }

      setCart([]);
      alert('Sale completed successfully!');
      fetchData();
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to complete checkout');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-160px)]">
      {/* Product Selection Area */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">New Sale</h1>
          <p className="text-gray-500 mt-1">Select products to add to the transaction.</p>
        </header>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const stock = inventory.find(i => i.productId === product.id)?.quantity || 0;
              const inCart = cart.find(item => item.productId === product.id);

              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={stock === 0}
                  className={cn(
                    "p-5 text-left bg-white rounded-2xl border transition-all duration-200 group relative",
                    stock === 0 ? "opacity-50 grayscale cursor-not-allowed" : "hover:border-blue-500 hover:shadow-lg hover:shadow-blue-50",
                    inCart ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-100"
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-bold uppercase rounded tracking-wider">
                      {product.category}
                    </div>
                    {inCart && (
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {inCart.quantity}
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                  <p className="text-xs text-gray-400 font-medium mt-1">SKU: {product.sku}</p>
                  
                  <div className="mt-4 flex items-end justify-between">
                    <p className="text-lg font-bold text-gray-900">${product.unitPrice.toFixed(2)}</p>
                    <p className={cn(
                      "text-xs font-bold",
                      stock < 10 ? "text-amber-500" : "text-emerald-500"
                    )}>
                      {stock} in stock
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cart / Checkout Area */}
      <div className="w-full lg:w-[400px] flex flex-col bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl">
              <ShoppingCart size={20} />
            </div>
            <h2 className="font-bold text-gray-900">Current Order</h2>
          </div>
          <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">
            {cart.reduce((sum, i) => sum + i.quantity, 0)} items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                    <Package size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">${product.unitPrice.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg">
                    <button 
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-gray-500"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-gray-500"
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
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
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

        <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-4">
          <div className="flex justify-between items-center text-gray-500 text-sm">
            <span>Subtotal</span>
            <span>${totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-gray-500 text-sm">
            <span>Tax (0%)</span>
            <span>$0.00</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <span className="text-2xl font-black text-blue-600">${totalAmount.toFixed(2)}</span>
          </div>
          <button
            disabled={cart.length === 0 || loading}
            onClick={handleCheckout}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:grayscale disabled:shadow-none flex items-center justify-center gap-2 mt-4"
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
        </div>
      </div>
    </div>
  );
};

export default Sales;

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
