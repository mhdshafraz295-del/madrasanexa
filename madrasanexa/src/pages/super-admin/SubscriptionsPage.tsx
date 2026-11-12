import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  apiListMadrasas,
  apiSuspendSubscription,
  apiCancelSubscription,
  type MadrasaListItem,
} from '../../services/api';
import {
  Loader2,
  PauseCircle,
  XCircle,
  ArrowRight,
  Receipt,
} from 'lucide-react';

export default function SubscriptionsPage() {
  const [madrasas, setMadrasas] = useState<MadrasaListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMadrasas = async () => {
    setIsLoading(true);
    try {
      const res = await apiListMadrasas();
      setMadrasas(res.madrasas);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMadrasas();
  }, []);

  const handleSuspendSub = async (subId: string) => {
    if (!window.confirm('Suspend this active subscription term? The Madrasa will immediately enter SUSPENDED access mode.')) return;
    try {
      await apiSuspendSubscription(subId);
      fetchMadrasas();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to suspend subscription');
    }
  };

  const handleCancelSub = async (subId: string) => {
    if (!window.confirm('Cancel this subscription term? The Madrasa will lose active access.')) return;
    try {
      await apiCancelSubscription(subId);
      fetchMadrasas();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel subscription');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Subscriptions & Terms</h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Monitor multi-tenant subscription terms, expiring contracts, and manual status interventions.
          </p>
        </div>
        <Link
          to="/super-admin/subscription-payments"
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer w-fit"
        >
          <Receipt className="w-4 h-4 text-[#37C6A3]" />
          <span>Payment Approvals</span>
        </Link>
      </div>

      {/* Subscriptions Overview Table */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
            <p className="text-xs text-[#7C8A9A]">Loading subscriptions...</p>
          </div>
        ) : madrasas.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#7C8A9A]">
            No Madrasa subscriptions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold border-b border-[#E7E9EE]">
                <tr>
                  <th className="px-5 py-3">Madrasa</th>
                  <th className="px-5 py-3">Active Plan</th>
                  <th className="px-5 py-3">Term Dates</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Paid Price</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE]">
                {madrasas.map((m) => {
                  const sub = m.activeSubscription;
                  return (
                    <tr key={m.id} className="hover:bg-[#F7F6F1]/50 transition">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-[#0F172A]">{m.name}</div>
                        <div className="text-[10px] font-mono text-[#7C8A9A]">{m.code}</div>
                      </td>
                      <td className="px-5 py-3">
                        {sub?.plan ? (
                          <div className="font-semibold text-[#0F172A]">{sub.plan.name}</div>
                        ) : (
                          <span className="text-[#7C8A9A]">None active</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px]">
                        {sub ? (
                          <span>
                            {new Date(sub.startsAt).toLocaleDateString()} &rarr; {new Date(sub.endsAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-[#7C8A9A]">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {sub ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sub.status === 'SUSPENDED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {sub.status}
                          </span>
                        ) : (
                          <span className="text-[#7C8A9A] text-[10px]">INACTIVE</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono">
                        {sub ? `$${Number(sub.priceAtPurchase || 0).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {sub && sub.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleSuspendSub(sub.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                              title="Suspend Term"
                            >
                              <PauseCircle className="w-3 h-3" />
                              <span>Suspend</span>
                            </button>
                          )}
                          {sub && sub.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleCancelSub(sub.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                              title="Cancel Term"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          )}
                          <Link
                            to={`/super-admin/madrasas/${m.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] rounded-lg text-[11px] font-semibold transition cursor-pointer"
                          >
                            <span>Manage</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
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
}
