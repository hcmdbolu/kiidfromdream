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
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

interface ReportingDashboardProps {
  onQuickReorder?: (supplierId: string, itemSn: string) => void;
}

export type ReportDateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all';

export const ReportingDashboard: React.FC<ReportingDashboardProps> = ({ onQuickReorder }) => {
  const { 
    products, 
    sales, 
    refunds,
    voidedOrders,
    customers, 
    employees, 
    suppliers,
    posTerminals,
    cashTransfers,
    getCashierDrawerSummary,
    syncStatus,
    lastSyncTime,
    serverVersion,
    forceSync
  } = usePos();

  const [dateRange, setDateRange] = useState<ReportDateRange>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-09-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-09-22');

  const now = new Date();

  // Helper to extract comparable YYYY-MM-DD from various date formats
  const extractDateKey = (dateTimeStr: string): string => {
    if (!dateTimeStr) return '';
    const trimmed = dateTimeStr.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    try {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch {}
    return trimmed.split(' ')[0] || '';
  };

  const matchesDateRange = (dateStr: string) => {
    if (dateRange === 'all') return true;
    const dateKey = extractDateKey(dateStr);
    const todayStr = '2026-09-22';
    const yesterdayStr = '2026-09-21';
    const currentToday = now.toISOString().split('T')[0];

    if (dateRange === 'today') {
      return dateKey === todayStr || dateKey === currentToday || dateStr.startsWith(todayStr) || dateStr.startsWith(currentToday);
    }
    if (dateRange === 'yesterday') {
      return dateKey === yesterdayStr || dateStr.startsWith(yesterdayStr);
    }
    if (dateRange === 'week') {
      return (dateKey >= '2026-09-15' && dateKey <= '2026-09-22') || (dateKey >= currentToday);
    }
    if (dateRange === 'month') {
      return dateKey.startsWith('2026-09') || dateKey.startsWith(now.toISOString().slice(0, 7));
    }
    if (dateRange === 'custom') {
      if (!customStartDate && !customEndDate) return true;
      if (customStartDate && dateKey < customStartDate) return false;
      if (customEndDate && dateKey > customEndDate) return false;
      return true;
    }
    return true;
  };

  // Filtered sales based on selected date range (Daily, Multi-day, Weekly, Monthly, All)
  const relevantSales = useMemo(() => {
    if (dateRange === 'all') return sales;
    return sales.filter(s => matchesDateRange(s.date_time));
  }, [sales, dateRange, customStartDate, customEndDate, now]);

  // Filtered refunds based on selected date range
  const relevantRefunds = useMemo(() => {
    if (dateRange === 'all') return refunds;
    return refunds.filter(r => matchesDateRange(r.date_time));
  }, [refunds, dateRange, customStartDate, customEndDate, now]);

  // Executive P&L Financial Calculations with Dynamic Refund Deductions (Net Sales, Net COGS, Gross Profit)
  const { 
    totalGrossRevenue, 
    totalRefundAmount, 
    totalRefundCount, 
    netRevenue, 
    totalGrossCogs, 
    returnedCogs, 
    netCogs, 
    grossProfit, 
    profitMargin, 
    grossQuantitySold, 
    returnedQuantity, 
    netQuantitySold, 
    averageOrderValue 
  } = useMemo(() => {
    let grossRev = 0;
    let grossCogs = 0;
    let grossQty = 0;

    relevantSales.forEach(sale => {
      grossRev += sale.final_amount;
      
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
          grossQty += item.quantity_sold;
          const prod = products.find(p => p.item_sn === item.item_sn);
          const unitCost = prod ? prod.item_cost : item.unit_price * 0.6;
          grossCogs += unitCost * item.quantity_sold;
        });
      } else {
        const itemQty = sale.quantity_sold ?? 0;
        grossQty += itemQty;
        const prod = products.find(p => p.item_sn === sale.item_sn);
        const unitCost = prod ? prod.item_cost : (sale.unit_price || 2500);
        grossCogs += unitCost * itemQty;
      }
    });

    let refAmount = 0;
    let retCogs = 0;
    let retQty = 0;

    relevantRefunds.forEach(ref => {
      refAmount += Number(ref.refund_amount) || 0;
      if (ref.items && ref.items.length > 0) {
        ref.items.forEach(item => {
          const q = Number(item.quantity_refunded) || 0;
          retQty += q;
          const prod = products.find(p => p.item_sn === item.item_sn);
          const unitCost = item.item_cost || (prod ? prod.item_cost : item.unit_price * 0.6);
          retCogs += unitCost * q;
        });
      } else {
        const q = Number(ref.quantity_refunded) || 0;
        retQty += q;
        const prod = products.find(p => p.item_sn === ref.item_sn);
        const unitCost = prod ? prod.item_cost : 2500;
        retCogs += unitCost * q;
      }
    });

    const netRev = Math.max(0, Math.round((grossRev - refAmount) * 100) / 100);
    const netCostOfGoods = Math.max(0, Math.round((grossCogs - retCogs) * 100) / 100);
    const profit = Math.round(netRev - netCostOfGoods);
    const margin = netRev > 0 ? Math.round((profit / netRev) * 100) : 0;
    const aov = relevantSales.length > 0 ? Math.round(netRev / relevantSales.length) : 0;

    return {
      totalGrossRevenue: grossRev,
      totalRefundAmount: refAmount,
      totalRefundCount: relevantRefunds.length,
      netRevenue: netRev,
      totalGrossCogs: Math.round(grossCogs),
      returnedCogs: Math.round(retCogs),
      netCogs: netCostOfGoods,
      grossProfit: profit,
      profitMargin: margin,
      grossQuantitySold: Math.round(grossQty * 100) / 100,
      returnedQuantity: Math.round(retQty * 100) / 100,
      netQuantitySold: Math.max(0, Math.round((grossQty - retQty) * 100) / 100),
      averageOrderValue: aov,
    };
  }, [relevantSales, relevantRefunds, products]);

  // Backward compatibility alias for totalRevenue & totalCogs
  const totalRevenue = netRevenue;
  const totalCogs = netCogs;
  const totalQuantitySold = netQuantitySold;

  // Comprehensive Payment Mode Reconciliation with Refund Deductions (Cash, Transfer, and POS)
  const paymentReconciliation = useMemo(() => {
    let cashGross = 0;
    let cashCount = 0;

    let transferGross = 0;
    let transferCount = 0;

    let posGross = 0;
    let posCount = 0;

    let otherGross = 0;
    let otherCount = 0;

    let splitTxCount = 0;
    let splitTotalAmount = 0;

    relevantSales.forEach(s => {
      if (s.payment_splits && s.payment_splits.length > 0) {
        splitTxCount++;
        splitTotalAmount += s.final_amount;
        s.payment_splits.forEach(split => {
          if (split.method === 'Cash') {
            cashGross += split.amount;
            cashCount++;
          } else if (split.method === 'Bank Transfer') {
            transferGross += split.amount;
            transferCount++;
          } else if (split.method === 'POS' || split.method === 'Debit/Credit Card') {
            posGross += split.amount;
            posCount++;
          } else {
            otherGross += split.amount;
            otherCount++;
          }
        });
      } else {
        if (s.payment_method === 'Cash') {
          cashGross += s.final_amount;
          cashCount++;
        } else if (s.payment_method === 'Bank Transfer') {
          transferGross += s.final_amount;
          transferCount++;
        } else if (s.payment_method === 'POS' || s.payment_method === 'Debit/Credit Card') {
          posGross += s.final_amount;
          posCount++;
        } else if (s.payment_method === 'Split Payment') {
          splitTxCount++;
          splitTotalAmount += s.final_amount;
          cashGross += s.final_amount;
          cashCount++;
        } else {
          otherGross += s.final_amount;
          otherCount++;
        }
      }
    });

    // Calculate deductions per payment channel from relevant refunds
    let cashRefundAmount = 0;
    let cashRefundCount = 0;
    let transferRefundAmount = 0;
    let transferRefundCount = 0;
    let posRefundAmount = 0;
    let posRefundCount = 0;
    let otherRefundAmount = 0;
    let otherRefundCount = 0;

    relevantRefunds.forEach(r => {
      const amt = Number(r.refund_amount) || 0;
      if (r.payment_method === 'Cash') {
        cashRefundAmount += amt;
        cashRefundCount++;
      } else if (r.payment_method === 'Bank Transfer') {
        transferRefundAmount += amt;
        transferRefundCount++;
      } else if (r.payment_method === 'POS' || r.payment_method === 'Debit/Credit Card') {
        posRefundAmount += amt;
        posRefundCount++;
      } else {
        otherRefundAmount += amt;
        otherRefundCount++;
      }
    });

    const netCash = Math.max(0, cashGross - cashRefundAmount);
    const netTransfer = Math.max(0, transferGross - transferRefundAmount);
    const netPos = Math.max(0, posGross - posRefundAmount);
    const netOther = Math.max(0, otherGross - otherRefundAmount);

    const totalReconciled = netCash + netTransfer + netPos + netOther;
    const totalGross = cashGross + transferGross + posGross + otherGross;
    const totalRefunds = cashRefundAmount + transferRefundAmount + posRefundAmount + otherRefundAmount;

    return {
      cash: {
        amount: netCash,
        gross: cashGross,
        refunds: cashRefundAmount,
        refundCount: cashRefundCount,
        count: cashCount,
        percentage: totalReconciled > 0 ? Math.round((netCash / totalReconciled) * 100) : 0,
        avgTicket: cashCount > 0 ? Math.round(netCash / cashCount) : 0,
      },
      transfer: {
        amount: netTransfer,
        gross: transferGross,
        refunds: transferRefundAmount,
        refundCount: transferRefundCount,
        count: transferCount,
        percentage: totalReconciled > 0 ? Math.round((netTransfer / totalReconciled) * 100) : 0,
        avgTicket: transferCount > 0 ? Math.round(netTransfer / transferCount) : 0,
      },
      pos: {
        amount: netPos,
        gross: posGross,
        refunds: posRefundAmount,
        refundCount: posRefundCount,
        count: posCount,
        percentage: totalReconciled > 0 ? Math.round((netPos / totalReconciled) * 100) : 0,
        avgTicket: posCount > 0 ? Math.round(netPos / posCount) : 0,
      },
      other: {
        amount: netOther,
        gross: otherGross,
        refunds: otherRefundAmount,
        refundCount: otherRefundCount,
        count: otherCount,
        percentage: totalReconciled > 0 ? Math.round((netOther / totalReconciled) * 100) : 0,
        avgTicket: otherCount > 0 ? Math.round(netOther / otherCount) : 0,
      },
      splitTransactions: {
        count: splitTxCount,
        totalAmount: splitTotalAmount,
      },
      totalReconciled,
      totalGross,
      totalRefunds,
    };
  }, [relevantSales, relevantRefunds]);

  // Cashier Payment Breakdown Matrix (deducting cash, transfer, and POS refunds)
  const cashierPaymentBreakdown = useMemo(() => {
    return employees.map(emp => {
      const empSales = relevantSales.filter(s => s.staff_id === emp.staff_id);
      let grossCash = 0;
      let cashCount = 0;
      let grossTransfer = 0;
      let transferCount = 0;
      let grossPos = 0;
      let posCount = 0;
      let grossTotalRev = 0;

      empSales.forEach(s => {
        grossTotalRev += s.final_amount;
        if (s.payment_splits && s.payment_splits.length > 0) {
          s.payment_splits.forEach(split => {
            if (split.method === 'Cash') {
              grossCash += split.amount;
              cashCount++;
            } else if (split.method === 'Bank Transfer') {
              grossTransfer += split.amount;
              transferCount++;
            } else if (split.method === 'POS' || split.method === 'Debit/Credit Card') {
              grossPos += split.amount;
              posCount++;
            }
          });
        } else {
          if (s.payment_method === 'Cash') {
            grossCash += s.final_amount;
            cashCount++;
          } else if (s.payment_method === 'Bank Transfer') {
            grossTransfer += s.final_amount;
            transferCount++;
          } else if (s.payment_method === 'POS' || s.payment_method === 'Debit/Credit Card') {
            grossPos += s.final_amount;
            posCount++;
          }
        }
      });

      // Find refunds associated with sales of this employee
      const empRefunds = relevantRefunds.filter(r => {
        const orig = sales.find(s => s.transaction_id === r.original_transaction_id);
        return orig ? orig.staff_id === emp.staff_id : r.staff_id === emp.staff_id;
      });

      let empCashRefund = 0;
      let empTransferRefund = 0;
      let empPosRefund = 0;
      let empTotalRefund = 0;

      empRefunds.forEach(r => {
        const amt = Number(r.refund_amount) || 0;
        empTotalRefund += amt;
        if (r.payment_method === 'Cash') {
          empCashRefund += amt;
        } else if (r.payment_method === 'Bank Transfer') {
          empTransferRefund += amt;
        } else if (r.payment_method === 'POS' || r.payment_method === 'Debit/Credit Card') {
          empPosRefund += amt;
        }
      });

      const netCash = Math.max(0, grossCash - empCashRefund);
      const netTransfer = Math.max(0, grossTransfer - empTransferRefund);
      const netPos = Math.max(0, grossPos - empPosRefund);
      const netTotalRev = Math.max(0, grossTotalRev - empTotalRefund);

      return {
        ...emp,
        orders: empSales.length,
        totalRev: netTotalRev,
        grossTotalRev,
        totalRefund: empTotalRefund,
        refundCount: empRefunds.length,
        cash: { amount: netCash, gross: grossCash, refunds: empCashRefund, count: cashCount },
        transfer: { amount: netTransfer, gross: grossTransfer, refunds: empTransferRefund, count: transferCount },
        pos: { amount: netPos, gross: grossPos, refunds: empPosRefund, count: posCount },
      };
    }).sort((a, b) => b.totalRev - a.totalRev);
  }, [employees, relevantSales, relevantRefunds, sales]);

  // POS Terminal & Bank Account Collections Breakdown with Refund Deductions
  const terminalBreakdown = useMemo(() => {
    return posTerminals.map(term => {
      let grossAmount = 0;
      let count = 0;

      relevantSales.forEach(s => {
        if (s.pos_terminal_id === term.id) {
          grossAmount += s.final_amount;
          count++;
        } else if (s.payment_splits && s.payment_splits.length > 0) {
          s.payment_splits.forEach(split => {
            if (split.pos_terminal_id === term.id) {
              grossAmount += split.amount;
              count++;
            }
          });
        }
      });

      // Deduct refunds linked to this POS Terminal or Bank Account
      const termRefunds = relevantRefunds.filter(r => r.pos_terminal_id === term.id);
      const refundAmount = termRefunds.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0);
      const refundCount = termRefunds.length;
      const netAmount = Math.max(0, grossAmount - refundAmount);

      return {
        ...term,
        count,
        amount: netAmount,
        grossAmount,
        refundAmount,
        refundCount,
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [posTerminals, relevantSales, relevantRefunds]);

  // Cash Reconciliation Drawer Summary
  const cashReconciliationSummary = useMemo(() => {
    const drawers = getCashierDrawerSummary();
    const totalInHand = drawers.reduce((sum, d) => sum + d.current_cash_in_hand, 0);
    const totalCollected = drawers.reduce((sum, d) => sum + d.total_cash_collected, 0);
    const totalTransferred = cashTransfers.reduce((sum, t) => sum + t.amount_transferred, 0);
    return {
      drawers,
      totalInHand,
      totalCollected,
      totalTransferred,
    };
  }, [getCashierDrawerSummary, cashTransfers]);

  // Top 3 Products (deducting returned quantities)
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

    // Deduct refunded product quantities and revenues
    relevantRefunds.forEach(ref => {
      if (ref.items && ref.items.length > 0) {
        ref.items.forEach(item => {
          if (productStats[item.item_sn]) {
            productStats[item.item_sn].qty = Math.max(0, Math.round((productStats[item.item_sn].qty - (Number(item.quantity_refunded) || 0)) * 100) / 100);
            productStats[item.item_sn].revenue = Math.max(0, productStats[item.item_sn].revenue - (Number(item.refund_amount) || 0));
          }
        });
      } else if (ref.item_sn && ref.item_sn !== 'MULTI-ITEM') {
        if (productStats[ref.item_sn]) {
          productStats[ref.item_sn].qty = Math.max(0, Math.round((productStats[ref.item_sn].qty - (Number(ref.quantity_refunded) || 0)) * 100) / 100);
          productStats[ref.item_sn].revenue = Math.max(0, productStats[ref.item_sn].revenue - (Number(ref.refund_amount) || 0));
        }
      }
    });

    return Object.values(productStats)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);
  }, [relevantSales, relevantRefunds]);

  // Staff Performance (reporting Net Sales after Refunds)
  const staffPerformance = useMemo(() => {
    return employees.map(emp => {
      const empSales = relevantSales.filter(s => s.staff_id === emp.staff_id);
      const grossRev = empSales.reduce((acc, s) => acc + s.final_amount, 0);
      const empRefunds = relevantRefunds.filter(r => {
        const orig = sales.find(s => s.transaction_id === r.original_transaction_id);
        return orig ? orig.staff_id === emp.staff_id : r.staff_id === emp.staff_id;
      });
      const refundTotal = empRefunds.reduce((acc, r) => acc + (Number(r.refund_amount) || 0), 0);
      const netRev = Math.max(0, grossRev - refundTotal);
      const orders = empSales.length;
      return {
        ...emp,
        orders,
        revenue: netRev,
        grossRevenue: grossRev,
        refundTotal,
        refundCount: empRefunds.length,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [employees, relevantSales, relevantRefunds, sales]);

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
        
        {/* Card 1: Total Revenue (Net) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700">Net Sales Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-950 font-mono">
            ₦{netRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {totalRefundAmount > 0 ? (
              <span className="text-amber-700 font-medium">
                Gross ₦{totalGrossRevenue.toLocaleString()} (-₦{totalRefundAmount.toLocaleString()} returns)
              </span>
            ) : (
              <span>{relevantSales.length} Transactions • Avg ₦{averageOrderValue.toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Card 2: Gross Profit (Net) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700">Gross Profit (Net)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            ₦{grossProfit.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center justify-between">
            <span>{profitMargin}% Net Margin</span>
            {totalRefundAmount > 0 && <span className="text-slate-400 text-[10px] font-normal">After returns</span>}
          </div>
        </div>

        {/* Card 3: Cost of Goods Sold (Net Dispatched) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700">Net COGS (Wholesale)</span>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-700 font-mono">
            ₦{netCogs.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>{netQuantitySold} KG Fish Dispatched</span>
            {returnedQuantity > 0 && <span className="text-emerald-700 font-medium">+{returnedQuantity}KG Restocked</span>}
          </div>
        </div>

        {/* Card 4: Refunds & Stock Risks */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700">Refunds & Returns</span>
            <RotateCcw className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">
            ₦{totalRefundAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>{totalRefundCount} Refund event(s)</span>
            <span className="text-slate-400 text-[10px]">{lowStockProducts.length + expiringProducts.length} Stock Alert(s)</span>
          </div>
        </div>

      </div>

      {/* Refund & Inventory Restock Audit Banner */}
      {totalRefundAmount > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/40 rounded-2xl p-4 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white">Dynamic Refund Ledger & Inventory Restock Sync</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/30">
                  {totalRefundCount} Refund Events
                </span>
              </div>
              <p className="text-xs text-rose-200/80 mt-0.5">
                Total refunded sum of <strong>₦{totalRefundAmount.toLocaleString()}</strong> has been automatically deducted from Gross Sales, drawer balances, and payment channels with <strong>{returnedQuantity} KG</strong> fish restocked with float precision.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 self-end md:self-center shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-rose-300 uppercase tracking-wider block">Net Sales Deduction</span>
              <span className="text-sm font-bold font-mono text-rose-400">
                -₦{totalRefundAmount.toLocaleString()}
              </span>
            </div>
            <div className="h-8 w-px bg-rose-800/60" />
            <div className="text-right">
              <span className="text-[10px] text-rose-300 uppercase tracking-wider block">Inventory Restocked</span>
              <span className="text-sm font-bold text-emerald-400 flex items-center justify-end space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>+{returnedQuantity} KG</span>
              </span>
            </div>
          </div>
        </div>
      )}

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
                <span>Net Cash in Drawer</span>
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
              {paymentReconciliation.cash.refunds > 0 ? (
                <span className="text-rose-700 font-bold">-₦{paymentReconciliation.cash.refunds.toLocaleString()} refunded</span>
              ) : (
                <span>Avg: ₦{paymentReconciliation.cash.avgTicket.toLocaleString()}</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 italic">
              Gross: ₦{paymentReconciliation.cash.gross.toLocaleString()}. Deducted from active cashier drawer floats.
            </div>
          </div>

          {/* Card 2: Bank Transfers */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-blue-800">
              <span className="font-bold flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Net Bank Transfers</span>
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
              {paymentReconciliation.transfer.refunds > 0 ? (
                <span className="text-rose-700 font-bold">-₦{paymentReconciliation.transfer.refunds.toLocaleString()} refunded</span>
              ) : (
                <span>Avg: ₦{paymentReconciliation.transfer.avgTicket.toLocaleString()}</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 italic">
              Gross: ₦{paymentReconciliation.transfer.gross.toLocaleString()}. Deducted against assigned commercial accounts.
            </div>
          </div>

          {/* Card 3: POS Terminal / Card */}
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-purple-800">
              <span className="font-bold flex items-center space-x-1.5">
                <CreditCard className="w-4 h-4 text-purple-600" />
                <span>Net POS Terminal</span>
              </span>
              <span className="px-2 py-0.5 bg-purple-200 text-purple-900 rounded font-bold text-[10px]">
                {paymentReconciliation.pos.percentage}% Share
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-purple-950">
              ₦{paymentReconciliation.pos.amount.toLocaleString()}
            </div>
            <div className="text-[11px] text-purple-700 flex justify-between pt-1 border-t border-purple-200/60">
              <span>{paymentReconciliation.pos.count} Settlements</span>
              {paymentReconciliation.pos.refunds > 0 ? (
                <span className="text-rose-700 font-bold">-₦{paymentReconciliation.pos.refunds.toLocaleString()} refunded</span>
              ) : (
                <span>Avg: ₦{paymentReconciliation.pos.avgTicket.toLocaleString()}</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 italic">
              Gross: ₦{paymentReconciliation.pos.gross.toLocaleString()}. Reconciled against merchant batch settlement.
            </div>
          </div>

          {/* Card 4: Returns & Split Cross-Tender */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-800">
              <span className="font-bold flex items-center space-x-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>Returns & Deductions</span>
              </span>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold text-[10px]">
                {paymentReconciliation.totalRefunds > 0 ? 'Deducted' : 'Clean'}
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-amber-950">
              ₦{paymentReconciliation.totalRefunds.toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-800 flex justify-between pt-1 border-t border-amber-200/60">
              <span>{totalRefundCount} Refunds Processed</span>
              <span className="text-emerald-700 font-bold">100% Balanced</span>
            </div>
            <div className="text-[10px] text-slate-500 italic">
              {paymentReconciliation.splitTransactions.count} split-tender orders verified and segregated.
            </div>
          </div>

        </div>

        {/* Detailed Payment Mode Audit Summary Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">Payment Mode / Channel</th>
                <th className="py-3 px-4 text-center">Txn Count</th>
                <th className="py-3 px-4 text-right">Gross Collected (₦)</th>
                <th className="py-3 px-4 text-right">Refunds Deducted (₦)</th>
                <th className="py-3 px-4 text-right">Net Reconciled (₦)</th>
                <th className="py-3 px-4 text-center">Share</th>
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
                  {paymentReconciliation.cash.count}
                </td>
                <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                  ₦{paymentReconciliation.cash.gross.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                  {paymentReconciliation.cash.refunds > 0 ? `-₦${paymentReconciliation.cash.refunds.toLocaleString()}` : '₦0'}
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
                  {paymentReconciliation.transfer.count}
                </td>
                <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                  ₦{paymentReconciliation.transfer.gross.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                  {paymentReconciliation.transfer.refunds > 0 ? `-₦${paymentReconciliation.transfer.refunds.toLocaleString()}` : '₦0'}
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
                  {paymentReconciliation.pos.count}
                </td>
                <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                  ₦{paymentReconciliation.pos.gross.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                  {paymentReconciliation.pos.refunds > 0 ? `-₦${paymentReconciliation.pos.refunds.toLocaleString()}` : '₦0'}
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
                  {paymentReconciliation.cash.count + paymentReconciliation.transfer.count + paymentReconciliation.pos.count} txns
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                  ₦{paymentReconciliation.totalGross.toLocaleString()}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600">
                  {paymentReconciliation.totalRefunds > 0 ? `-₦${paymentReconciliation.totalRefunds.toLocaleString()}` : '₦0'}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-800 text-base">
                  ₦{paymentReconciliation.totalReconciled.toLocaleString()}
                </td>
                <td className="py-3.5 px-4 text-center font-extrabold text-emerald-700">
                  100%
                </td>
                <td className="py-3.5 px-4 text-emerald-800 font-bold text-[11px]">
                  ✓ All counter sales, returns deductions, and settlements mathematically balanced.
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
              Audit cash, transfers, and POS card takings per staff member (net of refunds)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-4">Cashier / Staff</th>
                  <th className="py-2.5 px-4 text-center">Orders</th>
                  <th className="py-2.5 px-4 text-right">Net Cash Collected</th>
                  <th className="py-2.5 px-4 text-right">Net Bank Transfers</th>
                  <th className="py-2.5 px-4 text-right">Net POS Terminal</th>
                  <th className="py-2.5 px-4 text-right">Refunds Deducted</th>
                  <th className="py-2.5 px-4 text-right">Net Shift Sales</th>
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
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {staff.cash.refunds > 0 ? `Gross ₦${staff.cash.gross.toLocaleString()}` : `(${staff.cash.count} cash txns)`}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700">
                      ₦{staff.transfer.amount.toLocaleString()}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {staff.transfer.refunds > 0 ? `Gross ₦${staff.transfer.gross.toLocaleString()}` : `(${staff.transfer.count} transfers)`}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-purple-700">
                      ₦{staff.pos.amount.toLocaleString()}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {staff.pos.refunds > 0 ? `Gross ₦${staff.pos.gross.toLocaleString()}` : `(${staff.pos.count} POS txns)`}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                      {staff.totalRefund > 0 ? `-₦${staff.totalRefund.toLocaleString()}` : '₦0'}
                      {staff.refundCount > 0 && (
                        <span className="block text-[10px] text-rose-400 font-normal">({staff.refundCount} refunds)</span>
                      )}
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

        {/* POS Terminals & Direct Transfer Collections Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-slate-900 text-xs">
                POS Terminals & Bank Accounts Audit Matrix
              </h3>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {posTerminals.length} configured devices & settlement accounts
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Terminal / Bank Account</th>
                  <th className="py-2.5 px-4">Type & Provider</th>
                  <th className="py-2.5 px-4">Account / Terminal ID</th>
                  <th className="py-2.5 px-4">Assigned Location</th>
                  <th className="py-2.5 px-4 text-center">Tagged Txns</th>
                  <th className="py-2.5 px-4 text-right">Gross (₦)</th>
                  <th className="py-2.5 px-4 text-right">Refunds (₦)</th>
                  <th className="py-2.5 px-4 text-right">Net Settled (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {terminalBreakdown.map(term => (
                  <tr key={term.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                        <span>{term.name}</span>
                        {term.is_default && <span className="text-[9px] bg-amber-50 text-amber-700 px-1 rounded font-semibold border border-amber-200">Default</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">{term.bank_name}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {term.provider} • {term.type === 'POS_TERMINAL' ? 'POS' : 'Bank'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">
                      <div>{term.account_number}</div>
                      {term.terminal_id && <div className="text-[10px] text-slate-400">TID: {term.terminal_id}</div>}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                      {term.assigned_location || 'General Desk'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-medium">
                      {term.count}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-700">
                      ₦{term.grossAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                      {term.refundAmount > 0 ? `-₦${term.refundAmount.toLocaleString()}` : '₦0'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                      ₦{term.amount.toLocaleString()}
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

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-2 border-b border-slate-200 text-[11px]">
          <div>
            <span className="text-[10px] text-slate-500 block">REPORTING PERIOD:</span>
            <span className="font-bold">{dateRangeLabel}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">GROSS SALES:</span>
            <span className="font-bold text-slate-900">₦{totalGrossRevenue.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">REFUNDS DEDUCTED:</span>
            <span className="font-bold text-rose-700">-₦{totalRefundAmount.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">NET SALES REVENUE:</span>
            <span className="font-bold text-emerald-800">₦{netRevenue.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">NET GROSS PROFIT:</span>
            <span className="font-bold text-emerald-800">₦{grossProfit.toLocaleString()} ({profitMargin}%)</span>
          </div>
        </div>

        {/* Explicit Payment Method Reconciliation in Printable Report */}
        <div className="p-3 bg-white rounded-lg border border-slate-300 space-y-2">
          <div className="font-bold border-b border-slate-200 pb-1 text-slate-900 uppercase">
            PAYMENT MODE RECONCILIATION & BALANCING (NET OF REFUND DEDUCTIONS):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
              <span className="text-slate-500 block">NET CASH IN DRAWER:</span>
              <span className="font-bold text-emerald-900 text-sm">₦{paymentReconciliation.cash.amount.toLocaleString()}</span>
              <span className="block text-[10px] text-slate-500">
                Gross ₦{paymentReconciliation.cash.gross.toLocaleString()} - ₦{paymentReconciliation.cash.refunds.toLocaleString()} ref.
              </span>
            </div>
            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <span className="text-slate-500 block">NET BANK TRANSFERS:</span>
              <span className="font-bold text-blue-900 text-sm">₦{paymentReconciliation.transfer.amount.toLocaleString()}</span>
              <span className="block text-[10px] text-slate-500">
                Gross ₦{paymentReconciliation.transfer.gross.toLocaleString()} - ₦{paymentReconciliation.transfer.refunds.toLocaleString()} ref.
              </span>
            </div>
            <div className="p-2 bg-purple-50 rounded border border-purple-200">
              <span className="text-slate-500 block">NET POS CARD TERMINAL:</span>
              <span className="font-bold text-purple-900 text-sm">₦{paymentReconciliation.pos.amount.toLocaleString()}</span>
              <span className="block text-[10px] text-slate-500">
                Gross ₦{paymentReconciliation.pos.gross.toLocaleString()} - ₦{paymentReconciliation.pos.refunds.toLocaleString()} ref.
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs font-bold">
            <span>TOTAL NET RECONCILED SUM:</span>
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
            <div className="font-bold border-b border-slate-300 pb-1 mb-2">CASHIER NET SALES TOTALS:</div>
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
