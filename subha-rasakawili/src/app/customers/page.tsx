import { useState, useEffect, type FormEvent } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Plus, Search, User, Phone, Edit2, Trash, Download, Printer } from 'lucide-react';
import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { generateNextCustomerCode } from '../../lib/utils';
import { toast } from 'sonner';
import { CustomerType } from '../../types';
import { exportToCSV, exportToExcel, printTable } from '../../lib/exportUtils';

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUpdateLoading, setIsUpdateLoading] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', customerType: CustomerType.RETAIL, phone: '' });
  const editFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const snap = await getDocs(collection(db, 'customers'));
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'customers');
    } finally {
      setLoading(false);
    }
  }

  const handleAddCustomer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nextCode = generateNextCustomerCode(customers);
    const data = {
      customerCode: nextCode,
      name: formData.get('name') as string,
      customerType: formData.get('customerType') as string,
      phone: formData.get('phone') as string,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'customers'), data);
      toast.success("Customer added successfully");
      setIsAddOpen(false);
      fetchCustomers();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'customers');
    }
  };

  const openEditDialog = (customer: any) => {
    setEditingCustomer(customer);
    setEditForm({
      name: customer.name || '',
      customerType: customer.customerType || CustomerType.RETAIL,
      phone: customer.phone || ''
    });
    setIsEditOpen(true);
  };

  const handleUpdateCustomer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCustomer) return toast.error('No customer selected');
    if (!editForm.name.trim()) return toast.error('Customer name is required');
    setIsUpdateLoading(true);
    try {
      await updateDoc(doc(db, 'customers', editingCustomer.id), {
        name: editForm.name.trim(),
        customerType: editForm.customerType,
        phone: editForm.phone,
        updatedAt: new Date().toISOString()
      });
      toast.success('Customer updated successfully');
      setIsEditOpen(false);
      setEditingCustomer(null);
      fetchCustomers();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'customers');
    } finally {
      setIsUpdateLoading(false);
    }
  };

  const deleteCustomer = async (id: string) => {
    const ok = window.confirm('Delete this customer? This action cannot be undone.');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      toast.success('Customer deleted');
      fetchCustomers();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'customers');
    }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.customerCode && c.customerCode.includes(search))
  );

  const exportRows = filtered.map((customer) => ({
    code: customer.customerCode,
    name: customer.name,
    type: customer.customerType,
    phone: customer.phone || '',
    joinedDate: customer.createdAt,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Customers</h1>
          <p className="text-slate-500 mt-1">Manage your wholesale and retail customer base.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="bg-slate-900">
              <Plus className="w-4 h-4 mr-2" /> Add Customer
            </Button>
          } />
          <DialogContent>
            <form onSubmit={handleAddCustomer}>
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>Enter the details for the new customer.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" required placeholder="e.g. Kamal Perera" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customerType">Customer Type</Label>
                  <Select name="customerType" defaultValue="RETAIL">
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CustomerType).map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" name="phone" placeholder="e.g. 077 123 4567" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900">Save Customer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditingCustomer(null);
        }}>
          <DialogContent>
            <form ref={editFormRef} onSubmit={handleUpdateCustomer}>
              <DialogHeader>
                <DialogTitle>Edit Customer</DialogTitle>
                <DialogDescription>Update the details for this customer.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input id="edit-name" name="name" required value={editForm.name} onChange={(e) => setEditForm(prev => ({...prev, name: e.target.value}))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-customerType">Customer Type</Label>
                  <Select name="customerType" value={editForm.customerType} onValueChange={(val) => setEditForm(prev => ({...prev, customerType: val}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CustomerType).map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Phone Number</Label>
                  <Input id="edit-phone" name="phone" value={editForm.phone} onChange={(e) => setEditForm(prev => ({...prev, phone: e.target.value}))} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditingCustomer(null); }}>Cancel</Button>
                <Button type="button" className="bg-slate-900" disabled={isUpdateLoading} onClick={() => editFormRef.current?.requestSubmit()}>
                  {isUpdateLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportToCSV(exportRows, 'customers.csv')}><Download className="w-4 h-4 mr-2" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={() => exportToExcel(exportRows, 'customers.xlsx')}><Download className="w-4 h-4 mr-2" /> Excel</Button>
        <Button variant="outline" size="sm" onClick={() => printTable('customers-table')}><Printer className="w-4 h-4 mr-2" /> Print</Button>
      </div>

      <Card id="customers-table" className="border-none shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by name or code..." 
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
                <TableHead className="w-20 font-semibold">Code</TableHead>
                <TableHead className="font-semibold px-6">Customer Name</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Contact</TableHead>
                <TableHead className="font-semibold">Joined Date</TableHead>
                <TableHead className="text-right font-semibold pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1,2,3].map(i => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><div className="h-10 animate-pulse bg-slate-100 rounded w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.map((customer) => (
                <TableRow key={customer.id} className="border-slate-50 group">
                  <TableCell className="font-mono font-semibold text-slate-600">{customer.customerCode || '-'}</TableCell>
                  <TableCell className="px-6 font-medium text-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <User className="w-4 h-4" />
                      </div>
                      {customer.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.customerType === 'WHOLESALE' ? "default" : "secondary"} className="font-bold tracking-tight">
                      {customer.customerType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-slate-500">
                      <Phone className="w-3 h-3" />
                      {customer.phone || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {new Date(customer.createdAt).toLocaleDateString('en-GB')}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(customer)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCustomer(customer.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    No customers found.
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
