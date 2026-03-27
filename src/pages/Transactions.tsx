import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthContext';
import type { Outlet, Sale } from '../types';
import { Clock, ShoppingCart } from 'lucide-react';

const Transactions: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const outletIdParam = (searchParams.get('outletId') || '').trim();

  const [sales, setSales] = useState<Sale[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const effectiveOutletId = isAdmin ? outletIdParam : (profile?.outletId || '');
        const salesUrl = effectiveOutletId
          ? `/api/sales?outletId=${encodeURIComponent(effectiveOutletId)}`
          : '/api/sales';

        const [salesRes, outRes] = await Promise.all([
          apiFetch(salesUrl),
          isAdmin ? apiFetch('/api/outlets') : Promise.resolve(null as any),
        ]);

        if (salesRes.ok) setSales(await salesRes.json());
        if (outRes?.ok) setOutlets(await outRes.json());
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

  const selectedOutletName =
    isAdmin && outletIdParam
      ? (outletNameById.get(outletIdParam) || 'Selected Outlet')
      : 'All Outlets';

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Transactions</h1>
          <p className="text-gray-500 mt-1">
            View sales history across outlets.
            {isAdmin && <span className="ml-2 text-gray-400">• {selectedOutletName}</span>}
          </p>
        </div>

        {isAdmin && (
          <select
            className="text-sm border-gray-200 rounded-xl bg-gray-50 px-4 py-2.5 focus:ring-blue-500 focus:border-blue-500"
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
        )}
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <Clock size={18} className="text-blue-500" />
            {loading ? 'Loading...' : `${sales.length} transaction(s)`}
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading transactions...</div>
        ) : sales.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
              <ShoppingCart size={22} />
            </div>
            <p className="text-sm font-medium">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Time</th>
                  {isAdmin && !outletIdParam && (
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Outlet</th>
                  )}
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Items</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map((sale) => {
                  const itemCount = (sale.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
                  const outletName = outletNameById.get(sale.outletId) || sale.outletId;
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">#{sale.id.slice(-6)}</div>
                        <div className="text-xs text-gray-500">{format(new Date(sale.timestamp), 'MMM dd, yyyy • h:mm a')}</div>
                      </td>
                      {isAdmin && !outletIdParam && (
                        <td className="px-6 py-4 text-sm font-medium text-gray-700">{outletName}</td>
                      )}
                      <td className="px-6 py-4 text-sm font-medium text-gray-700">{itemCount} item(s)</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">${(sale.totalAmount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-wider">
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

