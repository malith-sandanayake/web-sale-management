import { useState, useEffect, type FormEvent } from 'react';
import { collection, getDocs, query, orderBy, updateDoc, doc, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import { Plus, Trash2, Undo2, Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { formatLKR } from '../../../lib/utils';
import { toast } from 'sonner';
import { ReturnType, Supplier, StockMovementType, StockReferenceType } from '../../../types';
import { exportToCSV, exportToExcel, printTable } from '../../../lib/exportUtils';

export default function Purchases() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [returnPurchase, setReturnPurchase] = useState<any | null>(null);
  const [returnForm, setReturnForm] = useState({ quantity: '', reason: '' });
  const [selectedIngredient, setSelectedIngredient] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const q = query(collection(db, 'expense_purchases'), orderBy('purchaseDate', 'desc'));
      const [pSnap, iSnap, sSnap] = await Promise.all([
        getDocs(q),
        getDocs(collection(db, 'ingredients')),
        getDocs(collection(db, 'suppliers'))
      ]);
      
      const ingMap = iSnap.docs.reduce((acc: any, d) => {
        acc[d.id] = d.data().name;
        return acc;
      }, {});
      const supplierMap = sSnap.docs.reduce((acc: any, d) => {
        acc[d.id] = d.data().name;
        return acc;
      }, {});

      setIngredients(iSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSuppliers(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
      setPurchases(pSnap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        ingredientName: ingMap[d.data().ingredientId] || 'Unknown',
        supplierName: d.data().supplierId ? supplierMap[d.data().supplierId] || 'Unknown' : '-'
      })));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'purchases');
    } finally {
      setLoading(false);
    }
  }

  const handleAddPurchase = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const ingredientId = formData.get('ingredientId') as string;
    const quantity = parseFloat(formData.get('quantity') as string);
    const unitRate = parseFloat(formData.get('unitRate') as string);
    const totalAmount = quantity * unitRate;
    const supplierId = selectedSupplier || undefined;
    const notes = formData.get('notes') as string;
    const purchaseId = doc(collection(db, 'expense_purchases')).id;
    const createdAt = new Date().toISOString();

    try {
      await runTransaction(db, async (transaction) => {
        const ingredientRef = doc(db, 'ingredients', ingredientId);
        const ingredientSnap = await transaction.get(ingredientRef);
        if (!ingredientSnap.exists()) {
          throw new Error('Ingredient not found');
        }

        const ingredientData = ingredientSnap.data() as any;
        const currentStock = Number(ingredientData.currentStock || 0);
        const newStockBalance = currentStock + quantity;

        transaction.set(doc(db, 'expense_purchases', purchaseId), {
          ingredientId,
          supplierId: supplierId || null,
          purchaseDate: createdAt,
          quantity,
          unitRate,
          totalAmount,
          notes,
          createdAt,
        });

        transaction.update(ingredientRef, {
          currentUnitCost: unitRate,
          currentStock: newStockBalance,
          updatedAt: createdAt,
        });

        const stockMovementId = doc(collection(db, 'stock_movements')).id;
        transaction.set(doc(db, 'stock_movements', stockMovementId), {
          ingredientId,
          movementType: StockMovementType.STOCK_IN,
          quantity,
          unitCost: unitRate,
          totalValue: totalAmount,
          referenceType: StockReferenceType.PURCHASE,
          referenceId: purchaseId,
          notes,
          balanceAfter: newStockBalance,
          createdAt,
        });

        if (supplierId) {
          const supplierRef = doc(db, 'suppliers', supplierId);
          const supplierSnap = await transaction.get(supplierRef);
          if (!supplierSnap.exists()) {
            throw new Error('Supplier not found');
          }

          const supplierData = supplierSnap.data() as any;
          const balanceBefore = Number(supplierData.outstandingBalance || 0);
          const balanceAfter = balanceBefore + totalAmount;

          transaction.update(supplierRef, {
            outstandingBalance: balanceAfter,
            updatedAt: createdAt,
          });

          const supplierTransactionId = doc(collection(db, 'supplier_transactions')).id;
          transaction.set(doc(db, 'supplier_transactions', supplierTransactionId), {
            supplierId,
            type: 'PURCHASE',
            referenceId: purchaseId,
            amount: totalAmount,
            balanceBefore,
            balanceAfter,
            notes: notes || `Purchase of ${quantity} units`,
            createdAt,
          });
        }
      });

      toast.success("Purchase recorded successfully");
      setIsAddOpen(false);
      setSelectedIngredient("");
      setSelectedSupplier("");
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

  const openReturnDialog = (purchase: any) => {
    setReturnPurchase(purchase);
    setReturnForm({ quantity: String(purchase.quantity || ''), reason: '' });
  };

  const processPurchaseReturn = async () => {
    if (!returnPurchase) return;
    const quantity = Number(returnForm.quantity || 0);
    if (quantity <= 0 || quantity > Number(returnPurchase.quantity || 0)) return toast.error('Enter a valid return quantity');

    const createdAt = new Date().toISOString();
    const totalAmount = quantity * Number(returnPurchase.unitRate || 0);

    try {
      await runTransaction(db, async (transaction) => {
        const ingredientRef = doc(db, 'ingredients', returnPurchase.ingredientId);
        const ingredientSnap = await transaction.get(ingredientRef);
        if (!ingredientSnap.exists()) throw new Error('Ingredient not found');

        const ingredientData = ingredientSnap.data() as any;
        const balanceAfter = Math.max(0, Number(ingredientData.currentStock || 0) - quantity);
        const returnId = doc(collection(db, 'returns')).id;

        transaction.set(doc(db, 'returns', returnId), {
          returnType: ReturnType.PURCHASE_RETURN,
          originalPurchaseId: returnPurchase.id,
          partyId: returnPurchase.supplierId || '',
          items: [{ productId: '', ingredientId: returnPurchase.ingredientId, quantity, unitPrice: returnPurchase.unitRate, subtotal: totalAmount }],
          totalAmount,
          reason: returnForm.reason.trim(),
          createdAt,
        });

        transaction.update(ingredientRef, { currentStock: balanceAfter, updatedAt: createdAt });

        const stockMovementId = doc(collection(db, 'stock_movements')).id;
        transaction.set(doc(db, 'stock_movements', stockMovementId), {
          ingredientId: returnPurchase.ingredientId,
          movementType: StockMovementType.STOCK_OUT,
          quantity,
          unitCost: returnPurchase.unitRate,
          totalValue: totalAmount,
          referenceType: StockReferenceType.RETURN,
          referenceId: returnId,
          notes: returnForm.reason.trim(),
          balanceAfter,
          createdAt,
        });

        if (returnPurchase.supplierId) {
          const supplierRef = doc(db, 'suppliers', returnPurchase.supplierId);
          const supplierSnap = await transaction.get(supplierRef);
          if (supplierSnap.exists()) {
            const supplierData = supplierSnap.data() as any;
            const balanceBefore = Number(supplierData.outstandingBalance || 0);
            const supplierBalanceAfter = balanceBefore - totalAmount;
            transaction.update(supplierRef, { outstandingBalance: supplierBalanceAfter, updatedAt: createdAt });
            const supplierTransactionId = doc(collection(db, 'supplier_transactions')).id;
            transaction.set(doc(db, 'supplier_transactions', supplierTransactionId), {
              supplierId: returnPurchase.supplierId,
              type: 'PAYMENT',
              referenceId: returnId,
              amount: totalAmount,
              balanceBefore,
              balanceAfter: supplierBalanceAfter,
              notes: returnForm.reason.trim() || 'Purchase return credit',
              createdAt,
            });
          }
        }

        transaction.update(doc(db, 'expense_purchases', returnPurchase.id), { hasReturn: true, returnedAt: createdAt });
      });

      toast.success('Purchase return processed');
      setReturnPurchase(null);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'returns');
    }
  };

  const exportRows = purchases.map((purchase) => ({
    date: purchase.purchaseDate,
    ingredient: purchase.ingredientName,
    supplier: purchase.supplierName,
    quantity: purchase.quantity,
    unitRate: purchase.unitRate,
    totalAmount: purchase.totalAmount,
    status: purchase.isReversed ? 'Reversed' : purchase.hasReturn ? 'Returned' : 'Active',
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Material Purchases</h1>
          <p className="text-slate-500 mt-1">Track raw material stock-ins and costs.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) { setSelectedIngredient(""); setSelectedSupplier(""); } }}>
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
                <div className="grid gap-2">
                  <Label>Supplier (Optional)</Label>
                  <Select name="supplierId" value={selectedSupplier} onValueChange={(val) => setSelectedSupplier(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
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
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" name="notes" placeholder="Optional notes" />
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportToCSV(exportRows, 'purchases.csv')}><Download className="w-4 h-4 mr-2" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={() => exportToExcel(exportRows, 'purchases.xlsx')}><Download className="w-4 h-4 mr-2" /> Excel</Button>
        <Button variant="outline" size="sm" onClick={() => printTable('purchases-table')}><Printer className="w-4 h-4 mr-2" /> Print</Button>
      </div>

      <Card id="purchases-table" className="border-none shadow-sm overflow-hidden">
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
                    ) : p.hasReturn ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Returned</span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openReturnDialog(p)} title="Process return">
                          <Undo2 className="w-4 h-4 text-amber-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => reversePurchase(p.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
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

      <Dialog open={!!returnPurchase} onOpenChange={(open) => !open && setReturnPurchase(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Purchase Return</DialogTitle>
            <DialogDescription>{returnPurchase ? `Return ${returnPurchase.ingredientName}.` : 'Return purchase items.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="return-quantity">Quantity</Label>
              <Input id="return-quantity" type="number" min="0" max={returnPurchase?.quantity || 0} step="0.01" value={returnForm.quantity} onChange={(event) => setReturnForm((prev) => ({ ...prev, quantity: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="return-reason">Reason</Label>
              <Input id="return-reason" value={returnForm.reason} onChange={(event) => setReturnForm((prev) => ({ ...prev, reason: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnPurchase(null)}>Cancel</Button>
            <Button className="bg-slate-900" onClick={processPurchaseReturn}>Confirm Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
