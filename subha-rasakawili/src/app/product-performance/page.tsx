import { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { formatLKR } from '../../lib/utils';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router-dom';
import { CHART_COLORS } from '../../lib/chartColors';

export default function ProductPerformance() {
  const [productData, setProductData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [receiptsSnap, receiptItemsSnap, productsSnap] = await Promise.all([
          getDocs(collection(db, 'receipts')),
          getDocs(collection(db, 'receipt_items')),
          getDocs(collection(db, 'products')),
        ]);

        const now = new Date();
        const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
        const parseDate = (value: any) => {
          if (!value) return null;
          if (value instanceof Date) return value;
          if (typeof value?.toDate === 'function') return value.toDate();
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? null : date;
        };

        const validReceipts = new Set<string>();
        receiptsSnap.docs.forEach((receiptDoc) => {
          const data = receiptDoc.data() as any;
          if (data.isReversed) return;
          const date = parseDate(data.saleDate || data.createdAt);
          if (!date) return;
          const receiptMonthKey = `${date.getFullYear()}-${date.getMonth()}`;
          if (receiptMonthKey !== monthKey) return;
          validReceipts.add(receiptDoc.id);
        });

        const productsMap = new Map(
          productsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }])
        );

        const productSalesMap = new Map<string, { count: number; income: number }>();
        const allTimeProductSalesMap = new Map<string, { count: number; income: number }>();

        receiptItemsSnap.docs.forEach((itemDoc) => {
          const item = { id: itemDoc.id, ...itemDoc.data() } as any;

          const product = productsMap.get(item.productId);
          const productName = (product as any)?.name || 'Unknown Product';
          const count = Number(item.quantity || 1);
          const income = Number(item.subtotal || 0);
          const allTimeCurrent = allTimeProductSalesMap.get(productName) || { count: 0, income: 0 };
          allTimeProductSalesMap.set(productName, {
            count: allTimeCurrent.count + count,
            income: allTimeCurrent.income + income,
          });
          if (!validReceipts.has(item.receiptId)) return;
          const current = productSalesMap.get(productName) || { count: 0, income: 0 };
          productSalesMap.set(productName, {
            count: current.count + count,
            income: current.income + income,
          });
        });

        const sourceMap = productSalesMap.size > 0 ? productSalesMap : allTimeProductSalesMap;

        const sortedData = Array.from(sourceMap.entries())
          .map(([name, value]) => ({ name, value: value.count, income: value.income }))
          .sort((a, b) => b.value - a.value);

        setProductData(sortedData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'product-performance');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const COLORS = CHART_COLORS;

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link to="/"><ArrowLeft className="w-5 h-5" /></Link>} />
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Product Performance</h1>
          <p className="text-slate-500 mt-1">Monthly product sales by item, with summary and detailed views.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Monthly Product Sales</CardTitle>
          <CardDescription>Pie chart summary for the current month sales count</CardDescription>
        </CardHeader>
        <CardContent className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
              data={productData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
              >
                {productData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as { name: string; value: number; income: number };
                  return (
                    <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-lg">
                      <p className="text-sm font-semibold text-slate-900">{label}</p>
                      <p className="text-sm text-slate-600">Sales Count: <span className="font-semibold text-slate-900">{item.value}</span></p>
                      <p className="text-sm text-slate-600">Total Income: <span className="font-semibold text-slate-900">{formatLKR(item.income)}</span></p>
                    </div>
                  );
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">View Details</CardTitle>
          <CardDescription>Bar chart breakdown of monthly product sales count by product</CardDescription>
        </CardHeader>
        <CardContent className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={productData}
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis 
                type="category" 
                dataKey="name" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                stroke="#64748b" 
                interval={0}
                angle={-20}
                textAnchor="end"
                height={70}
              />
              <YAxis 
                type="number" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                stroke="#64748b" 
                allowDecimals={false}
              />
              <Tooltip 
                cursor={{fill: '#f8fafc'}}
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as { name: string; value: number; income: number };
                  return (
                    <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-lg">
                      <p className="text-sm font-semibold text-slate-900">{label}</p>
                      <p className="text-sm text-slate-600">Sales Count: <span className="font-semibold text-slate-900">{item.value}</span></p>
                      <p className="text-sm text-slate-600">Total Income: <span className="font-semibold text-slate-900">{formatLKR(item.income)}</span></p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" fill="#0f172a" radius={[4, 4, 0, 0]}>
                {productData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
