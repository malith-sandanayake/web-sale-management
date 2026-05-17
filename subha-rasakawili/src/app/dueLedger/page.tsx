import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import { BookMarked } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { formatLKR } from '../../lib/utils';
import { Customer, DueLedgerEntry, Supplier } from '../../types';
import { toast } from 'sonner';

type TabKey = 'CUSTOMER' | 'SUPPLIER';

function statusClass(status: DueLedgerEntry['status']) {
  if (status === 'CLEARED') return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
  if (status === 'PARTIAL') return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
  return 'bg-red-100 text-red-700 hover:bg-red-100';
}

export default function DueLedger() {
  const [entries, setEntries] = useState<DueLedgerEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('CUSTOMER');
  const [showCleared, setShowCleared] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<DueLedgerEntry | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', notes: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [dueSnap, customerSnap, supplierSnap] = await Promise.all([
        getDocs(collection(db, 'due_ledger')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'suppliers')),
      ]);
      setEntries(dueSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DueLedgerEntry)));
      setCustomers(customerSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)));
      setSuppliers(supplierSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Supplier)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'due_ledger');
    } finally {
      setLoading(false);
    }
  }

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => entry.partyType === activeTab && (showCleared || entry.status !== 'CLEARED'));
  }, [entries, activeTab, showCleared]);

  const summary = useMemo(() => {
    const now = new Date();
    return {
      customers: entries.filter((entry) => entry.partyType === 'CUSTOMER' && entry.status !== 'CLEARED').reduce((sum, entry) => sum + Number(entry.dueAmount || 0), 0),
      suppliers: entries.filter((entry) => entry.partyType === 'SUPPLIER' && entry.status !== 'CLEARED').reduce((sum, entry) => sum + Number(entry.dueAmount || 0), 0),
      clearedThisMonth: entries.filter((entry) => {
        if (entry.status !== 'CLEARED') return false;
        const date = new Date(entry.updatedAt || entry.createdAt);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length,
    };
  }, [entries]);

  const partyName = (entry: DueLedgerEntry) => {
    if (entry.partyType === 'CUSTOMER') return customers.find((customer) => customer.id === entry.customerId)?.name || 'Unknown Customer';
    return suppliers.find((supplier) => supplier.id === entry.supplierId)?.name || 'Unknown Supplier';
  };

  const handleRecordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEntry) return;

    const amount = Number(paymentForm.amount || 0);
    if (amount <= 0) return toast.error('Payment amount must be greater than zero');

    const createdAt = new Date().toISOString();
    try {
      await runTransaction(db, async (transaction) => {
        const entryRef = doc(db, 'due_ledger', selectedEntry.id);
        const entrySnap = await transaction.get(entryRef);
        if (!entrySnap.exists()) throw new Error('Due ledger entry not found');

        const entryData = entrySnap.data() as DueLedgerEntry;
        const paidAmount = Number(entryData.paidAmount || 0) + amount;
        const dueAmount = Math.max(0, Number(entryData.dueAmount || 0) - amount);
        const status = dueAmount <= 0 ? 'CLEARED' : 'PARTIAL';

        transaction.update(entryRef, { paidAmount, dueAmount, status, updatedAt: createdAt });

        const paymentId = doc(collection(db, 'due_payments')).id;
        transaction.set(doc(db, 'due_payments', paymentId), {
          dueLedgerEntryId: selectedEntry.id,
          amount,
          notes: paymentForm.notes.trim(),
          createdAt,
        });

        const partyId = entryData.partyType === 'CUSTOMER' ? entryData.customerId : entryData.supplierId;
        if (partyId) {
          const collectionName = entryData.partyType === 'CUSTOMER' ? 'customers' : 'suppliers';
          const partyRef = doc(db, collectionName, partyId);
          const partySnap = await transaction.get(partyRef);
          if (partySnap.exists()) {
            const partyData = partySnap.data() as any;
            transaction.update(partyRef, {
              outstandingBalance: Math.max(0, Number(partyData.outstandingBalance || 0) - amount),
              updatedAt: createdAt,
            });
          }
        }
      });

      toast.success('Payment recorded');
      setSelectedEntry(null);
      setPaymentForm({ amount: '', notes: '' });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'due_payments');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Due Ledger</h1>
          <p className="text-slate-500 mt-1">Track customer and supplier credit balances.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <input type="checkbox" checked={showCleared} onChange={(event) => setShowCleared(event.target.checked)} />
          Show cleared
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm"><CardContent className="p-6"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Outstanding Customers</p><p className="mt-2 text-2xl font-black">{formatLKR(summary.customers)}</p></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-6"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Outstanding Suppliers</p><p className="mt-2 text-2xl font-black">{formatLKR(summary.suppliers)}</p></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-6"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Cleared This Month</p><p className="mt-2 text-2xl font-black">{summary.clearedThisMonth}</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Button variant={activeTab === 'CUSTOMER' ? 'default' : 'outline'} className={activeTab === 'CUSTOMER' ? 'bg-slate-900' : ''} onClick={() => setActiveTab('CUSTOMER')}>Customers Due</Button>
        <Button variant={activeTab === 'SUPPLIER' ? 'default' : 'outline'} className={activeTab === 'SUPPLIER' ? 'bg-slate-900' : ''} onClick={() => setActiveTab('SUPPLIER')}>Suppliers Due</Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50 border-slate-100">
                <TableHead className="px-6 font-semibold">Party Name</TableHead>
                <TableHead className="font-semibold">Original Amount</TableHead>
                <TableHead className="font-semibold">Paid Amount</TableHead>
                <TableHead className="font-semibold">Due Amount</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="text-right pr-6 font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [1, 2, 3].map((row) => <TableRow key={row}><TableCell colSpan={7} className="px-6 py-4"><div className="h-8 animate-pulse rounded bg-slate-100" /></TableCell></TableRow>) : visibleEntries.map((entry) => (
                <TableRow key={entry.id} className="border-slate-50">
                  <TableCell className="px-6 font-bold text-slate-900"><BookMarked className="mr-2 inline h-4 w-4 text-slate-400" />{partyName(entry)}</TableCell>
                  <TableCell>{formatLKR(entry.originalAmount)}</TableCell>
                  <TableCell>{formatLKR(entry.paidAmount)}</TableCell>
                  <TableCell className="font-bold">{formatLKR(entry.dueAmount)}</TableCell>
                  <TableCell><Badge className={statusClass(entry.status)}>{entry.status}</Badge></TableCell>
                  <TableCell className="text-slate-500">{new Date(entry.createdAt).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell className="text-right pr-6"><Button variant="outline" size="sm" disabled={entry.status === 'CLEARED'} onClick={() => setSelectedEntry(entry)}>Record Payment</Button></TableCell>
                </TableRow>
              ))}
              {!loading && visibleEntries.length === 0 && <TableRow><TableCell colSpan={7} className="py-16 text-center text-slate-400">No due ledger entries found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent>
          <form onSubmit={handleRecordPayment}>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>{selectedEntry ? `Record a payment for ${partyName(selectedEntry)}.` : 'Record a due payment.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label htmlFor="due-amount">Amount</Label><Input id="due-amount" type="number" step="0.01" min="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} required /></div>
              <div className="grid gap-2"><Label htmlFor="due-notes">Notes</Label><Input id="due-notes" value={paymentForm.notes} onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setSelectedEntry(null)}>Cancel</Button><Button type="submit" className="bg-slate-900">Save Payment</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
