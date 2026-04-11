import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import type { Outlet, Product, Sale } from '../types';
import { Clock, ShoppingCart, Search, Download } from 'lucide-react';

const Transactions: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const outletIdParam = (searchParams.get('outletId') || '').trim();

  const [sales, setSales] = useState<Sale[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const effectiveOutletId = isAdmin ? outletIdParam : (profile?.outletId || '');
        const salesUrl = effectiveOutletId
          ? `/api/sales?outletId=${encodeURIComponent(effectiveOutletId)}`
          : '/api/sales';

        const [salesRes, outRes, prodRes] = await Promise.all([
          apiFetch(salesUrl),
          isAdmin ? apiFetch('/api/outlets') : Promise.resolve(null as any),
          apiFetch('/api/products'),
        ]);

        if (salesRes.ok) setSales(await salesRes.json());
        if (outRes?.ok) setOutlets(await outRes.json());
        if (prodRes.ok) setProducts(await prodRes.json());
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile) fetchData();
  }, [isAdmin, outletIdParam, profile]);

  const outletNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const outlet of outlets) map.set(outlet.id, outlet.name);
    return map;
  }, [outlets]);

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(p.id, p.name);
    return map;
  }, [products]);

  const selectedOutletName =
    isAdmin && outletIdParam
      ? (outletNameById.get(outletIdParam) || 'Selected Outlet')
      : 'All Outlets';

  const filteredSales = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sales;

    return sales.filter((sale) => {
      const id = (sale.id || '').toLowerCase();
      if (id.includes(q) || id.slice(-6).includes(q)) return true;

      const outletName = (outletNameById.get(sale.outletId) || sale.outletId || '').toLowerCase();
      if (outletName.includes(q)) return true;

      const ts = (sale.timestamp || '').toString().toLowerCase();
      if (ts.includes(q)) return true;

      for (const it of sale.items || []) {
        const name = (productNameById.get(it.productId) || it.productId || '').toLowerCase();
        if (name.includes(q)) return true;
      }

      return false;
    });
  }, [outletNameById, productNameById, sales, searchTerm]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="app-h1">Transactions</h1>
          <p className="app-subtitle">
            View sales history across outlets.
            {isAdmin && <span className="ml-2 text-gray-400">• {selectedOutletName}</span>}
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <select
              className="app-select"
              value={outletIdParam}
              onChange={(e) => {
                const next = e.target.value;
                const nextParams = new URLSearchParams(searchParams);
                if (!next) nextParams.delete('outletId');
                else nextParams.set('outletId', next);
                setSearchParams(nextParams);
              }}
            >
              <option value="">All Outlets</option>
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>

            <button
              type="button"
              className="app-btn-secondary-lg text-sm flex items-center justify-center gap-2"
              disabled={downloadingReport}
              onClick={async () => {
                try {
                  setReportError(null);
                  setDownloadingReport(true);

                  const qs = new URLSearchParams();
                  if (outletIdParam) qs.set('outletId', outletIdParam);
                  const url = `/api/reports/sales${qs.toString() ? `?${qs.toString()}` : ''}`;

                  const res = await apiFetch(url);
                  if (!res.ok) {
                    const msg = await res.json().catch(() => null);
                    throw new Error(msg?.message || `Failed to download report (${res.status})`);
                  }

                  const blob = await res.blob();
                  const downloadUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = downloadUrl;
                  a.download = `sales-report${outletIdParam ? `-${outletIdParam}` : ''}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(downloadUrl);
                } catch (err: any) {
                  console.error('Report download error:', err);
                  setReportError(err?.message || 'Failed to download report');
                } finally {
                  setDownloadingReport(false);
                }
              }}
            >
              <Download size={18} />
              {downloadingReport ? 'Preparing...' : 'Download CSV'}
            </button>
          </div>
        )}
      </header>

      <div className="app-card">
        <div className="app-card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Clock size={18} className="text-blue-600" />
            {loading
              ? 'Loading...'
              : `${filteredSales.length} transaction(s)${searchTerm.trim() ? ` (of ${sales.length})` : ''}`}
          </div>

          {reportError && (
            <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
              {reportError}
            </div>
          )}

          <div className="relative w-full sm:w-[340px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by ID, outlet, or product..."
              className="app-input pl-9 pr-3 py-2 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading transactions...</div>
        ) : filteredSales.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
              <ShoppingCart size={22} />
            </div>
            <p className="text-sm font-medium">No transactions found</p>
            {searchTerm.trim() && (
              <p className="text-xs mt-1">Try a different search term.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Time</th>
                  {isAdmin && !outletIdParam && (
                    <th>Outlet</th>
                  )}
                  <th>Products</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const itemCount = (sale.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
                  const outletName = outletNameById.get(sale.outletId) || sale.outletId;
                  const items = sale.items || [];
                  const preview = items.slice(0, 2).map((it) => {
                    const name = productNameById.get(it.productId) || it.productId;
                    return `${name} ×${it.quantity || 0}`;
                  });
                  const moreCount = Math.max(0, items.length - preview.length);
                  const productsLabel = preview.join(', ') + (moreCount > 0 ? ` +${moreCount} more` : '');
                  return (
                    <tr key={sale.id}>
                      <td>
                        <div className="text-sm font-bold text-gray-900">#{sale.id.slice(-6)}</div>
                        <div className="text-xs text-gray-500">{format(new Date(sale.timestamp), 'MMM dd, yyyy • h:mm a')}</div>
                      </td>
                      {isAdmin && !outletIdParam && (
                        <td className="text-sm font-medium text-gray-700">{outletName}</td>
                      )}
                      <td className="text-sm font-medium text-gray-700">
                        <div className="max-w-[420px] truncate" title={productsLabel}>
                          {productsLabel || '—'}
                        </div>
                      </td>
                      <td className="text-sm font-medium text-gray-700">{itemCount} item(s)</td>
                      <td className="text-sm font-bold text-gray-900">${(sale.totalAmount || 0).toFixed(2)}</td>
                      <td>
                        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full uppercase tracking-wider">
                          Completed
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;
