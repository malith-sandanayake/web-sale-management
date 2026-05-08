import { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  query,
  orderBy
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
  Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { formatLKR } from '../../lib/utils';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router-dom';

export default function ProductPerformance() {
  const [productData, setProductData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const receiptsSnap = await getDocs(collection(db, 'receipts'));
        const receiptsData = receiptsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((receipt: any) => !receipt.isReversed);

        const productsSnap = await getDocs(collection(db, 'products'));
        const productsMap = new Map(productsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

        const productSalesMap = new Map();

        receiptsData.forEach((r: any) => {
          if (r.items && Array.isArray(r.items)) {
            r.items.forEach((item: any) => {
              const product = productsMap.get(item.productId);
              const productName = (product as any)?.name || 'Unknown Product';
              const currentVal = productSalesMap.get(productName) || 0;
              productSalesMap.set(productName, currentVal + (item.subtotal || 0));
            });
          }
        });

        const sortedData = Array.from(productSalesMap.entries())
          .map(([name, value]) => ({ name, value }))
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

  const COLORS = ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'];

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
          <p className="text-slate-500 mt-1">Detailed view of sales performance by product.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Sales Revenue by Product</CardTitle>
          <CardDescription>Total revenue generated per product</CardDescription>
        </CardHeader>
        <CardContent className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={productData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} stroke="#64748b" tickFormatter={(v) => `Rs.${v}`} />
              <YAxis 
                type="category" 
                dataKey="name" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                stroke="#64748b" 
                width={150}
              />
              <Tooltip 
                cursor={{fill: '#f8fafc'}}
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                formatter={(value: any) => formatLKR(value)}
              />
              <Bar dataKey="value" fill="#0f172a" radius={[0, 4, 4, 0]}>
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
