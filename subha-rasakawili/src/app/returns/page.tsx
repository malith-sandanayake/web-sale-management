import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Undo2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { formatLKR } from '../../lib/utils';
import { ReturnEntry, ReturnType } from '../../types';

export default function Returns() {
  const [returns, setReturns] = useState<ReturnEntry[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [activeType, setActiveType] = useState<'ALL' | ReturnType>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [returnSnap, customerSnap, supplierSnap] = await Promise.all([
          getDocs(query(collection(db, 'returns'), orderBy('createdAt', 'desc'))),
          getDocs(collection(db, 'customers')),
          getDocs(collection(db, 'suppliers')),
        ]);
        setReturns(returnSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ReturnEntry)));
        setCustomers(customerSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setSuppliers(supplierSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'returns');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return returns.filter((entry) => activeType === 'ALL' || entry.returnType === activeType);
  }, [returns, activeType]);

  const partyName = (entry: ReturnEntry) => {
    if (entry.returnType === ReturnType.SALE_RETURN) return customers.find((customer) => customer.id === entry.partyId)?.name || 'Unknown Customer';
    return suppliers.find((supplier) => supplier.id === entry.partyId)?.name || 'Unknown Supplier';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Returns</h1>
          <p className="text-slate-500 mt-1">Review sale and purchase returns in one place.</p>
        </div>
        <div className="flex gap-2">
          {(['ALL', ReturnType.SALE_RETURN, ReturnType.PURCHASE_RETURN] as const).map((type) => (
            <Button key={type} variant={activeType === type ? 'default' : 'outline'} size="sm" className={activeType === type ? 'bg-slate-900' : ''} onClick={() => setActiveType(type)}>{type.replace('_', ' ')}</Button>
          ))}
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50 border-slate-100">
                <TableHead className="px-6 font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Party Name</TableHead>
                <TableHead className="font-semibold">Items Count</TableHead>
                <TableHead className="font-semibold">Total Amount</TableHead>
                <TableHead className="font-semibold">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [1, 2, 3].map((row) => <TableRow key={row}><TableCell colSpan={6} className="px-6 py-4"><div className="h-8 animate-pulse rounded bg-slate-100" /></TableCell></TableRow>) : filtered.map((entry) => (
                <TableRow key={entry.id} className="border-slate-50">
                  <TableCell className="px-6 text-slate-500">{new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell><Badge className={entry.returnType === ReturnType.SALE_RETURN ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : 'bg-sky-100 text-sky-700 hover:bg-sky-100'}>{entry.returnType}</Badge></TableCell>
                  <TableCell className="font-bold text-slate-900"><Undo2 className="mr-2 inline h-4 w-4 text-slate-400" />{partyName(entry)}</TableCell>
                  <TableCell>{entry.items?.length || 0}</TableCell>
                  <TableCell className="font-black">{formatLKR(entry.totalAmount)}</TableCell>
                  <TableCell className="text-slate-500">{entry.reason || '-'}</TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-16 text-center text-slate-400">No returns recorded yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
