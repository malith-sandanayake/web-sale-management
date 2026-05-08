import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  getDoc,
  doc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  DollarSign, 
  TrendingUp, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { formatLKR, cn } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    salesCount: 0,
    wholesaleCount: 0,
    retailCount: 0
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [productPieData, setProductPieData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const parseDate = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number' || typeof value === 'string') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value?.toDate === 'function') {
      return value.toDate();
    }
    return null;
  };

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Receipts
        const receiptsSnap = await getDocs(collection(db, 'receipts'));
        const receiptsData = receiptsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((receipt: any) => !receipt.isReversed);
        
        // Fetch Expenses
        const purchasesSnap = await getDocs(collection(db, 'expense_purchases'));
        const generalExpSnap = await getDocs(collection(db, 'expense_general'));
        const customersSnap = await getDocs(collection(db, 'customers'));

        const customersMap = new Map(customersSnap.docs.map((d) => [d.id, d.data()]));
        const productsSnap = await getDocs(collection(db, 'products'));
        const productsMap = new Map(productsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

        const productSalesMap = new Map();

        let income = 0;
        let wholesale = 0;
        let retail = 0;

        const getMonthKey = (value: any) => {
          const date = parseDate(value);
          return date
            ? `${date.getFullYear()}-${date.getMonth() + 1}`
            : null;
        };

        const months = Array.from({ length: 6 }, (_, index) => {
          const date = new Date();
          date.setMonth(date.getMonth() - (5 - index));
          return {
            key: `${date.getFullYear()}-${date.getMonth() + 1}`,
            name: date.toLocaleString('en-GB', { month: 'short' }),
            income: 0,
            expenses: 0
          };
        });

        const monthMap = new Map(months.map((month) => [month.key, { ...month }]));

        receiptsData.forEach((r: any) => {
          const amount = r.totalAmount || 0;
          income += amount;

          const customer = customersMap.get(r.customerId);
          if (customer?.customerType === 'WHOLESALE') {
            wholesale += 1;
          } else if (customer?.customerType === 'RETAIL') {
            retail += 1;
          }

          const monthKey = getMonthKey(r.createdAt || r.saleDate);
          if (monthKey && monthMap.has(monthKey)) {
            const monthRecord = monthMap.get(monthKey);
            if (monthRecord) monthRecord.income += amount;
          }

          // Aggregate product sales
          if (r.items && Array.isArray(r.items)) {
            r.items.forEach((item: any) => {
              const product = productsMap.get(item.productId);
              const productName = (product as any)?.name || 'Unknown Product';
              const currentVal = productSalesMap.get(productName) || 0;
              productSalesMap.set(productName, currentVal + (item.subtotal || 0));
            });
          }
        });

        let materialCosts = 0;
        purchasesSnap.forEach((d) => {
          const data = d.data();
          if (data.isReversed) return;
          const amount = data.totalAmount || 0;
          materialCosts += amount;
          const monthKey = getMonthKey(data.createdAt || data.purchaseDate);
          if (monthKey && monthMap.has(monthKey)) {
            const monthRecord = monthMap.get(monthKey);
            if (monthRecord) monthRecord.expenses += amount;
          }
        });

        let generalCosts = 0;
        generalExpSnap.forEach((d) => {
          const data = d.data();
          const amount = data.amount || 0;
          generalCosts += amount;
          const monthKey = getMonthKey(data.createdAt || data.expenseDate);
          if (monthKey && monthMap.has(monthKey)) {
            const monthRecord = monthMap.get(monthKey);
            if (monthRecord) monthRecord.expenses += amount;
          }
        });

        const totalExp = materialCosts + generalCosts;

        setStats({
          totalIncome: income,
          totalExpenses: totalExp,
          netProfit: income - totalExp,
          salesCount: receiptsData.length,
          wholesaleCount: wholesale,
          retailCount: retail
        });

        setChartData(Array.from(monthMap.values()));
        setPieData([
          { name: 'Wholesale', value: wholesale },
          { name: 'Retail', value: retail }
        ]);

        const sortedProductSales = Array.from(productSalesMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5); // Top 5 products

        setProductPieData(sortedProductSales);

        // Recent Sales
        const q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'), limit(10));
        const recentSnap = await getDocs(q);
        const recentWithCustomers = recentSnap.docs
          .map((d) => {
            const data = d.data();
            if (data.isReversed) return null;
            const customer = customersMap.get(data.customerId);
            return {
              id: d.id,
              receiptNumber: data.receiptNumber,
              totalAmount: data.totalAmount,
              saleDate: data.saleDate,
              customerName: customer?.name || 'Unknown',
              customerType: customer?.customerType || 'N/A'
            };
          })
          .filter(Boolean);
        setRecentSales(recentWithCustomers.slice(0, 5));

      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const COLORS = ['#0f172a', '#64748b'];

  if (loading) {
    return <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <Card key={i} className="h-32 animate-pulse bg-slate-100" />)}
      </div>
    </div>
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-1">Snapshot of your business performance.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" render={<Link to="/reports">View Reports</Link>} />
          <Button size="sm" className="bg-slate-900" render={
            <Link to="/sales/new">
              <Plus className="w-4 h-4 mr-2" /> New Sale
            </Link>
          } />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Income" 
          value={formatLKR(stats.totalIncome)} 
          icon={DollarSign} 
          trend="up" 
          trendValue="+12%" 
        />
        <StatCard 
          title="Total Expenses" 
          value={formatLKR(stats.totalExpenses)} 
          icon={ArrowDownRight} 
          trend="down" 
          trendValue="-5%" 
          color="slate"
        />
        <StatCard 
          title="Net Profit" 
          value={formatLKR(stats.netProfit)} 
          icon={TrendingUp} 
          trend="up" 
          trendValue="+18%" 
          color={stats.netProfit >= 0 ? "emerald" : "red"}
        />
        <StatCard 
          title="Profit Margin" 
          value={`${stats.totalIncome > 0 ? ((stats.netProfit / stats.totalIncome) * 100).toFixed(1) : '0.0'}%`} 
          icon={Percent} 
          trend={stats.totalIncome > 0 && stats.netProfit >= 0 ? "up" : "down"} 
          trendValue={stats.totalIncome > 0 && stats.netProfit >= 0 ? "Healthy" : "Low"} 
          color={stats.totalIncome > 0 && stats.netProfit >= 0 ? "emerald" : "red"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 overflow-hidden border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Monthly Performance</CardTitle>
            <CardDescription>Income vs Expenses over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] sm:h-[350px]">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="#64748b" />
                <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="#64748b" tickFormatter={(v) => `Rs.${v}`} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                />
                <Bar dataKey="income" fill="#0f172a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

          <Card className="lg:col-span-3 border-none shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Product Performance</CardTitle>
              <CardDescription>Monthly performance by product</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex flex-col items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {productPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
            <CardFooter className="flex justify-end p-4">
              <Button variant="link" size="sm" render={<Link to="/product-performance">View Details</Link>} />
            </CardFooter>
          </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Recent Sales</CardTitle>
            <CardDescription>Latest 5 transactions</CardDescription>
          </div>
          <Button variant="ghost" size="sm" render={<Link to="/sales">View All</Link>} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="font-medium text-slate-500">Receipt No</TableHead>
                <TableHead className="font-medium text-slate-500">Customer</TableHead>
                <TableHead className="font-medium text-slate-500">Type</TableHead>
                <TableHead className="font-medium text-slate-500">Amount</TableHead>
                <TableHead className="font-medium text-slate-500">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSales.map((sale) => (
                <TableRow key={sale.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-semibold text-slate-900">{sale.receiptNumber}</TableCell>
                  <TableCell>{sale.customerName}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      sale.customerType === 'WHOLESALE' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    )}>
                      {sale.customerType}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{formatLKR(sale.totalAmount)}</TableCell>
                  <TableCell className="text-slate-500">
                    {(() => {
                      const saleDate = parseDate(sale.saleDate);
                      return saleDate
                        ? saleDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                        : '—';
                    })()}
                  </TableCell>
                </TableRow>
              ))}
              {recentSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    No recent sales found. Start by creating a new sale!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendValue, color = "slate" }: any) {
  const colors: any = {
    slate: "text-slate-900 bg-slate-100",
    emerald: "text-emerald-900 bg-emerald-100",
    red: "text-red-900 bg-red-100",
    blue: "text-blue-900 bg-blue-100"
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={cn("p-2 rounded-lg", colors[color])}>
            <Icon className="w-5 h-5" />
          </div>
          <div className={cn(
            "flex items-center text-xs font-bold px-2 py-1 rounded-full",
            trend === 'up' ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
          )}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {trendValue}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
