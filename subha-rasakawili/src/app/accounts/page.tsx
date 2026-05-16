import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { BookOpen, Calendar, Download, Scale, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { ExpenseCategory, Ingredient, Receipt, ExpensePurchase, ExpenseGeneral, Supplier, StockMovement, SupplierTransaction } from '../../types';
import { cn, formatLKR } from '../../lib/utils';
import { toast } from 'sonner';

type Period = 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'ALL_TIME';
type TabKey = 'income' | 'balance' | 'trial';

const PERIOD_LABELS: Record<Period, string> = {
  THIS_MONTH: 'This Month',
  LAST_MONTH: 'Last Month',
  THIS_YEAR: 'This Year',
  ALL_TIME: 'All Time',
};

function getPeriodBounds(period: Period) {
  const now = new Date();
  if (period === 'ALL_TIME') return { start: null as Date | null, end: null as Date | null };
  if (period === 'THIS_MONTH') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
  if (period === 'LAST_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end };
  }
  return { start: new Date(now.getFullYear(), 0, 1), end: now };
}

function isWithinPeriod(value: string | undefined, bounds: { start: Date | null; end: Date | null }) {
  if (!value || (!bounds.start && !bounds.end)) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (bounds.start && date < bounds.start) return false;
  if (bounds.end && date >= bounds.end) return false;
  return true;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export default function Accounts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [purchases, setPurchases] = useState<ExpensePurchase[]>([]);
  const [expenses, setExpenses] = useState<ExpenseGeneral[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>([]);
  const [period, setPeriod] = useState<Period>('THIS_MONTH');
  const [activeTab, setActiveTab] = useState<TabKey>('income');
  const [loading, setLoading] = useState(true);
  const statementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [receiptSnap, purchaseSnap, expenseSnap, ingredientSnap, supplierSnap, stockMovementSnap, supplierTransactionSnap] = await Promise.all([
        getDocs(collection(db, 'receipts')),
        getDocs(collection(db, 'expense_purchases')),
        getDocs(collection(db, 'expense_general')),
        getDocs(collection(db, 'ingredients')),
        getDocs(collection(db, 'suppliers')),
        getDocs(collection(db, 'stock_movements')),
        getDocs(collection(db, 'supplier_transactions')),
      ]);

      setReceipts(receiptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Receipt)));
      setPurchases(purchaseSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpensePurchase)));
      setExpenses(expenseSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpenseGeneral)));
      setIngredients(ingredientSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Ingredient)));
      setSuppliers(supplierSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Supplier)));
      setStockMovements(stockMovementSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StockMovement)));
      setSupplierTransactions(supplierTransactionSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SupplierTransaction)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'accounts');
    } finally {
      setLoading(false);
    }
  }

  const accounting = useMemo(() => {
    const bounds = getPeriodBounds(period);

    const validReceipts = receipts.filter((receipt) => !receipt.isReversed);
    const validPurchases = purchases.filter((purchase) => !purchase.isReversed);
    const validExpenses = expenses;

    const latestStockByIngredient = stockMovements.reduce<Record<string, StockMovement>>((acc, movement) => {
      const existing = acc[movement.ingredientId];
      if (!existing || new Date(movement.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        acc[movement.ingredientId] = movement;
      }
      return acc;
    }, {});

    const latestSupplierBalanceBySupplier = supplierTransactions.reduce<Record<string, SupplierTransaction>>((acc, transaction) => {
      const existing = acc[transaction.supplierId];
      if (!existing || new Date(transaction.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        acc[transaction.supplierId] = transaction;
      }
      return acc;
    }, {});

    const filteredReceipts = validReceipts.filter((receipt) => isWithinPeriod(receipt.saleDate || receipt.createdAt, bounds));
    const filteredPurchases = validPurchases.filter((purchase) => isWithinPeriod(purchase.purchaseDate || purchase.createdAt, bounds));
    const filteredExpenses = validExpenses.filter((expense) => isWithinPeriod(expense.expenseDate, bounds));

    const revenue = sum(filteredReceipts.map((receipt) => Number(receipt.totalAmount || 0)));
    const cogs = sum(filteredPurchases.map((purchase) => Number(purchase.totalAmount || 0)));
    const operatingExpenseTotal = sum(filteredExpenses.map((expense) => Number(expense.amount || 0)));

    const expenseByCategory = (Object.entries(
      filteredExpenses.reduce((acc: Record<string, number>, expense) => {
        const key = String(expense.category || ExpenseCategory.OTHER);
        acc[key] = (acc[key] || 0) + Number(expense.amount || 0);
        return acc;
      }, {})
    ) as Array<[string, number]>)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - operatingExpenseTotal;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    const totalSalesToDate = sum(validReceipts.map((receipt) => Number(receipt.totalAmount || 0)));
    const inventoryValue = sum(ingredients.map((ingredient) => {
      const currentStock = Number(latestStockByIngredient[ingredient.id]?.balanceAfter ?? ingredient.currentStock ?? 0);
      return currentStock * Number(ingredient.currentUnitCost || 0);
    }));
    const cashReceivables = totalSalesToDate;
    const totalAssets = inventoryValue + cashReceivables;
    const supplierPayables = sum(suppliers.map((supplier) => Number(latestSupplierBalanceBySupplier[supplier.id]?.balanceAfter ?? supplier.outstandingBalance ?? 0)));
    const totalLiabilities = supplierPayables;
    const retainedEarnings = totalAssets - totalLiabilities;

    const allTimeCogs = sum(validPurchases.map((purchase) => Number(purchase.totalAmount || 0)));
    const allTimeOperatingExpenseTotal = sum(validExpenses.map((expense) => Number(expense.amount || 0)));
    const debitBase = allTimeCogs + allTimeOperatingExpenseTotal + inventoryValue;
    const creditBase = totalSalesToDate + supplierPayables;
    const balancingAmount = Math.abs(debitBase - creditBase);
    const balancingSide: 'debit' | 'credit' = debitBase > creditBase ? 'credit' : 'debit';

    const trialRows: Array<{ accountName: string; debit: number; credit: number }> = [
      { accountName: 'Sales Revenue', debit: 0, credit: totalSalesToDate },
      { accountName: 'Material Purchases', debit: allTimeCogs, credit: 0 },
      ...Object.entries(
        validExpenses.reduce((acc: Record<string, number>, expense) => {
          const key = String(expense.category || ExpenseCategory.OTHER);
          acc[key] = (acc[key] || 0) + Number(expense.amount || 0);
          return acc;
        }, {})
      )
        .map(([category, amount]) => ({ accountName: `General Expense - ${category.replace('_', ' ')}`, debit: amount, credit: 0 }))
        .sort((a, b) => b.debit - a.debit),
      { accountName: 'Inventory Asset', debit: inventoryValue, credit: 0 },
      { accountName: 'Supplier Payables', debit: 0, credit: supplierPayables },
      {
        accountName: 'Net Profit / Loss (Balancing Entry)',
        debit: balancingSide === 'debit' ? balancingAmount : 0,
        credit: balancingSide === 'credit' ? balancingAmount : 0,
      },
    ];

    const debitTotal = sum(trialRows.map((row) => row.debit));
    const creditTotal = sum(trialRows.map((row) => row.credit));

    return {
      revenue,
      cogs,
      operatingExpenseTotal,
      expenseByCategory,
      grossProfit,
      grossMargin,
      netProfit,
      netMargin,
      inventoryValue,
      cashReceivables,
      totalAssets,
      supplierPayables,
      totalLiabilities,
      retainedEarnings,
      trialRows,
      debitTotal,
      creditTotal,
    };
  }, [receipts, purchases, expenses, ingredients, suppliers, period]);

  const exportPDF = async () => {
    if (!statementRef.current) return;
    const toastId = toast.loading('Generating PDF...');

    try {
      const canvas = await html2canvas(statementRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const suffix = activeTab === 'income' ? 'P_L' : 'Trial_Balance';
      pdf.save(`Subha_Rasakawili_${suffix}_${new Date().toLocaleDateString()}.pdf`);
      toast.success('PDF exported successfully', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF', { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-slate-100 rounded-xl w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((row) => <div key={row} className="h-24 bg-slate-100 rounded-2xl" />)}
        </div>
        <div className="h-96 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Final Accounts</h1>
          <p className="text-slate-500 mt-1">Structured accounting statements for management review.</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="w-44">
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger className="bg-white">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {activeTab !== 'balance' && (
            <Button onClick={exportPDF} className="bg-slate-900 shadow-lg shadow-slate-200">
              <Download className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === 'income'} onClick={() => setActiveTab('income')} icon={BookOpen} label="Income Statement" />
        <TabButton active={activeTab === 'balance'} onClick={() => setActiveTab('balance')} icon={Scale} label="Balance Sheet" />
        <TabButton active={activeTab === 'trial'} onClick={() => setActiveTab('trial')} icon={FileText} label="Trial Balance" />
      </div>

      {activeTab === 'income' && (
        <div ref={statementRef} className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <StatementHeader title="Income Statement" subtitle={`Period: ${PERIOD_LABELS[period]}`} />
          <Table>
            <TableBody>
              <SectionRow label="Revenue" />
              <ValueRow label="Total Sales Income" value={accounting.revenue} />
              <SubtotalRow label="Revenue" value={accounting.revenue} />

              <SectionRow label="Less: Cost of Goods Sold" />
              <ValueRow label="Material Purchases" value={accounting.cogs} negative />
              <SubtotalRow label="Gross Profit" value={accounting.grossProfit} highlight />
              <ValueRow label="Gross Margin %" value={`${accounting.grossMargin.toFixed(2)}%`} isText />

              <SectionRow label="Less: Operating Expenses" />
              {accounting.expenseByCategory.length > 0 ? accounting.expenseByCategory.map((row) => (
                <TableRow key={row.category} className="border-slate-50">
                  <TableCell className="pl-6 text-slate-700">{row.category.replace('_', ' ')}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">({formatLKR(row.amount)})</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-slate-400">No operating expenses recorded for this period.</TableCell>
                </TableRow>
              )}
              <SubtotalRow label="Net Profit / (Loss)" value={accounting.netProfit} highlight />
              <ValueRow label="Net Margin %" value={`${accounting.netMargin.toFixed(2)}%`} isText />
            </TableBody>
          </Table>
        </div>
      )}

      {activeTab === 'balance' && (
        <div className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <StatementHeader title="Balance Sheet" subtitle={`Period: ${PERIOD_LABELS[period]}`} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold text-slate-900">Assets</h3>
                  <Badge variant="outline">Current</Badge>
                </div>
                <Table>
                  <TableBody>
                    <ValueRow label="Inventory Asset" value={accounting.inventoryValue} />
                    <ValueRow label="Cash / Receivables" value={accounting.cashReceivables} />
                    <SubtotalRow label="Total Assets" value={accounting.totalAssets} highlight />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold text-slate-900">Liabilities & Equity</h3>
                  <Badge variant="outline">Current</Badge>
                </div>
                <Table>
                  <TableBody>
                    <ValueRow label="Supplier Payables" value={accounting.supplierPayables} negative />
                    <SubtotalRow label="Total Liabilities" value={accounting.totalLiabilities} />
                    <ValueRow label="Retained Earnings" value={accounting.retainedEarnings} />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'trial' && (
        <div ref={statementRef} className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <StatementHeader title="Trial Balance" subtitle={`Period: ${PERIOD_LABELS[period]}`} />
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50 border-slate-100">
                <TableHead className="font-semibold">Account Name</TableHead>
                <TableHead className="text-right font-semibold">Debit (LKR)</TableHead>
                <TableHead className="text-right font-semibold">Credit (LKR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounting.trialRows.map((row) => (
                <TableRow key={row.accountName} className="border-slate-50">
                  <TableCell className={cn('text-slate-700', row.accountName.includes('General Expense') ? 'pl-6' : '')}>{row.accountName}</TableCell>
                  <TableCell className={cn('text-right font-medium', row.debit > 0 ? 'text-slate-900' : 'text-slate-400')}>
                    {row.debit > 0 ? formatLKR(row.debit) : '-'}
                  </TableCell>
                  <TableCell className={cn('text-right font-medium', row.credit > 0 ? 'text-slate-900' : 'text-slate-400')}>
                    {row.credit > 0 ? formatLKR(row.credit) : '-'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-slate-900 font-black">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatLKR(accounting.debitTotal)}</TableCell>
                <TableCell className="text-right">{formatLKR(accounting.creditTotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
        active ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function StatementHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function SectionRow({ label }: { label: string }) {
  return (
    <TableRow className="bg-slate-50/80 border-slate-100 hover:bg-slate-50/80">
      <TableCell colSpan={2} className="font-bold text-slate-700 uppercase tracking-wider text-xs">
        {label}
      </TableCell>
    </TableRow>
  );
}

function ValueRow({ label, value, negative = false, indent = false, isText = false }: { label: string; value: number | string; negative?: boolean; indent?: boolean; isText?: boolean }) {
  const numericValue = typeof value === 'number' ? value : null;
  return (
    <TableRow className="border-slate-50">
      <TableCell className={cn('text-slate-700', indent ? 'pl-6' : '')}>{label}</TableCell>
      <TableCell className={cn('text-right font-medium', negative ? 'text-red-600' : 'text-slate-900')}>
        {isText ? value : numericValue !== null ? (negative ? `(${formatLKR(numericValue)})` : formatLKR(numericValue)) : value}
      </TableCell>
    </TableRow>
  );
}

function SubtotalRow({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <TableRow className={cn('border-t border-slate-200', highlight ? 'font-black' : 'font-semibold')}>
      <TableCell className="text-slate-900">{label}</TableCell>
      <TableCell className={cn('text-right', highlight ? 'text-slate-900' : 'text-slate-700')}>
        {formatLKR(value)}
      </TableCell>
    </TableRow>
  );
}
