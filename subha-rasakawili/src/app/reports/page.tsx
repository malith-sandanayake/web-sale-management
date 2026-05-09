import { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Download, Calendar, TrendingUp, TrendingDown, PieChart as PieChartIcon, FileText } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { formatLKR, cn } from '../../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { CHART_COLORS } from '../../lib/chartColors';

export default function Reports() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);
  const COLORS = CHART_COLORS;

  useEffect(() => {
    fetchReportData();
  }, []);

  async function fetchReportData() {
    try {
      const receiptsSnap = await getDocs(collection(db, 'receipts'));
      const purchasesSnap = await getDocs(collection(db, 'expense_purchases'));
      const generalExpSnap = await getDocs(collection(db, 'expense_general'));

      let income = 0;
      receiptsSnap.forEach((d) => {
        const data = d.data();
        if (!data.isReversed) income += Number(data.totalAmount || 0);
      });

      let materialCosts = 0;
      purchasesSnap.forEach((d) => {
        const data = d.data();
        if (!data.isReversed) materialCosts += Number(data.totalAmount || 0);
      });

      let generalCosts = 0;
      const genericExpByCategory: Record<string, number> = {};
      generalExpSnap.forEach((d) => {
        const data = d.data();
        const amount = Number(data.amount || 0);
        generalCosts += amount;
        const category = String(data.category || 'UNCATEGORIZED');
        genericExpByCategory[category] = (genericExpByCategory[category] || 0) + amount;
      });

      const expenseBreakdown = Object.entries(genericExpByCategory)
        .map(([category, amount]) => ({ category, amount: Number(amount) }))
        .sort((a, b) => b.amount - a.amount);

      setReportData({
        totalIncome: income,
        totalMaterialPurchase: materialCosts,
        totalGeneralExpense: generalCosts,
        totalExpenses: materialCosts + generalCosts,
        netProfit: income - (materialCosts + generalCosts),
        expenseBreakdown,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'reports');
    } finally {
      setLoading(false);
    }
  }

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const toastId = toast.loading('Generating PDF...');
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`SweetBiz_Report_${new Date().toLocaleDateString()}.pdf`);
      toast.success('PDF exported successfully', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF', { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 pt-10">
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Financial Reports</h1>
          <p className="text-slate-500 mt-1">Export detailed performance insights.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-white">
            <Calendar className="w-4 h-4 mr-2" /> Last 30 Days
          </Button>
          <Button onClick={exportPDF} size="sm" className="bg-slate-900 shadow-lg shadow-slate-200">
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        </div>
      </div>

      <div ref={reportRef} id="report-content" className="space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-start border-b pb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 underline decoration-amber-500/30 underline-offset-8">Business Summary Report</h2>
            <p className="text-sm text-slate-500 mt-2">Generated on {new Date().toLocaleString('en-GB', { dateStyle: 'full' })}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black text-slate-900">SweetBiz Manager</p>
            <p className="text-xs text-slate-400">Sri Lanka Traditional Food Mfg.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <ReportStat
            label="Total Revenue"
            value={formatLKR(reportData.totalIncome)}
            icon={TrendingUp}
            color="emerald"
          />
          <ReportStat
            label="Total Expenses"
            value={formatLKR(reportData.totalExpenses)}
            icon={TrendingDown}
            color="red"
          />
          <div className={cn(
            'p-6 rounded-2xl flex flex-col justify-between border-2',
            reportData.netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
          )}>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Net Profit / Loss</p>
            <h3 className={cn(
              'text-3xl font-black mt-2',
              reportData.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
            )}>
              {formatLKR(reportData.netProfit)}
            </h3>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 pt-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <h4 className="font-bold text-slate-800">Operational Breakdown</h4>
            </div>
            <Table>
              <TableBody>
                <TableRow className="hover:bg-transparent border-slate-50">
                  <TableCell className="text-slate-600">Total Sales Income</TableCell>
                  <TableCell className="text-right font-bold">{formatLKR(reportData.totalIncome)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent border-slate-50">
                  <TableCell className="text-slate-600">Material Purchases</TableCell>
                  <TableCell className="text-right font-medium text-red-500">({formatLKR(reportData.totalMaterialPurchase)})</TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent border-slate-50">
                  <TableCell className="text-slate-600">General Expenses</TableCell>
                  <TableCell className="text-right font-medium text-red-500">({formatLKR(reportData.totalGeneralExpense)})</TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent border-t-2 border-slate-900 font-black">
                  <TableCell className="text-slate-900">Net Income</TableCell>
                  <TableCell className={cn('text-right', reportData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {formatLKR(reportData.netProfit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <PieChartIcon className="w-5 h-5 text-slate-400" />
              <h4 className="font-bold text-slate-800">Expense by Category</h4>
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-slate-50/40">
              <CardContent className="h-[320px] pt-4">
                {reportData.expenseBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reportData.expenseBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={68}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="amount"
                        nameKey="category"
                      >
                        {reportData.expenseBreakdown.map((entry: any, index: number) => (
                          <Cell key={`cell-${entry.category}-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any, name: any) => [formatLKR(value), String(name).toLowerCase().replace('_', ' ')]} />
                      <Legend formatter={(value: any) => String(value).toLowerCase().replace('_', ' ')} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    No expenses recorded for this period.
                  </div>
                )}
              </CardContent>
            </Card>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="font-semibold text-[10px] uppercase">Category</TableHead>
                  <TableHead className="text-right font-semibold text-[10px] uppercase">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.expenseBreakdown.map((ex: any) => (
                  <TableRow key={ex.category} className="hover:bg-transparent border-slate-50">
                    <TableCell className="text-slate-600 capitalize">{ex.category.toLowerCase().replace('_', ' ')}</TableCell>
                    <TableCell className="text-right font-medium">{formatLKR(ex.amount)}</TableCell>
                  </TableRow>
                ))}
                {reportData.expenseBreakdown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-slate-400 text-sm">No expenses recorded for this period.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="pt-12 text-center text-[10px] text-slate-300 font-medium">
          SWEETBIZ MANAGER - INTERNAL FINANCIAL STATEMENT - CONFIDENTIAL
        </div>
      </div>
    </div>
  );
}

function ReportStat({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    emerald: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-600 bg-red-50',
  };

  return (
    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', colors[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <h3 className="text-2xl font-black text-slate-900 mt-1">{value}</h3>
    </div>
  );
}
