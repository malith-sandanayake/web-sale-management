import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Search, Filter, Receipt as ReceiptIcon, Eye, Download, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { formatLKR } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';

export default function SalesList() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);

  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    try {
      const q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const salesData = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const customerSnap = await getDoc(doc(db, 'customers', data.customerId));
        return {
          id: d.id,
          ...data,
          customerName: customerSnap.exists() ? customerSnap.data().name : 'Unknown',
          customerType: customerSnap.exists() ? customerSnap.data().customerType : 'N/A'
        };
      }));
      setSales(salesData);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'sales');
    } finally {
      setLoading(false);
    }
  }

  const filtered = sales.filter(s => 
    s.receiptNumber.toLowerCase().includes(search.toLowerCase()) || 
    s.customerName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Sales History</h1>
          <p className="text-slate-500 mt-1">Review all past transactions and receipts.</p>
        </div>
        <Button size="sm" className="bg-slate-900" render={<Link to="/sales/new">New Sale</Link>} />
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by receipt or customer..." 
              className="pl-10 bg-slate-50 border-none h-10" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-slate-50 border-none">
              <Calendar className="w-4 h-4 mr-2 text-slate-400" /> Date Range
            </Button>
            <Button variant="outline" size="sm" className="bg-slate-50 border-none">
              <Filter className="w-4 h-4 mr-2 text-slate-400" /> Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-slate-100">
                <TableHead className="font-semibold text-slate-600">Receipt No</TableHead>
                <TableHead className="font-semibold text-slate-600">Date</TableHead>
                <TableHead className="font-semibold text-slate-600">Customer</TableHead>
                <TableHead className="font-semibold text-slate-600">Type</TableHead>
                <TableHead className="font-semibold text-slate-600">Total (LKR)</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><div className="h-10 animate-pulse bg-slate-100 rounded w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.map((sale) => (
                <TableRow key={sale.id} className="border-slate-50 hover:bg-slate-50/20">
                  <TableCell className="font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <ReceiptIcon className="w-4 h-4 text-slate-400" />
                      {sale.receiptNumber}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {new Date(sale.saleDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="font-medium">{sale.customerName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={sale.customerType === 'WHOLESALE' ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}>
                      {sale.customerType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold">{formatLKR(sale.totalAmount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedSale(sale)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                    No sales records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale Details - {selectedSale?.receiptNumber}</DialogTitle>
            <DialogDescription>Full summary of the transaction.</DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Customer</p>
                  <p className="font-bold text-slate-900">{selectedSale.customerName}</p>
                  <p className="text-sm text-slate-500">{selectedSale.customerType}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-right">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Date</p>
                  <p className="font-bold text-slate-900">{new Date(selectedSale.saleDate).toLocaleDateString()}</p>
                  <p className="text-sm text-slate-500">Recorded: {new Date(selectedSale.createdAt).toLocaleTimeString()}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Payment Information</h4>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-slate-600">Method</span>
                  <span className="font-medium">CASH</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xl font-bold bg-slate-900 text-white p-4 rounded-lg shadow-inner">
                <span>Total Amount Paid</span>
                <span>{formatLKR(selectedSale.totalAmount)}</span>
              </div>
              
              <div className="text-center text-xs text-slate-400 italic">
                * Itemized breakdown fetch disabled in this view for performance.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
