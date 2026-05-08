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
  ShoppingBag, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Receipts
        const receiptsSnap = await getDocs(collection(db, 'receipts'));
        const receiptsData = receiptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Fetch Expenses
        const purchasesSnap = await getDocs(collection(db, 'expense_purchases'));
        const generalExpSnap = await getDocs(collection(db, 'expense_general'));
        
        let income = 0;
        let wholesale = 0;
        let retail = 0;
        
        // This would normally be filtered by selected date range
        receiptsData.forEach((r: any) => {
          income += r.totalAmount || 0;
          // We need to fetch customer type for counts
          // In a real app, customerType might be stored on the receipt for historical accuracy
        });

        let materialCosts = 0;
        purchasesSnap.forEach(d => {
          materialCosts += d.data().totalAmount || 0;
        });

        let generalCosts = 0;
        generalExpSnap.forEach(d => {
          generalCosts += d.data().amount || 0;
        });

        const totalExp = materialCosts + generalCosts;

        setStats({
          totalIncome: income,
          totalExpenses: totalExp,
          netProfit: income - totalExp,
          salesCount: receiptsData.length,
          wholesaleCount: 0, // Placeholder
          retailCount: 0    // Placeholder
        });

        // Recent Sales
        const q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'), limit(5));
        const recentSnap = await getDocs(q);
        const recentWithCustomers = await Promise.all(recentSnap.docs.map(async (d) => {
          const data = d.data();
          const customerSnap = await getDoc(doc(db, 'customers', data.customerId));
          return {
            id: d.id,
            receiptNumber: data.receiptNumber,
            totalAmount: data.totalAmount,
            saleDate: data.saleDate,
            customerName: customerSnap.exists() ? customerSnap.data().name : 'Unknown',
            customerType: customerSnap.exists() ? customerSnap.data().customerType : 'N/A'
          };
        }));
        setRecentSales(recentWithCustomers);

      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const chartData = [
    { name: 'Jan', income: 4000, expenses: 2400 },
    { name: 'Feb', income: 3000, expenses: 1398 },
    { name: 'Mar', income: 2000, expenses: 9800 },
    { name: 'Apr', income: 2780, expenses: 3908 },
    { name: 'May', income: 1890, expenses: 4800 },
    { name: 'Jun', income: 2390, expenses: 3800 },
  ];

  const pieData = [
    { name: 'Wholesale', value: 400 },
    { name: 'Retail', value: 300 },
  ];

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
          title="Total Sales" 
          value={stats.salesCount.toString()} 
          icon={ShoppingBag} 
          trend="up" 
          trendValue="+4" 
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
            <CardTitle className="text-lg font-semibold">Customer Distribution</CardTitle>
            <CardDescription>Sales by customer type</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
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
                    {new Date(sale.saleDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
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
