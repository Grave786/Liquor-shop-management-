import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import { Product, InventoryItem, Outlet } from '../types';
import { CATEGORIES } from '../constants';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Package, 
  AlertCircle,
  ChevronDown,
  Minus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Inventory: React.FC = () => {
  const { profile, isAdmin, isManager } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: CATEGORIES[0],
    sku: '',
    unitPrice: 0,
    description: '',
    initialQuantity: 0,
    outletId: ''
  });

  const [stockFormData, setStockFormData] = useState({
    quantity: 0,
    outletId: ''
  });

  const fetchData = async () => {
    try {
      const outletId = profile?.outletId;
      const invUrl = isAdmin ? '/api/inventory' : `/api/inventory?outletId=${outletId}`;

      const [prodRes, invRes, outRes] = await Promise.all([
        apiFetch('/api/products'),
        apiFetch(invUrl),
        apiFetch('/api/outlets')
      ]);

      if (prodRes.ok) setProducts(await prodRes.json());
      if (invRes.ok) setInventory(await invRes.json());
      if (outRes.ok) setOutlets(await outRes.json());
    } catch (err) {
      console.error('Error fetching inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchData();
      setFormData(prev => ({ ...prev, outletId: profile.outletId || '' }));
      setStockFormData(prev => ({ ...prev, outletId: profile.outletId || '' }));
    }
  }, [isAdmin, profile]);

  const handleOpenStockModal = (product: Product) => {
    setSelectedProductForStock(product);
    const currentOutletId = profile?.outletId || outlets[0]?.id || '';
    const currentStock = inventory.find(i => i.productId === product.id && i.outletId === currentOutletId)?.quantity || 0;
    setStockFormData({
      quantity: currentStock,
      outletId: currentOutletId
    });
    setIsStockModalOpen(true);
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForStock || !stockFormData.outletId) return;

    try {
      await apiFetch('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProductForStock.id,
          outletId: stockFormData.outletId,
          quantity: stockFormData.quantity
        })
      });
      setIsStockModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error updating stock:', err);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await apiFetch(`/api/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formData)
        });
      } else {
        const res = await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        const newProduct = await res.json();
        
        // Initialize inventory for all outlets
        for (const outlet of outlets) {
          await apiFetch('/api/inventory', {
            method: 'POST',
            body: JSON.stringify({
              productId: newProduct.id,
              outletId: outlet.id,
              quantity: outlet.id === formData.outletId ? formData.initialQuantity : 0
            })
          });
        }
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ 
        name: '', 
        category: CATEGORIES[0], 
        sku: '', 
        unitPrice: 0, 
        description: '',
        initialQuantity: 0,
        outletId: profile?.outletId || ''
      });
      fetchData();
    } catch (err) {
      console.error('Error saving product:', err);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const filteredProducts = products.filter(p => 
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedCategory === 'All' || p.category === selectedCategory)
  );

  const getStockForProduct = (productId: string) => {
    const items = inventory.filter(i => i.productId === productId);
    return items.reduce((sum, i) => sum + i.quantity, 0);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">Manage your product catalog and track stock levels.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingProduct(null);
              setFormData({ 
                name: '', 
                category: CATEGORIES[0], 
                sku: '', 
                unitPrice: 0, 
                description: '',
                initialQuantity: 0,
                outletId: profile?.outletId || ''
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus size={20} />
            Add Product
          </button>
        )}
      </header>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <select
              className="appearance-none pl-4 pr-10 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-700 cursor-pointer"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option>All</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
          <button className="p-2 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product, i) => {
          const stock = getStockForProduct(product.id);
          const isLowStock = stock < 10;

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all duration-300"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded tracking-wider">
                    {product.category}
                  </div>
                  {isAdmin && (
                    <div className="relative group/menu">
                      <button className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50">
                        <MoreVertical size={18} />
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-10 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setFormData({
                              name: product.name,
                              category: product.category,
                              sku: product.sku,
                              unitPrice: product.unitPrice,
                              description: product.description || '',
                              initialQuantity: 0,
                              outletId: profile?.outletId || ''
                            });
                            setIsModalOpen(true);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                <p className="text-xs text-gray-400 font-medium mt-1">SKU: {product.sku}</p>

                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Unit Price</p>
                    <p className="text-xl font-bold text-gray-900">${product.unitPrice.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-medium">Stock</p>
                    <div className={cn(
                      "flex items-center gap-1.5 font-bold text-lg",
                      isLowStock ? "text-amber-500" : "text-emerald-500"
                    )}>
                      {isLowStock && <AlertCircle size={16} />}
                      {stock}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {isAdmin ? 'Global Stock' : 'Outlet Stock'}
                  </span>
                  {(isAdmin || isManager) && (
                    <button 
                      onClick={() => handleOpenStockModal(product)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                    >
                      Adjust Stock
                    </button>
                  )}
                </div>
                <button className="text-xs font-bold text-blue-600 hover:underline">
                  View Details
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
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Product Name</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Category</label>
                      <select
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">SKU</label>
                      <input
                        required
                        type="text"
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Unit Price ($)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.unitPrice}
                      onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Description</label>
                    <textarea
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  {!editingProduct && (
                    <div className="grid grid-cols-2 gap-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Initial Stock</label>
                        <input
                          type="number"
                          className="w-full px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                          value={formData.initialQuantity}
                          onChange={(e) => setFormData({ ...formData, initialQuantity: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Target Outlet</label>
                        <select
                          className="w-full px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                          value={formData.outletId}
                          onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                          disabled={!isAdmin}
                        >
                          <option value="">Select Outlet</option>
                          {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

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
                      {editingProduct ? 'Update Product' : 'Create Product'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Adjustment Modal */}
      <AnimatePresence>
        {isStockModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsStockModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Adjust Stock</h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedProductForStock?.name}</p>
                  </div>
                  <button onClick={() => setIsStockModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleUpdateStock} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Outlet</label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      value={stockFormData.outletId}
                      onChange={(e) => {
                        const newOutletId = e.target.value;
                        const currentStock = inventory.find(i => i.productId === selectedProductForStock?.id && i.outletId === newOutletId)?.quantity || 0;
                        setStockFormData({ outletId: newOutletId, quantity: currentStock });
                      }}
                      disabled={!isAdmin}
                    >
                      {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Current Quantity</label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setStockFormData(prev => ({ ...prev, quantity: Math.max(0, prev.quantity - 1) }))}
                        className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        <Minus size={20} />
                      </button>
                      <input
                        type="number"
                        className="flex-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-center font-bold text-xl"
                        value={stockFormData.quantity}
                        onChange={(e) => setStockFormData({ ...stockFormData, quantity: parseInt(e.target.value) || 0 })}
                      />
                      <button
                        type="button"
                        onClick={() => setStockFormData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                        className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button
                      type="button"
                      onClick={() => setIsStockModalOpen(false)}
                      className="flex-1 py-4 text-sm font-bold text-gray-500 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-4 text-sm font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      Update Stock
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

export default Inventory;

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
