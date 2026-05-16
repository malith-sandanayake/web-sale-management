import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collection, deleteDoc, doc, getDocs, query, orderBy, runTransaction, addDoc, updateDoc } from 'firebase/firestore';
import { Building2, Edit2, History, MapPin, Plus, Search, Trash, Wallet, Phone } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { formatLKR, generateNextSupplierCode } from '../../lib/utils';
import { Supplier, SupplierCategory, SupplierPaymentMethod, SupplierTransaction } from '../../types';
import { toast } from 'sonner';

const emptyForm = {
  name: '',
  phone: '',
  address: '',
  category: '',
  paymentMethod: SupplierPaymentMethod.CASH,
  creditDays: '',
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', notes: '' });
  const [editForm, setEditForm] = useState(emptyForm);
  const [addFormCategory, setAddFormCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SupplierCategory>(SupplierCategory.INGREDIENT);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<SupplierPaymentMethod>(SupplierPaymentMethod.CASH);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [supplierSnap, transactionSnap, productSnap] = await Promise.all([
        getDocs(query(collection(db, 'suppliers'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'supplier_transactions'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'products')),
      ]);

      setSuppliers(supplierSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
      setTransactions(transactionSnap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierTransaction)));
      setProducts(productSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'suppliers');
    } finally {
      setLoading(false);
    }
  }

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const term = search.toLowerCase();
      return (
        supplier.name.toLowerCase().includes(term) ||
        supplier.supplierCode.toLowerCase().includes(term) ||
        (supplier.phone || '').toLowerCase().includes(term)
      );
    });
  }, [suppliers, search]);

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setEditForm({
      name: supplier.name || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      category: supplier.category || '',
      paymentMethod: supplier.paymentMethod || SupplierPaymentMethod.CASH,
      creditDays: String(supplier.creditDays ?? ''),
    });
    setIsEditOpen(true);
  };

  const openLedgerDialog = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsLedgerOpen(true);
  };

  const openPaymentDialog = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setPaymentForm({ amount: '', notes: '' });
    setIsPaymentOpen(true);
  };

  const handleAddSupplier = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nextCode = generateNextSupplierCode(suppliers);

    try {
      await addDoc(collection(db, 'suppliers'), {
        supplierCode: nextCode,
        name: String(formData.get('name') || '').trim(),
        phone: String(formData.get('phone') || '').trim(),
        address: String(formData.get('address') || '').trim(),
        category: selectedCategory,
        paymentMethod: selectedPaymentMethod,
        creditDays: selectedPaymentMethod === SupplierPaymentMethod.CREDIT ? Number(formData.get('creditDays') || 30) : null,
        outstandingBalance: 0,
        createdAt: new Date().toISOString(),
      });
      toast.success('Supplier added successfully');
      setIsAddOpen(false);
      setAddFormCategory('');
      e.currentTarget.reset();
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'suppliers');
    }
  };

  const handleUpdateSupplier = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSupplier) return toast.error('No supplier selected');

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'suppliers', editingSupplier.id), {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
        category: editForm.category,
        paymentMethod: editForm.paymentMethod,
        creditDays: editForm.paymentMethod === SupplierPaymentMethod.CREDIT ? Number(editForm.creditDays || 30) : null,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Supplier updated successfully');
      setIsEditOpen(false);
      setEditingSupplier(null);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'suppliers');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    const confirmed = window.confirm(`Delete ${supplier.name}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'suppliers', supplier.id));
      toast.success('Supplier deleted');
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'suppliers');
    }
  };

  const handleRecordPayment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSupplier) return toast.error('No supplier selected');

    const amount = Number(paymentForm.amount || 0);
    if (amount <= 0) return toast.error('Payment amount must be greater than zero');

    const createdAt = new Date().toISOString();
    const paymentId = doc(collection(db, 'supplier_transactions')).id;

    try {
      await runTransaction(db, async (transaction) => {
        const supplierRef = doc(db, 'suppliers', selectedSupplier.id);
        const supplierSnap = await transaction.get(supplierRef);
        if (!supplierSnap.exists()) {
          throw new Error('Supplier not found');
        }

        const supplierData = supplierSnap.data() as any;
        const balanceBefore = Number(supplierData.outstandingBalance || 0);
        const balanceAfter = balanceBefore - amount;

        transaction.update(supplierRef, {
          outstandingBalance: balanceAfter,
          updatedAt: createdAt,
        });

        transaction.set(doc(db, 'supplier_transactions', paymentId), {
          supplierId: selectedSupplier.id,
          type: 'PAYMENT',
          amount,
          balanceBefore,
          balanceAfter,
          notes: paymentForm.notes.trim(),
          createdAt,
        });
      });

      toast.success('Payment recorded successfully');
      setIsPaymentOpen(false);
      setSelectedSupplier(null);
      setPaymentForm({ amount: '', notes: '' });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'supplier_transactions');
    }
  };

  const supplierLedger = useMemo(() => {
    if (!selectedSupplier) return [];
    return transactions
      .filter((transaction) => transaction.supplierId === selectedSupplier.id)
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [transactions, selectedSupplier]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Suppliers</h1>
          <p className="text-slate-500 mt-1">Manage supplier accounts, payments, and running balances.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) { setSelectedCategory(SupplierCategory.INGREDIENT); setSelectedPaymentMethod(SupplierPaymentMethod.CASH); } }}>
          <DialogTrigger render={<Button className="bg-slate-900"><Plus className="w-4 h-4 mr-2" /> Add Supplier</Button>} />
          <DialogContent>
            <form onSubmit={handleAddSupplier}>
              <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
                <DialogDescription>Create a new supplier account.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Supplier Name</Label>
                  <Input id="name" name="name" required placeholder="e.g. Rajah Trading" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" placeholder="e.g. 077 123 4567" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" placeholder="Optional address" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as SupplierCategory)}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {Object.values(SupplierCategory).map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Payment Method</Label>
                    <Select value={selectedPaymentMethod} onValueChange={(value) => setSelectedPaymentMethod(value as SupplierPaymentMethod)}>
                      <SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger>
                      <SelectContent>
                        {Object.values(SupplierPaymentMethod).map((method) => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedPaymentMethod === SupplierPaymentMethod.CREDIT && (
                    <div className="grid gap-2">
                      <Label htmlFor="creditDays">Credit Days</Label>
                      <Input id="creditDays" name="creditDays" type="number" min="1" defaultValue="30" />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900">Save Supplier</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingSupplier(null); }}>
          <DialogContent>
            <form onSubmit={handleUpdateSupplier}>
              <DialogHeader>
                <DialogTitle>Edit Supplier</DialogTitle>
                <DialogDescription>Update supplier details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Supplier Name</Label>
                  <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" value={editForm.address} onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={editForm.category} onValueChange={(value) => setEditForm((prev) => ({ ...prev, category: value }))}>
                      <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.name}>{product.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Payment Method</Label>
                    <Select value={editForm.paymentMethod} onValueChange={(value) => setEditForm((prev) => ({ ...prev, paymentMethod: value as SupplierPaymentMethod }))}>
                      <SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger>
                      <SelectContent>
                        {Object.values(SupplierPaymentMethod).map((method) => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {editForm.paymentMethod === SupplierPaymentMethod.CREDIT && (
                    <div className="grid gap-2">
                      <Label htmlFor="edit-creditDays">Credit Days</Label>
                      <Input id="edit-creditDays" type="number" min="1" value={editForm.creditDays} onChange={(e) => setEditForm((prev) => ({ ...prev, creditDays: e.target.value }))} />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditingSupplier(null); }}>Cancel</Button>
                <Button type="submit" className="bg-slate-900" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isPaymentOpen} onOpenChange={(open) => { setIsPaymentOpen(open); if (!open) setSelectedSupplier(null); }}>
          <DialogContent>
            <form onSubmit={handleRecordPayment}>
              <DialogHeader>
                <DialogTitle>Record Payment to Supplier</DialogTitle>
                <DialogDescription>{selectedSupplier ? `Record a payment for ${selectedSupplier.name}.` : 'Record a supplier payment.'}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="payment-amount">Amount (LKR)</Label>
                  <Input id="payment-amount" type="number" step="0.01" min="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="payment-notes">Notes</Label>
                  <Input id="payment-notes" value={paymentForm.notes} onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Optional notes" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900">Save Payment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isLedgerOpen} onOpenChange={(open) => { setIsLedgerOpen(open); if (!open) setSelectedSupplier(null); }}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Supplier Ledger</DialogTitle>
              <DialogDescription>{selectedSupplier ? `${selectedSupplier.name} - ${selectedSupplier.supplierCode}` : 'Transaction history'}</DialogDescription>
            </DialogHeader>
            {selectedSupplier && (
              <div className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Card className="border-slate-100 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Outstanding Balance</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">{formatLKR(selectedSupplier.outstandingBalance || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-100 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Payment Method</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">{selectedSupplier.paymentMethod}{selectedSupplier.paymentMethod === 'CREDIT' && selectedSupplier.creditDays ? ` (${selectedSupplier.creditDays}d)` : ''}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-100 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Transactions</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">{supplierLedger.length}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-100">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50 border-slate-100">
                        <TableHead className="font-semibold text-xs uppercase">Date</TableHead>
                        <TableHead className="font-semibold text-xs uppercase">Type</TableHead>
                        <TableHead className="font-semibold text-xs uppercase">Reference</TableHead>
                        <TableHead className="font-semibold text-xs uppercase">Amount</TableHead>
                        <TableHead className="font-semibold text-xs uppercase">Balance Before</TableHead>
                        <TableHead className="font-semibold text-xs uppercase">Balance After</TableHead>
                        <TableHead className="font-semibold text-xs uppercase">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierLedger.length > 0 ? supplierLedger.map((transaction) => (
                        <TableRow key={transaction.id} className="border-slate-50">
                          <TableCell className="text-slate-500">{new Date(transaction.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                          <TableCell>
                            <Badge variant={transaction.type === 'PAYMENT' ? 'default' : 'secondary'}>{transaction.type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">{transaction.referenceId || '-'}</TableCell>
                          <TableCell className="font-semibold">{transaction.type === 'PAYMENT' ? `- ${formatLKR(transaction.amount)}` : formatLKR(transaction.amount)}</TableCell>
                          <TableCell>{formatLKR(transaction.balanceBefore)}</TableCell>
                          <TableCell className="font-semibold">{formatLKR(transaction.balanceAfter)}</TableCell>
                          <TableCell className="text-slate-500 whitespace-normal wrap-break-word">{transaction.notes || '-'}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-slate-400">No supplier transactions recorded yet.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, code, or phone..."
              className="pl-10 bg-slate-50 border-none h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-slate-100">
                <TableHead className="w-24 font-semibold">Code</TableHead>
                <TableHead className="font-semibold px-6">Supplier Name</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold">Contact</TableHead>
                <TableHead className="font-semibold">Payment</TableHead>
                <TableHead className="font-semibold">Outstanding</TableHead>
                <TableHead className="text-right font-semibold pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3].map((row) => (
                  <TableRow key={row}>
                    <TableCell colSpan={7} className="px-6 py-4"><div className="h-8 animate-pulse bg-slate-100 rounded w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="border-slate-50 group">
                  <TableCell className="font-mono font-semibold text-slate-600">{supplier.supplierCode || '-'}</TableCell>
                  <TableCell className="px-6 font-medium text-slate-900">
                    <button className="flex items-center gap-3 text-left hover:text-slate-700" onClick={() => openLedgerDialog(supplier)}>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span>{supplier.name}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-semibold tracking-tight">{supplier.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-slate-500">
                      <div className="flex items-center gap-2"><Phone className="w-3 h-3" />{supplier.phone || 'N/A'}</div>
                      <div className="flex items-center gap-2"><MapPin className="w-3 h-3" />{supplier.address || 'N/A'}</div>
                    </div>
                  </TableCell>
                   <TableCell>
                     <Badge variant={supplier.paymentMethod === 'CREDIT' ? 'default' : 'secondary'}>{supplier.paymentMethod}{supplier.paymentMethod === 'CREDIT' && supplier.creditDays ? ` (${supplier.creditDays}d)` : ''}</Badge>
                   </TableCell>
                  <TableCell className="font-bold text-slate-900">{formatLKR(supplier.outstandingBalance || 0)}</TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openPaymentDialog(supplier)} title="Record payment">
                        <Wallet className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(supplier)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSupplier(supplier)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredSuppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-slate-400">No suppliers found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
