import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { SaleTransaction, RefundRecord } from '../../types';
import { 
  Search, 
  RotateCcw, 
  Receipt, 
  Calendar, 
  Clock, 
  Download, 
  Filter, 
  Eye, 
  CheckCircle, 
  AlertCircle,
  Database,
  RefreshCw,
  Wifi
} from 'lucide-react';

interface SalesHistoryManagerProps {
  onViewReceipt: (tx: SaleTransaction) => void;
  onOpenRefundForTx: (tx: SaleTransaction) => void;
}

export const SalesHistoryManager: React.FC<SalesHistoryManagerProps> = ({
  onViewReceipt,
  onOpenRefundForTx,
}) => {
  const { 
    sales, 
    refunds, 
    customers, 
    employees, 
    syncStatus, 
    lastSyncTime, 
    serverVersion, 
    forceSync 
  } = usePos();

  const [activeTab, setActiveTab] = useState<'sales' | 'refunds'>('sales');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(tx => {
      const matchSearch =
        tx.transaction_id.toLowerCase().includes(search.toLowerCase()) ||
        tx.customer_id.toLowerCase().includes(search.toLowerCase()) ||
        (tx.item_name && tx.item_name.toLowerCase().includes(search.toLowerCase()));

      let matchPayment = true;
      if (paymentFilter !== 'All') {
        if (paymentFilter === 'Split Payment') {
          matchPayment = tx.payment_method === 'Split Payment' || Boolean(tx.payment_splits && tx.payment_splits.length > 0);
        } else if (paymentFilter === 'Cash') {
          matchPayment = tx.payment_method === 'Cash' || Boolean(tx.payment_splits && tx.payment_splits.some(s => s.method === 'Cash'));
        } else if (paymentFilter === 'Bank Transfer') {
          matchPayment = tx.payment_method === 'Bank Transfer' || Boolean(tx.payment_splits && tx.payment_splits.some(s => s.method === 'Bank Transfer'));
        } else if (paymentFilter === 'POS') {
          matchPayment = tx.payment_method === 'POS' || tx.payment_method === 'Debit/Credit Card' || Boolean(tx.payment_splits && tx.payment_splits.some(s => s.method === 'POS' || s.method === 'Debit/Credit Card'));
        } else {
          matchPayment = tx.payment_method === paymentFilter;
        }
      }

      let matchDate = true;
      if (dateFilter === 'today') {
        matchDate = tx.date_time.startsWith('2026-09-22');
      }

      return matchSearch && matchPayment && matchDate;
    });
  }, [sales, search, paymentFilter, dateFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <span>Sales Transactions & Audit Log</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
              {sales.length} Transactions
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete immutable ledger of all counter sales, payment modes, manager discount authorizations, and customer returns.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'sales'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sales Log ({sales.length})
          </button>
          <button
            onClick={() => setActiveTab('refunds')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'refunds'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-rose-700'
            }`}
          >
            Refunds & Returns ({refunds.length})
          </button>
        </div>
      </div>

      {/* Central Database Live Multi-System Sync Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-100">Centralized Cloud Sales Ledger</span>
              <span className="flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-700/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{syncStatus === 'synced' ? 'Multi-Terminal Live' : syncStatus === 'syncing' ? 'Syncing...' : 'Local Cache'}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Admins & Supervisors have full visibility of all sales submitted across every cashier terminal and published system.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-center text-xs">
          <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
            Version {serverVersion} • Last Sync: {lastSyncTime}
          </span>
          <button
            onClick={() => forceSync()}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
            title="Force immediate refresh of all transactions from central database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span>Sync Live Sales</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Transaction ID (TXN-...), customer or fish item..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="All">All Payment Modes</option>
              <option value="Cash">Cash Payments</option>
              <option value="Bank Transfer">Bank Transfers</option>
              <option value="POS">POS Terminal Card</option>
              <option value="Split Payment">Split Payments</option>
            </select>
          </div>

          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
            >
              <option value="All">All Dates</option>
              <option value="today">Today Only (22 Sep 2026)</option>
            </select>
          </div>

        </div>
      </div>

      {/* View 1: Sales Transactions Table */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Txn ID & Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Cashier</th>
                  <th className="py-3 px-4">Items Summary</th>
                  <th className="py-3 px-4">Subtotal</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Net Total</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Discount Auth</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No sales records found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map(tx => {
                    const customer = customers.find(c => c.customer_id === tx.customer_id);
                    const staff = employees.find(e => e.staff_id === tx.staff_id);

                    return (
                      <tr key={tx.transaction_id} className="hover:bg-slate-50 transition-colors">
                        {/* ID & Date */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900">{tx.transaction_id}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{tx.date_time}</div>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-800">
                            {customer ? customer.full_name : 'Walk-in Customer'}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">{tx.customer_id}</div>
                        </td>

                        {/* Cashier */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium text-slate-700">
                            {staff ? staff.staff_name : tx.staff_id}
                          </span>
                        </td>

                        {/* Items */}
                        <td className="py-3 px-4">
                          {tx.items && tx.items.length > 0 ? (
                            <div className="space-y-0.5">
                              {tx.items.slice(0, 2).map((item, idx) => (
                                <div key={idx} className="text-[11px] text-slate-600 line-clamp-1">
                                  {item.quantity_sold} {item.unit} × {item.item_name}
                                </div>
                              ))}
                              {tx.items.length > 2 && (
                                <div className="text-[10px] text-slate-400 italic">
                                  +{tx.items.length - 2} more items...
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-600">
                              {tx.quantity_sold} KG × {tx.item_name}
                            </div>
                          )}
                        </td>

                        {/* Subtotal */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                          ₦{tx.total_amount.toLocaleString()}
                        </td>

                        {/* Discount */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.discount_applied > 0 ? (
                            <div>
                              <span className="font-bold text-emerald-600 font-mono">
                                -₦{tx.discount_applied.toLocaleString()}
                              </span>
                              <div className="text-[9px] text-slate-400">{tx.discount_reason}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Net Total */}
                        <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-950 font-mono text-sm">
                          ₦{tx.final_amount.toLocaleString()}
                        </td>

                        {/* Payment Method */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.payment_splits && tx.payment_splits.length > 0 ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                Split Payment
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {tx.payment_splits.map(s => `${s.method === 'Bank Transfer' ? 'Transfer' : s.method}: ₦${(s.amount).toLocaleString()}`).join(' + ')}
                              </div>
                            </div>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              tx.payment_method === 'Cash' 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                : tx.payment_method === 'Bank Transfer' 
                                ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}>
                              {tx.payment_method}
                            </span>
                          )}
                        </td>

                        {/* Discount Authorization */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.discount_applied > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {tx.discount_authorized_by || 'Manager Approved'}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No Discount</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => onViewReceipt(tx)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center space-x-1"
                              title="View and reprint receipt"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Receipt</span>
                            </button>

                            <button
                              onClick={() => onOpenRefundForTx(tx)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-semibold flex items-center space-x-1"
                              title="Process return or item refund"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Refund</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: Refunds Log */}
      {activeTab === 'refunds' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50/50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Refund ID</th>
                  <th className="py-3 px-4">Original Txn</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Item Returned</th>
                  <th className="py-3 px-4">Qty Restored</th>
                  <th className="py-3 px-4">Amount Refunded</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Staff Authorized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {refunds.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No customer refunds recorded.
                    </td>
                  </tr>
                ) : (
                  refunds.map(ref => {
                    const staff = employees.find(e => e.staff_id === ref.staff_id);
                    return (
                      <tr key={ref.refund_id} className="hover:bg-rose-50/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-rose-700">
                          {ref.refund_id}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {ref.original_transaction_id}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {ref.date_time}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {customers.find(c => c.customer_id === ref.customer_id)?.full_name || ref.customer_id}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900">{ref.item_name}</span>
                          <span className="font-mono text-[10px] text-slate-400 block">{ref.item_sn}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-700">
                          +{ref.quantity_refunded} KG Restored
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-700">
                          -₦{ref.refund_amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                            {ref.reason}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {staff ? staff.staff_name : ref.staff_id}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
