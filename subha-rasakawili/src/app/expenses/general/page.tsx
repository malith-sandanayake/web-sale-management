import { useState, useEffect, type FormEvent } from 'react';
import { collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import { Plus, Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { formatLKR } from '../../../lib/utils';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { ExpenseCategory } from '../../../types';
import { toast } from 'sonner';
import { exportToCSV, exportToExcel, printTable } from '../../../lib/exportUtils';

export default function GeneralExpenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    try {
      const q = query(collection(db, 'expense_general'), orderBy('expenseDate', 'desc'));
      const snap = await getDocs(q);
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'expenses');
    } finally {
      setLoading(false);
    }
  }

  const handleAddExpense = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      expenseDate: new Date().toISOString(),
      category: formData.get('category') as string,
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      notes: ""
    };

    try {
      await addDoc(collection(db, 'expense_general'), data);
      toast.success("Expense recorded successfully");
      setIsAddOpen(false);
      fetchExpenses();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'expenses');
    }
  };

  const exportRows = expenses.map((expense) => ({
    date: expense.expenseDate,
    category: expense.category,
    description: expense.description || '',
    amount: expense.amount,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">General Expenses</h1>
          <p className="text-slate-500 mt-1">Track utilities, transport, and other operational costs.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="bg-slate-900"><Plus className="w-4 h-4 mr-2" /> Add Expense</Button>} />
          <DialogContent>
            <form onSubmit={handleAddExpense}>
              <DialogHeader>
                <DialogTitle>Add General Expense</DialogTitle>
                <DialogDescription>Record a non-material business expense.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select name="category" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ExpenseCategory).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount (LKR)</Label>
                  <Input id="amount" name="amount" type="number" step="0.01" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input id="description" name="description" placeholder="e.g. Fuel for delivery" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900">Record Expense</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportToCSV(exportRows, 'general-expenses.csv')}><Download className="w-4 h-4 mr-2" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={() => exportToExcel(exportRows, 'general-expenses.xlsx')}><Download className="w-4 h-4 mr-2" /> Excel</Button>
        <Button variant="outline" size="sm" onClick={() => printTable('general-expenses-table')}><Printer className="w-4 h-4 mr-2" /> Print</Button>
      </div>

      <Card id="general-expenses-table" className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50 border-slate-100">
                <TableHead className="px-6 font-semibold capitalize text-xs">Date</TableHead>
                <TableHead className="font-semibold capitalize text-xs">Category</TableHead>
                <TableHead className="font-semibold capitalize text-xs">Description</TableHead>
                <TableHead className="font-semibold capitalize text-xs">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1,2,3].map(i => (
                  <TableRow key={i}>
                    <TableCell colSpan={4} className="px-6 py-4"><div className="h-8 animate-pulse bg-slate-100 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : expenses.map((ex) => (
                <TableRow key={ex.id} className="border-slate-50">
                  <TableCell className="px-6 text-slate-500 font-medium">
                    {new Date(ex.expenseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-slate-50 font-semibold text-[10px] tracking-wider text-slate-500">
                      {ex.category.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-900 font-medium">{ex.description || '-'}</TableCell>
                  <TableCell className="font-black text-red-600">{formatLKR(ex.amount)}</TableCell>
                </TableRow>
              ))}
              {!loading && expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-16 text-slate-400">No general expenses recorded yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
