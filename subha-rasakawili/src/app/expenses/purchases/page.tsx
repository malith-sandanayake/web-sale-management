import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import { Plus, ShoppingCart, Calendar, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { formatLKR } from '../../../lib/utils';
import { toast } from 'sonner';

export default function Purchases() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const q = query(collection(db, 'expense_purchases'), orderBy('purchaseDate', 'desc'));
      const [pSnap, iSnap] = await Promise.all([
        getDocs(q),
        getDocs(collection(db, 'ingredients'))
      ]);
      
      const ingMap = iSnap.docs.reduce((acc: any, d) => {
        acc[d.id] = d.data().name;
        return acc;
      }, {});

      setIngredients(iSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPurchases(pSnap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        ingredientName: ingMap[d.data().ingredientId] || 'Unknown'
      })));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'purchases');
    } finally {
      setLoading(false);
    }
  }

  const handleAddPurchase = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const ingredientId = formData.get('ingredientId') as string;
    const quantity = parseFloat(formData.get('quantity') as string);
    const unitRate = parseFloat(formData.get('unitRate') as string);
    const totalAmount = quantity * unitRate;

    const data = {
      ingredientId,
      purchaseDate: new Date().toISOString(),
      quantity,
      unitRate,
      totalAmount,
      supplier: formData.get('supplier') as string,
      notes: formData.get('notes') as string
    };

    try {
      await addDoc(collection(db, 'expense_purchases'), data);
      // Update ingredient current cost
      await updateDoc(doc(db, 'ingredients', ingredientId), { currentUnitCost: unitRate });
      
      toast.success("Purchase recorded and unit cost updated!");
      setIsAddOpen(false);
      fetchData();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'purchases');
    }
  };

  const reversePurchase = async (purchaseId: string) => {
    const confirmed = window.confirm('Reverse this purchase? This will mark it as reversed and exclude it from total purchase reports.');
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'expense_purchases', purchaseId), {
        isReversed: true,
        reversedAt: new Date().toISOString()
      });
      toast.success('Purchase reversed successfully');
      fetchData();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'expense_purchases');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Material Purchases</h1>
          <p className="text-slate-500 mt-1">Track raw material stock-ins and costs.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setSelectedIngredient(""); }}>
          <DialogTrigger render={<Button className="bg-slate-900"><Plus className="w-4 h-4 mr-2" /> New Purchase</Button>} />
          <DialogContent>
            <form onSubmit={handleAddPurchase}>
              <DialogHeader>
                <DialogTitle>Record New Purchase</DialogTitle>
                <DialogDescription>This will also update the current unit cost of the ingredient.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Ingredient</Label>
                  <Select name="ingredientId" required value={selectedIngredient} onValueChange={(val) => setSelectedIngredient(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ingredient">
                        {ingredients.find(i => i.id === selectedIngredient)?.name ?? undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients.map(ing => (
                        <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input id="quantity" name="quantity" type="number" step="0.01" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="unitRate">Unit Rate (LKR)</Label>
                    <Input id="unitRate" name="unitRate" type="number" step="0.01" required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input id="supplier" name="supplier" placeholder="e.g. Arpico Wholesale" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900">Record Purchase</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50 border-slate-100">
                <TableHead className="px-6 font-semibold capitalize text-xs">Date</TableHead>
                <TableHead className="font-semibold capitalize text-xs">Ingredient</TableHead>
                <TableHead className="font-semibold capitalize text-xs">Quantity</TableHead>
                <TableHead className="font-semibold capitalize text-xs">Unit Rate</TableHead>
                <TableHead className="font-semibold capitalize text-xs">Total Amount</TableHead>
                <TableHead className="text-right font-semibold capitalize text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 [1,2,3].map(i => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="px-6 py-4"><div className="h-8 animate-pulse bg-slate-100 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : purchases.map((p) => (
                <TableRow key={p.id} className="border-slate-50">
                  <TableCell className="px-6 text-slate-500 font-medium">
                    {new Date(p.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900">{p.ingredientName}</TableCell>
                  <TableCell>{p.quantity}</TableCell>
                  <TableCell className="text-slate-600 font-medium">{formatLKR(p.unitRate)}</TableCell>
                  <TableCell className="font-black text-slate-900">{formatLKR(p.totalAmount)}</TableCell>
                  <TableCell className="text-right">
                    {p.isReversed ? (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Reversed</span>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => reversePurchase(p.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && purchases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-slate-400">No purchases recorded yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
