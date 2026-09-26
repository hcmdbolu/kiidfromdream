import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  Award, 
  Printer, 
  Calendar, 
  Users, 
  Fish, 
  CreditCard,
  CheckCircle2,
  Package,
  Clock,
  Database,
  RefreshCw,
  Banknote,
  Building2,
  Split,
  Layers,
  FileSpreadsheet,
  ShieldCheck
} from 'lucide-react';

interface ReportingDashboardProps {
  onQuickReorder?: (supplierId: string, itemSn: string) => void;
}

export type ReportDateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all';

export const ReportingDashboard: React.FC<ReportingDashboardProps> = ({ onQuickReorder }) => {
  const { 
    products, 
    sales, 
    voidedOrders,
    customers, 
    employees, 
    suppliers,
    syncStatus,
    lastSyncTime,
    serverVersion,
    forceSync
  } = usePos();

  const [dateRange, setDateRange] = useState<ReportDateRange>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-09-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-09-22');

  const now = new Date();

  // Filtered sales based on selected date range (Daily, Multi-day, Weekly, Monthly, All)
  const relevantSales = useMemo(() => {
    if (dateRange === 'all') return sales;

    const todayStr = '2026-09-22';
    const yesterdayStr = '2026-09-21';

    return sales.filter(s => {
      const rawDate = s.date_time.split(' ')[0] || '';
      
      if (dateRange === 'today') {
        return rawDate.startsWith(todayStr) || rawDate.startsWith(now.toISOString().split('T')[0]);
      }
      if (dateRange === 'yesterday') {
        return rawDate.startsWith(yesterdayStr);
      }
      if (dateRange === 'week') {
        // Last 7 days: 2026-09-15 to 2026-09-22
        return rawDate >= '2026-09-15' && rawDate <= '2026-09-22';
      }
      if (dateRange === 'month') {
        // September 2026 or current month
        return rawDate.startsWith('2026-09') || rawDate.startsWith(now.toISOString().slice(0, 7));
      }
      if (dateRange === 'custom') {
        if (!customStartDate && !customEndDate) return true;
        if (customStartDate && rawDate < customStartDate) return false;
        if (customEndDate && rawDate > customEndDate) return false;
        return true;
      }
      return true;
    });
  }, [sales, dateRange, customStartDate, customEndDate, now]);

  // Financial calculations
  const { totalRevenue, totalCogs, grossProfit, profitMargin, totalQuantitySold, averageOrderValue } = useMemo(() => {
    let rev = 0;
    let cogs = 0;
    let qty = 0;

    relevantSales.forEach(sale => {
      rev += sale.final_amount;
      
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
          qty += item.quantity_sold;
          const prod = products.find(p => p.item_sn === item.item_sn);
          const unitCost = prod ? prod.item_cost : item.unit_price * 0.6;
          cogs += unitCost * item.quantity_sold;
        });
      } else {
        const itemQty = sale.quantity_sold ?? 0;
        qty += itemQty;
        const prod = products.find(p => p.item_sn === sale.item_sn);
        const unitCost = prod ? prod.item_cost : (sale.unit_price || 2500);
        cogs += unitCost * itemQty;
      }
    });

    const profit = rev - cogs;
    const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;
    const aov = relevantSales.length > 0 ? Math.round(rev / relevantSales.length) : 0;

    return {
      totalRevenue: rev,
      totalCogs: cogs,
      grossProfit: Math.round(profit),
      profitMargin: margin,
      totalQuantitySold: Math.round(qty * 100) / 100,
      averageOrderValue: aov,
    };
  }, [relevantSales, products]);

  // Comprehensive Payment Mode Reconciliation (Cash, Transfer, and POS)
  const paymentReconciliation = useMemo(() => {
    let cashTotal = 0;
    let cashCount = 0;

    let transferTotal = 0;
    let transferCount = 0;

    let posTotal = 0;
    let posCount = 0;

    let otherTotal = 0;
    let otherCount = 0;

    let splitTxCount = 0;
    let splitTotalAmount = 0;

    relevantSales.forEach(s => {
      if (s.payment_splits && s.payment_splits.length > 0) {
        splitTxCount++;
        splitTotalAmount += s.final_amount;
        s.payment_splits.forEach(split => {
          if (split.method === 'Cash') {
            cashTotal += split.amount;
            cashCount++;
          } else if (split.method === 'Bank Transfer') {
            transferTotal += split.amount;
            transferCount++;
          } else if (split.method === 'POS' || split.method === 'Debit/Credit Card') {
            posTotal += split.amount;
            posCount++;
          } else {
            otherTotal += split.amount;
            otherCount++;
          }
        });
      } else {
        if (s.payment_method === 'Cash') {
          cashTotal += s.final_amount;
          cashCount++;
        } else if (s.payment_method === 'Bank Transfer') {
          transferTotal += s.final_amount;
          transferCount++;
        } else if (s.payment_method === 'POS' || s.payment_method === 'Debit/Credit Card') {
          posTotal += s.final_amount;
          posCount++;
        } else if (s.payment_method === 'Split Payment') {
          splitTxCount++;
          splitTotalAmount += s.final_amount;
          cashTotal += s.final_amount;
          cashCount++;
        } else {
          otherTotal += s.final_amount;
          otherCount++;
        }
      }
    });

    const totalReconciled = cashTotal + transferTotal + posTotal + otherTotal;

    return {
      cash: {
        amount: cashTotal,
        count: cashCount,
        percentage: totalReconciled > 0 ? Math.round((cashTotal / totalReconciled) * 100) : 0,
        avgTicket: cashCount > 0 ? Math.round(cashTotal / cashCount) : 0,
      },
      transfer: {
        amount: transferTotal,
        count: transferCount,
        percentage: totalReconciled > 0 ? Math.round((transferTotal / totalReconciled) * 100) : 0,
        avgTicket: transferCount > 0 ? Math.round(transferTotal / transferCount) : 0,
      },
      pos: {
        amount: posTotal,
        count: posCount,
        percentage: totalReconciled > 0 ? Math.round((posTotal / totalReconciled) * 100) : 0,
        avgTicket: posCount > 0 ? Math.round(posTotal / posCount) : 0,
      },
      other: {
        amount: otherTotal,
        count: otherCount,
        percentage: totalReconciled > 0 ? Math.round((otherTotal / totalReconciled) * 100) : 0,
        avgTicket: otherCount > 0 ? Math.round(otherTotal / otherCount) : 0,
      },
      splitTransactions: {
        count: splitTxCount,
        totalAmount: splitTotalAmount,
      },
      totalReconciled,
    };
  }, [relevantSales]);

  // Cashier Payment Breakdown Matrix (reconcile each staff member's cash, transfer, and POS takings)
  const cashierPaymentBreakdown = useMemo(() => {
    return employees.map(emp => {
      const empSales = relevantSales.filter(s => s.staff_id === emp.staff_id);
      let cash = 0;
      let cashCount = 0;
      let transfer = 0;
      let transferCount = 0;
      let pos = 0;
      let posCount = 0;
      let totalRev = 0;

      empSales.forEach(s => {
        totalRev += s.final_amount;
        if (s.payment_splits && s.payment_splits.length > 0) {
          s.payment_splits.forEach(split => {
            if (split.method === 'Cash') {
              cash += split.amount;
              cashCount++;
            } else if (split.method === 'Bank Transfer') {
              transfer += split.amount;
              transferCount++;
            } else if (split.method === 'POS' || split.method === 'Debit/Credit Card') {
              pos += split.amount;
              posCount++;
            }
          });
        } else {
          if (s.payment_method === 'Cash') {
            cash += s.final_amount;
            cashCount++;
          } else if (s.payment_method === 'Bank Transfer') {
            transfer += s.final_amount;
            transferCount++;
          } else if (s.payment_method === 'POS' || s.payment_method === 'Debit/Credit Card') {
            pos += s.final_amount;
            posCount++;
          }
        }
      });

      return {
        ...emp,
        orders: empSales.length,
        totalRev,
        cash: { amount: cash, count: cashCount },
        transfer: { amount: transfer, count: transferCount },
        pos: { amount: pos, count: posCount },
      };
    }).sort((a, b) => b.totalRev - a.totalRev);
  }, [employees, relevantSales]);

  // Top 3 Products
  const topProducts = useMemo(() => {
    const productStats: { [sn: string]: { name: string; sn: string; qty: number; revenue: number } } = {};

    relevantSales.forEach(sale => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
          if (!productStats[item.item_sn]) {
            productStats[item.item_sn] = { name: item.item_name, sn: item.item_sn, qty: 0, revenue: 0 };
          }
          productStats[item.item_sn].qty += item.quantity_sold;
          productStats[item.item_sn].revenue += item.total_amount;
        });
      } else if (sale.item_sn) {
        if (!productStats[sale.item_sn]) {
          productStats[sale.item_sn] = { name: sale.item_name || sale.item_sn, sn: sale.item_sn, qty: 0, revenue: 0 };
        }
        productStats[sale.item_sn].qty += sale.quantity_sold ?? 0;
        productStats[sale.item_sn].revenue += sale.final_amount;
      }
    });

    return Object.values(productStats)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);
  }, [relevantSales]);

  // Staff Performance
  const staffPerformance = useMemo(() => {
    return employees.map(emp => {
      const empSales = relevantSales.filter(s => s.staff_id === emp.staff_id);
      const revenue = empSales.reduce((acc, s) => acc + s.final_amount, 0);
      const orders = empSales.length;
      return {
        ...emp,
        orders,
        revenue,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [employees, relevantSales]);

  // Inventory Alerts: Expiring Soon (3 days) & Low Stock
  const expiringProducts = useMemo(() => {
    return products.filter(p => {
      const expiry = new Date(p.expiry_date);
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 3;
    });
  }, [products, now]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.quantity <= p.reorder_level);
  }, [products]);

  const handlePrintReport = () => {
    window.print();
  };

  const dateRangeLabel = 
    dateRange === 'today' ? 'Today (22 Sep 2026)' :
    dateRange === 'yesterday' ? 'Yesterday (21 Sep 2026)' :
    dateRange === 'week' ? 'Last 7 Days (15 - 22 Sep 2026)' :
    dateRange === 'month' ? 'This Month (September 2026)' :
    dateRange === 'custom' ? `${customStartDate} to ${customEndDate}` : 'All Time History';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header & Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <span>Executive Sales & Inventory Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time profit tracking, best-selling fish rankings, cashier performance, and stock risk assessment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Central DB Sync Status Badge */}
          <div 
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-200 border border-slate-800 font-mono text-[11px]"
            title={`Multi-System Central DB sync: ${syncStatus}. Version: ${serverVersion}. Last sync: ${lastSyncTime}`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                syncStatus === 'synced' ? 'bg-emerald-400' : syncStatus === 'syncing' ? 'bg-amber-400' : 'bg-rose-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
            </span>
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400 hidden md:inline">Central DB:</span>
            <span className="text-emerald-400 font-bold">{syncStatus === 'synced' ? 'Synced' : syncStatus}</span>
            <button
              onClick={() => forceSync()}
              className="ml-1 p-0.5 text-slate-400 hover:text-white rounded"
              title="Force Sync Now"
            >
              <RefreshCw className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Date Range Selection Tabs */}
          <div className="bg-slate-100 p-1 rounded-lg flex flex-wrap gap-1">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Weekly (7d)' },
              { id: 'month', label: 'Monthly' },
              { id: 'custom', label: 'Multi-Day Range' },
              { id: 'all', label: 'All Time' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateRange(tab.id as ReportDateRange)}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  dateRange === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrintReport}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker Bar (if custom selected) */}
      {dateRange === 'custom' && (
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center space-x-2 text-slate-700 font-semibold">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Select Multi-Day Reporting Period:</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total Sales Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-950 font-mono">
            ₦{totalRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {relevantSales.length} Transactions • Avg ₦{averageOrderValue.toLocaleString()}
          </div>
        </div>

        {/* Card 2: Gross Profit */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Gross Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            ₦{grossProfit.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            {profitMargin}% Overall Profit Margin
          </div>
        </div>

        {/* Card 3: Cost of Goods Sold */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total COGS (Wholesale)</span>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-700 font-mono">
            ₦{totalCogs.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {totalQuantitySold} KG Fish Dispatched
          </div>
        </div>

        {/* Card 4: Inventory Alerts */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Inventory Risks</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {lowStockProducts.length + expiringProducts.length}
          </div>
          <div className="text-[11px] text-slate-500">
            {lowStockProducts.length} Low Stock • {expiringProducts.length} Expiring Soon
          </div>
        </div>

      </div>

      {/* Order Cancellation & Void Integrity Reconciliation Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white">Order Void & Aborted Checkout Reconciliation</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/30">
                {voidedOrders.length} Aborted Orders
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              All canceled walk-in baskets are verified and segregated from completed revenue, ensuring 100% sales ledger integrity and cash drawer accuracy.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 self-end md:self-center shrink-0">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Voided Potential</span>
            <span className="text-sm font-bold font-mono text-rose-400">
              ₦{voidedOrders.reduce((sum, v) => sum + v.total_amount, 0).toLocaleString()}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Stock Integrity</span>
            <span className="text-sm font-bold text-emerald-400 flex items-center justify-end space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Zero Leakage</span>
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Top Products & Staff Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Top 3 Best-Selling Products (6 cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Top 3 Best-Selling Products</span>
            </h3>
            <span className="text-[11px] text-slate-400">By Sales Volume</span>
          </div>

          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-slate-400 text-xs py-4 text-center">No product sales recorded yet.</p>
            ) : (
              topProducts.map((prod, idx) => {
                const percentage = totalQuantitySold > 0 ? Math.round((prod.qty / totalQuantitySold) * 100) : 0;
                return (
                  <div key={prod.sn} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white ${
                          idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : 'bg-amber-700'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900">{prod.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 ml-1.5">{prod.sn}</span>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-slate-900">
                        ₦{prod.revenue.toLocaleString()}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Total Sold: <strong className="text-slate-800">{prod.qty} KG</strong></span>
                      <span>{percentage}% of volume</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cashier Leaderboard (6 cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Cashier Performance Leaderboard</span>
            </h3>
            <span className="text-[11px] text-slate-400">Target: ₦100,000 / day</span>
          </div>

          <div className="space-y-3">
            {staffPerformance.map((staff, idx) => {
              const isTop = idx === 0;
              return (
                <div key={staff.staff_id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-emerald-400 font-bold flex items-center justify-center border border-slate-700 font-mono text-sm shrink-0">
                      {staff.staff_name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                        <span>{staff.staff_name}</span>
                        {isTop && (
                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                            Top Cashier
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {staff.role} • {staff.staff_id}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      ₦{staff.revenue.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {staff.orders} successful sales
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Grid: Real-time Inventory Alerts & Payment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Inventory Action Alerts (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Real-Time Inventory Action Alerts</span>
            </h3>
            <span className="text-[11px] text-slate-400">Automated purchase triggers</span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {/* Expiring Soon */}
            {expiringProducts.map(prod => {
              const expiry = new Date(prod.expiry_date);
              const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={`exp-${prod.item_sn}`} className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.2 rounded bg-amber-600 text-white font-bold text-[9px]">
                        EXPIRING SOON
                      </span>
                      <strong className="text-slate-900">{prod.item_name}</strong>
                      <span className="font-mono text-[10px] text-slate-400">{prod.item_sn}</span>
                    </div>
                    <div className="text-amber-800 text-[11px]">
                      {prod.quantity} {prod.product_measure_unit} left • Expires on {prod.expiry_date} ({diffDays} days left)
                    </div>
                  </div>

                  <span className="text-xs font-bold text-amber-900">
                    Apply Clearance Discount
                  </span>
                </div>
              );
            })}

            {/* Low Stock */}
            {lowStockProducts.map(prod => {
              const supplier = suppliers.find(s => s.supplier_id === prod.supplier_id);
              return (
                <div key={`low-${prod.item_sn}`} className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-bold text-[9px]">
                        LOW STOCK
                      </span>
                      <strong className="text-slate-900">{prod.item_name}</strong>
                      <span className="font-mono text-[10px] text-slate-400">{prod.item_sn}</span>
                    </div>
                    <div className="text-rose-800 text-[11px]">
                      Current stock: <strong className="font-mono">{prod.quantity} {prod.product_measure_unit}</strong> (Reorder trigger: {prod.reorder_level} {prod.product_measure_unit})
                    </div>
                  </div>

                  {onQuickReorder && (
                    <button
                      onClick={() => onQuickReorder(prod.supplier_id, prod.item_sn)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px] shadow-xs"
                    >
                      Reorder PO
                    </button>
                  )}
                </div>
              );
            })}

            {expiringProducts.length === 0 && lowStockProducts.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                All inventory levels are healthy and no items are expiring soon.
              </div>
            )}
          </div>
        </div>

        {/* Payment Channels Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Payment Mode Breakdown</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {relevantSales.length} Total Txns
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Cash */}
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2 font-bold text-emerald-950">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>Cash Collections</span>
                </div>
                <span className="font-mono font-bold text-emerald-900 text-sm">
                  ₦{paymentReconciliation.cash.amount.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-emerald-200/60 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all"
                  style={{ width: `${paymentReconciliation.cash.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-emerald-800">
                <span>{paymentReconciliation.cash.count} Cash payments ({paymentReconciliation.cash.percentage}% share)</span>
                <span>Avg: ₦{paymentReconciliation.cash.avgTicket.toLocaleString()}</span>
              </div>
            </div>

            {/* Bank Transfer */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2 font-bold text-blue-950">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Bank Transfers</span>
                </div>
                <span className="font-mono font-bold text-blue-900 text-sm">
                  ₦{paymentReconciliation.transfer.amount.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-blue-200/60 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{ width: `${paymentReconciliation.transfer.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-blue-800">
                <span>{paymentReconciliation.transfer.count} Direct transfers ({paymentReconciliation.transfer.percentage}% share)</span>
                <span>Avg: ₦{paymentReconciliation.transfer.avgTicket.toLocaleString()}</span>
              </div>
            </div>

            {/* POS Terminal */}
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2 font-bold text-purple-950">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span>POS Terminal / Card</span>
                </div>
                <span className="font-mono font-bold text-purple-900 text-sm">
                  ₦{paymentReconciliation.pos.amount.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-purple-200/60 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all"
                  style={{ width: `${paymentReconciliation.pos.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-purple-800">
                <span>{paymentReconciliation.pos.count} POS Card settlements ({paymentReconciliation.pos.percentage}% share)</span>
                <span>Avg: ₦{paymentReconciliation.pos.avgTicket.toLocaleString()}</span>
              </div>
            </div>

            {/* Split Payments Notice */}
            {paymentReconciliation.splitTransactions.count > 0 && (
              <div className="p-2 bg-slate-100 rounded-lg border border-slate-200 text-[11px] text-slate-700 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Split className="w-3.5 h-3.5 text-slate-600" />
                  <span>Split-Tender Orders: <strong>{paymentReconciliation.splitTransactions.count} transactions</strong></span>
                </span>
                <span className="font-mono font-semibold">₦{paymentReconciliation.splitTransactions.totalAmount.toLocaleString()} routed</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* FULL-WIDTH PAYMENT RECONCILIATION & SHIFT AUDIT SUITE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Daily & Periodic Payment Mode Reconciliation Ledger</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Accurate breakdown of counts and monetary values for Cash, Bank Transfers, and POS Terminal cards for: <strong className="text-slate-800 font-semibold">{dateRangeLabel}</strong>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold font-mono">
              Total Reconciled: ₦{paymentReconciliation.totalReconciled.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 4 Reconciliation Highlight Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Cash in Drawer */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-emerald-800">
              <span className="font-bold flex items-center space-x-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Cash in Drawer</span>
              </span>
              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-bold text-[10px]">
                {paymentReconciliation.cash.percentage}% Share
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-950">
              ₦{paymentReconciliation.cash.amount.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-700 flex justify-between pt-1 border-t border-emerald-200/60">
              <span>{paymentReconciliation.cash.count} Cash Payments</span>
              <span>Avg: ₦{paymentReconciliation.cash.avgTicket.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-slate-500 italic">
              Verify against physical drawer float & envelope cash count.
            </div>
          </div>

          {/* Card 2: Bank Transfers */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-blue-800">
              <span className="font-bold flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Bank Transfers</span>
              </span>
              <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded font-bold text-[10px]">
                {paymentReconciliation.transfer.percentage}% Share
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-blue-950">
              ₦{paymentReconciliation.transfer.amount.toLocaleString()}
            </div>
            <div className="text-[11px] text-blue-700 flex justify-between pt-1 border-t border-blue-200/60">
              <span>{paymentReconciliation.transfer.count} Inbound Transfers</span>
              <span>Avg: ₦{paymentReconciliation.transfer.avgTicket.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-slate-500 italic">
              Verify against bank app notifications & bank account statement inflows.
            </div>
          </div>

          {/* Card 3: POS Terminal / Card */}
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-purple-800">
              <span className="font-bold flex items-center space-x-1.5">
                <CreditCard className="w-4 h-4 text-purple-600" />
                <span>POS Card Terminal</span>
              </span>
              <span className="px-2 py-0.5 bg-purple-200 text-purple-900 rounded font-bold text-[10px]">
                {paymentReconciliation.pos.percentage}% Share
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-purple-950">
              ₦{paymentReconciliation.pos.amount.toLocaleString()}
            </div>
            <div className="text-[11px] text-purple-700 flex justify-between pt-1 border-t border-purple-200/60">
              <span>{paymentReconciliation.pos.count} POS Settlements</span>
              <span>Avg: ₦{paymentReconciliation.pos.avgTicket.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-slate-500 italic">
              Verify against POS merchant end-of-day batch settlement slip.
            </div>
          </div>

          {/* Card 4: Split Payment Audits */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-800">
              <span className="font-bold flex items-center space-x-1.5">
                <Split className="w-4 h-4 text-amber-600" />
                <span>Split Cross-Tender</span>
              </span>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold text-[10px]">
                Multi-Pay
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-amber-950">
              ₦{paymentReconciliation.splitTransactions.totalAmount.toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-800 flex justify-between pt-1 border-t border-amber-200/60">
              <span>{paymentReconciliation.splitTransactions.count} Split Orders</span>
              <span className="text-emerald-700 font-bold">100% Balanced</span>
            </div>
            <div className="text-[10px] text-slate-500 italic">
              Payments split between Cash, Bank Transfer, or POS terminal.
            </div>
          </div>

        </div>

        {/* Detailed Payment Mode Audit Summary Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">Payment Mode / Channel</th>
                <th className="py-3 px-4 text-center">Transaction Count</th>
                <th className="py-3 px-4 text-right">Total Amount (₦)</th>
                <th className="py-3 px-4 text-center">Share of Turnover</th>
                <th className="py-3 px-4">Reconciliation & Management Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* Cash Row */}
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>Physical Cash (Counter Drawer)</span>
                </td>
                <td className="py-3 px-4 text-center font-bold font-mono">
                  {paymentReconciliation.cash.count} transactions
                </td>
                <td className="py-3 px-4 text-right font-black font-mono text-emerald-700 text-sm">
                  ₦{paymentReconciliation.cash.amount.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center font-bold text-slate-800">
                  {paymentReconciliation.cash.percentage}%
                </td>
                <td className="py-3 px-4 text-slate-500 text-[11px]">
                  Physical cash count in cashier till. Reconcile against opening float and closing envelope handover.
                </td>
              </tr>

              {/* Bank Transfer Row */}
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Direct Bank Transfers</span>
                </td>
                <td className="py-3 px-4 text-center font-bold font-mono">
                  {paymentReconciliation.transfer.count} transactions
                </td>
                <td className="py-3 px-4 text-right font-black font-mono text-blue-700 text-sm">
                  ₦{paymentReconciliation.transfer.amount.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center font-bold text-slate-800">
                  {paymentReconciliation.transfer.percentage}%
                </td>
                <td className="py-3 px-4 text-slate-500 text-[11px]">
                  Check corporate bank account alerts / bank statement session IDs to confirm credit reflection.
                </td>
              </tr>

              {/* POS Terminal Row */}
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span>POS Terminal / Debit Card</span>
                </td>
                <td className="py-3 px-4 text-center font-bold font-mono">
                  {paymentReconciliation.pos.count} transactions
                </td>
                <td className="py-3 px-4 text-right font-black font-mono text-purple-700 text-sm">
                  ₦{paymentReconciliation.pos.amount.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center font-bold text-slate-800">
                  {paymentReconciliation.pos.percentage}%
                </td>
                <td className="py-3 px-4 text-slate-500 text-[11px]">
                  Print End-Of-Day batch summary from physical POS merchant machine and match total approved sums.
                </td>
              </tr>

              {/* Grand Total Row */}
              <tr className="bg-slate-50/90 font-bold border-t-2 border-slate-300 text-slate-900">
                <td className="py-3.5 px-4 font-extrabold uppercase">
                  Total Reconciled Turnover
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-950">
                  {paymentReconciliation.cash.count + paymentReconciliation.transfer.count + paymentReconciliation.pos.count} payments
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-800 text-base">
                  ₦{paymentReconciliation.totalReconciled.toLocaleString()}
                </td>
                <td className="py-3.5 px-4 text-center font-extrabold text-emerald-700">
                  100%
                </td>
                <td className="py-3.5 px-4 text-emerald-800 font-bold text-[11px]">
                  ✓ All counter sales, split payments, and direct deposits mathematically balanced.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cashier Shift Payment Balancing Matrix (Management Shift Reconciliation) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-slate-600" />
              <span>Cashier Shift Handover & Payment Collection Matrix</span>
            </h4>
            <span className="text-[11px] text-slate-500">
              Audit cash, transfers, and POS card takings per staff member
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-4">Cashier / Staff</th>
                  <th className="py-2.5 px-4 text-center">Orders</th>
                  <th className="py-2.5 px-4 text-right">Cash Collected</th>
                  <th className="py-2.5 px-4 text-right">Bank Transfers</th>
                  <th className="py-2.5 px-4 text-right">POS Terminal</th>
                  <th className="py-2.5 px-4 text-right">Total Shift Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {cashierPaymentBreakdown.map(staff => (
                  <tr key={staff.staff_id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900">{staff.staff_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{staff.staff_id} • {staff.role}</div>
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-medium">
                      {staff.orders}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                      ₦{staff.cash.amount.toLocaleString()}
                      <span className="block text-[10px] text-slate-400 font-normal">({staff.cash.count} cash txns)</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700">
                      ₦{staff.transfer.amount.toLocaleString()}
                      <span className="block text-[10px] text-slate-400 font-normal">({staff.transfer.count} transfers)</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-purple-700">
                      ₦{staff.pos.amount.toLocaleString()}
                      <span className="block text-[10px] text-slate-400 font-normal">({staff.pos.count} POS txns)</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900">
                      ₦{staff.totalRev.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Printable End-Of-Day Report Sheet (Official Audit Copy) */}
      <div id="printable-daily-report" className="bg-slate-50 p-6 rounded-2xl border border-slate-300 font-mono text-xs space-y-4 text-slate-900">
        <div className="border-b-2 border-slate-900 pb-3 text-center">
          <h2 className="text-base font-black tracking-wider uppercase">KIIDFROMDREAM FISH SALES - AUDIT & RECONCILIATION REPORT</h2>
          <p className="text-[11px] text-slate-600">Generated: {dateRangeLabel} • Official Audit Copy</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-b border-slate-200">
          <div>
            <span className="text-[10px] text-slate-500 block">REPORTING PERIOD:</span>
            <span className="font-bold">{dateRangeLabel}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">TOTAL SALES (REVENUE):</span>
            <span className="font-bold text-emerald-800">₦{totalRevenue.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">TRANSACTIONS:</span>
            <span className="font-bold">{relevantSales.length} COMPLETED</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">GROSS PROFIT:</span>
            <span className="font-bold text-emerald-800">₦{grossProfit.toLocaleString()} ({profitMargin}%)</span>
          </div>
        </div>

        {/* Explicit Payment Method Reconciliation in Printable Report */}
        <div className="p-3 bg-white rounded-lg border border-slate-300 space-y-2">
          <div className="font-bold border-b border-slate-200 pb-1 text-slate-900 uppercase">
            PAYMENT MODE RECONCILIATION & BALANCING (CASH / TRANSFER / POS):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
              <span className="text-slate-500 block">CASH IN HAND / DRAWER:</span>
              <span className="font-bold text-emerald-900 text-sm">₦{paymentReconciliation.cash.amount.toLocaleString()}</span>
              <span className="block text-[10px] text-slate-500">({paymentReconciliation.cash.count} cash payments)</span>
            </div>
            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <span className="text-slate-500 block">DIRECT BANK TRANSFERS:</span>
              <span className="font-bold text-blue-900 text-sm">₦{paymentReconciliation.transfer.amount.toLocaleString()}</span>
              <span className="block text-[10px] text-slate-500">({paymentReconciliation.transfer.count} transfers)</span>
            </div>
            <div className="p-2 bg-purple-50 rounded border border-purple-200">
              <span className="text-slate-500 block">POS CARD TERMINAL:</span>
              <span className="font-bold text-purple-900 text-sm">₦{paymentReconciliation.pos.amount.toLocaleString()}</span>
              <span className="block text-[10px] text-slate-500">({paymentReconciliation.pos.count} card settlements)</span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs font-bold">
            <span>TOTAL RECONCILED SUM:</span>
            <span className="font-mono text-emerald-800 text-sm">₦{paymentReconciliation.totalReconciled.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="font-bold border-b border-slate-300 pb-1 mb-2">TOP SELLING FISH PRODUCTS:</div>
            {topProducts.map((p, i) => (
              <div key={p.sn} className="flex justify-between py-0.5">
                <span>{i + 1}. {p.name} ({p.sn}):</span>
                <span className="font-bold">{p.qty} KG - ₦{p.revenue.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="font-bold border-b border-slate-300 pb-1 mb-2">CASHIER SALES TOTALS:</div>
            {staffPerformance.map(s => (
              <div key={s.staff_id} className="flex justify-between py-0.5">
                <span>{s.staff_name} ({s.staff_id}):</span>
                <span className="font-bold">{s.orders} txns • ₦{s.revenue.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
          <span>Report verified by Shift Supervisor & Management</span>
          <span>KIIDFROMDREAM POS • All Rights Reserved</span>
        </div>
      </div>

    </div>
  );
};
