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
  RefreshCw
} from 'lucide-react';

interface ReportingDashboardProps {
  onQuickReorder?: (supplierId: string, itemSn: string) => void;
}

export const ReportingDashboard: React.FC<ReportingDashboardProps> = ({ onQuickReorder }) => {
  const { 
    products, 
    sales, 
    customers, 
    employees, 
    suppliers,
    syncStatus,
    lastSyncTime,
    serverVersion,
    forceSync
  } = usePos();

  const [dateRange, setDateRange] = useState<'all' | 'today'>('all');

  const now = new Date();

  // Filtered sales based on range
  const relevantSales = useMemo(() => {
    if (dateRange === 'today') {
      return sales.filter(s => s.date_time.startsWith('2026-09-22'));
    }
    return sales;
  }, [sales, dateRange]);

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
      grossProfit: profit,
      profitMargin: margin,
      totalQuantitySold: qty,
      averageOrderValue: aov,
    };
  }, [relevantSales, products]);

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

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    const methods: { [m: string]: number } = {
      'Cash': 0,
      'Debit/Credit Card': 0,
      'Mobile Money': 0,
      'Bank Transfer': 0,
    };
    relevantSales.forEach(s => {
      methods[s.payment_method] = (methods[s.payment_method] || 0) + s.final_amount;
    });
    return methods;
  }, [relevantSales]);

  // Inventory Alerts: Expiring Soon (3 days) & Low Stock
  const expiringProducts = useMemo(() => {
    return products.filter(p => {
      const expiry = new Date(p.expiry_date);
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 3;
    });
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.quantity <= p.reorder_level);
  }, [products]);

  const handlePrintReport = () => {
    window.print();
  };

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

          <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
            <button
              onClick={() => setDateRange('all')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                dateRange === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setDateRange('today')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                dateRange === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Today (22 Sep 2026)
            </button>
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

        {/* Payment Channels (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-slate-700" />
              <span>Revenue by Payment Channel</span>
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            {Object.entries(paymentBreakdown).map(([method, amount]) => {
              const pct = totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0;
              return (
                <div key={method} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-800">{method}</span>
                    <span className="font-mono font-bold text-slate-900">₦{amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-slate-800 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{pct}% of Total Turnover</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Printable End-Of-Day Report Sheet (Section 2.6 Spec Compliant) */}
      <div id="printable-daily-report" className="bg-slate-50 p-6 rounded-2xl border border-slate-300 font-mono text-xs space-y-4 text-slate-900">
        <div className="border-b-2 border-slate-900 pb-3 text-center">
          <h2 className="text-base font-black tracking-wider uppercase">KIIDFROMDREAM FISH SALES - DAILY REPORT</h2>
          <p className="text-[11px] text-slate-600">Generated: 22 September 2026 • Official Audit Copy</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-b border-slate-200">
          <div>
            <span className="text-[10px] text-slate-500 block">DATE:</span>
            <span className="font-bold">22-SEP-2026</span>
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
          <span>Report verified by Shift Supervisor</span>
          <span>KIIDFROMDREAM POS • All Rights Reserved</span>
        </div>
      </div>

    </div>
  );
};
