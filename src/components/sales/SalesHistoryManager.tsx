import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { SaleTransaction, RefundRecord, VoidedOrderRecord } from '../../types';
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
  Wifi,
  Trash2,
  ShieldCheck,
  Ban,
  X,
  Fish
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
    voidedOrders,
    customers, 
    employees, 
    activeStaff,
    posTerminals,
    syncStatus, 
    lastSyncTime, 
    serverVersion, 
    forceSync 
  } = usePos();

  const canRefund = activeStaff.role === 'Manager' || activeStaff.role === 'Admin';

  const [activeTab, setActiveTab] = useState<'sales' | 'refunds' | 'voided'>('sales');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('All');
  const [terminalFilter, setTerminalFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');
  const [voidReasonFilter, setVoidReasonFilter] = useState<string>('All');
  const [selectedVoidRecord, setSelectedVoidRecord] = useState<VoidedOrderRecord | null>(null);

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(tx => {
      const matchSearch =
        tx.transaction_id.toLowerCase().includes(search.toLowerCase()) ||
        tx.customer_id.toLowerCase().includes(search.toLowerCase()) ||
        (tx.item_name && tx.item_name.toLowerCase().includes(search.toLowerCase())) ||
        (tx.pos_terminal_name && tx.pos_terminal_name.toLowerCase().includes(search.toLowerCase())) ||
        (tx.bank_name && tx.bank_name.toLowerCase().includes(search.toLowerCase())) ||
        (tx.payment_reference && tx.payment_reference.toLowerCase().includes(search.toLowerCase()));

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

      let matchTerminal = true;
      if (terminalFilter !== 'All') {
        matchTerminal = tx.pos_terminal_id === terminalFilter || Boolean(tx.payment_splits?.some(s => s.pos_terminal_id === terminalFilter));
      }

      let matchDate = true;
      if (dateFilter === 'today') {
        matchDate = tx.date_time.startsWith('2026-09-22');
      }

      return matchSearch && matchPayment && matchTerminal && matchDate;
    });
  }, [sales, search, paymentFilter, terminalFilter, dateFilter]);

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
          <button
            onClick={() => setActiveTab('voided')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 ${
              activeTab === 'voided'
                ? 'bg-white text-rose-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-rose-700'
            }`}
          >
            <span>Voided Orders</span>
            {voidedOrders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                {voidedOrders.length}
              </span>
            )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search TXN ID, customer, fish item, or POS terminal..."
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
              value={terminalFilter}
              onChange={(e) => setTerminalFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="All">All POS Terminals / Banks</option>
              {posTerminals.map(term => (
                <option key={term.id} value={term.id}>
                  {term.name} ({term.provider})
                </option>
              ))}
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
                            <div className="space-y-0.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                tx.payment_method === 'Cash' 
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                  : tx.payment_method === 'Bank Transfer' 
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                                  : 'bg-slate-100 text-slate-800 border border-slate-200'
                              }`}>
                                {tx.payment_method}
                              </span>
                              {tx.pos_terminal_name && (
                                <div className="text-[10px] text-purple-700 font-medium font-mono">
                                  {tx.pos_terminal_name}
                                </div>
                              )}
                              {tx.bank_name && !tx.pos_terminal_name && (
                                <div className="text-[10px] text-blue-700 font-medium font-mono">
                                  {tx.bank_name}
                                </div>
                              )}
                              {tx.payment_reference && tx.payment_reference !== 'CASH-DRAWER' && (
                                <div className="text-[9px] text-slate-400 font-mono">
                                  Ref: {tx.payment_reference}
                                </div>
                              )}
                            </div>
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

                            {canRefund && (
                              <button
                                onClick={() => onOpenRefundForTx(tx)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-semibold flex items-center space-x-1"
                                title="Process return or item refund (Manager/Admin)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Refund</span>
                              </button>
                            )}
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

      {/* View 3: Canceled & Voided Orders Log */}
      {activeTab === 'voided' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Voided Orders
              </span>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                {voidedOrders.length}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Aborted walk-in checkouts</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Aborted Value
              </span>
              <div className="text-xl font-bold font-mono text-rose-600 mt-1">
                ₦{voidedOrders.reduce((sum, v) => sum + v.total_amount, 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Excluded from gross revenue</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Inventory Stock Protection
              </span>
              <div className="text-xl font-bold text-emerald-600 mt-1 flex items-center space-x-1.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>100% Intact</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Zero discrepancies caused</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Top Abort Reason
              </span>
              <div className="text-sm font-bold text-slate-800 mt-1 truncate">
                {voidedOrders.length > 0 ? voidedOrders[0].void_reason : 'None'}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Logged in audit ledger</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voided orders by Void ID, Order label, customer, or items..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 whitespace-nowrap">Filter Reason:</span>
              <select
                value={voidReasonFilter}
                onChange={(e) => setVoidReasonFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
              >
                <option value="All">All Reasons</option>
                <option value="walked away">Customer walked away</option>
                <option value="declined">Payment declined</option>
                <option value="timed out">Bank transfer timed out</option>
                <option value="mistake">Cashier mistake / wrong item</option>
                <option value="dispute">Pricing dispute</option>
              </select>
            </div>
          </div>

          {/* Voided Orders Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-rose-50/60 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Void ID</th>
                    <th className="py-3 px-4">Order Label</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Cashier / Staff</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items Breakdown</th>
                    <th className="py-3 px-4">Aborted Amount</th>
                    <th className="py-3 px-4">Cancellation Reason</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {voidedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No canceled or voided orders on record.
                      </td>
                    </tr>
                  ) : (
                    voidedOrders
                      .filter(v => {
                        const s = search.toLowerCase();
                        const matchesSearch = 
                          v.void_id.toLowerCase().includes(s) ||
                          v.order_label.toLowerCase().includes(s) ||
                          v.customer_name.toLowerCase().includes(s) ||
                          v.void_reason.toLowerCase().includes(s) ||
                          v.items.some(i => i.item_name.toLowerCase().includes(s));
                        
                        let matchesReason = true;
                        if (voidReasonFilter !== 'All') {
                          matchesReason = v.void_reason.toLowerCase().includes(voidReasonFilter.toLowerCase());
                        }

                        return matchesSearch && matchesReason;
                      })
                      .map(v => (
                        <tr key={v.void_id} className="hover:bg-rose-50/20 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-rose-700">
                            {v.void_id}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {v.order_label}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {v.date_time}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800">{v.voided_by_staff_name}</span>
                            <span className="text-[10px] text-slate-400 block">{v.voided_by_role}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {v.customer_name}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {v.items.length === 0 ? (
                                <span className="text-slate-400 italic">Empty Basket</span>
                              ) : (
                                v.items.slice(0, 2).map((item, idx) => (
                                  <span key={idx} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                                    {item.quantity_sold}{item.unit} {item.item_name}
                                  </span>
                                ))
                              )}
                              {v.items.length > 2 && (
                                <span className="text-[10px] text-slate-400">+{v.items.length - 2} more</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-rose-600">
                            ₦{v.total_amount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-medium inline-block">
                              {v.void_reason}
                            </span>
                            {v.void_notes && (
                              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1 italic">
                                "{v.void_notes}"
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedVoidRecord(v)}
                              className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center space-x-1 mx-auto"
                            >
                              <Eye className="w-3 h-3 text-slate-500" />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Void Details Modal */}
      {selectedVoidRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-fadeIn">
            <div className="bg-rose-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Trash2 className="w-5 h-5 text-white" />
                <div>
                  <h3 className="font-bold text-base">Voided Order Audit Record</h3>
                  <span className="text-xs text-rose-100 font-mono">{selectedVoidRecord.void_id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoidRecord(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Order Label</span>
                  <span className="font-bold text-slate-900">{selectedVoidRecord.order_label}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Date & Time</span>
                  <span className="font-mono text-slate-700">{selectedVoidRecord.date_time}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Cashier Operator</span>
                  <span className="font-semibold text-slate-800">{selectedVoidRecord.voided_by_staff_name} ({selectedVoidRecord.voided_by_role})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Customer</span>
                  <span className="font-semibold text-slate-800">{selectedVoidRecord.customer_name}</span>
                </div>
              </div>

              {/* Reason */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
                  Cancellation Reason
                </span>
                <p className="font-semibold text-rose-900">{selectedVoidRecord.void_reason}</p>
                {selectedVoidRecord.void_notes && (
                  <p className="text-[11px] text-rose-700 italic mt-1">
                    Notes: {selectedVoidRecord.void_notes}
                  </p>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Aborted Basket Items ({selectedVoidRecord.items.length})
                </span>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                  {selectedVoidRecord.items.map((item, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <Fish className="w-3.5 h-3.5 text-emerald-600" />
                        <div>
                          <span className="font-semibold text-slate-800">{item.item_name}</span>
                          <span className="text-[10px] text-slate-400 block">{item.quantity_sold} {item.unit} @ ₦{item.unit_price.toLocaleString()}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-800">₦{item.total_amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between font-bold text-xs text-slate-900 px-1">
                  <span>Total Potential Amount:</span>
                  <span className="font-mono text-rose-600 text-sm">₦{selectedVoidRecord.total_amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Inventory status */}
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center space-x-2 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All items were preserved in inventory stock. Discrepancy prevented.</span>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedVoidRecord(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close Audit Detail
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
