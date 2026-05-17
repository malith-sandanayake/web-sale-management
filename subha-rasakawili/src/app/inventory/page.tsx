import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collection, doc, getDocs, query, orderBy, runTransaction, addDoc } from 'firebase/firestore';
import { Factory, History, Plus, Search, Warehouse } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { formatLKR, generateNextIngredientCode } from '../../lib/utils';
import { Ingredient, Product, ProductRecipe, StockMovement, StockMovementType, StockReferenceType, Supplier } from '../../types';
import { toast } from 'sonner';
import { productionRunSchema } from '../../lib/validations';

const emptyAdjustForm = {
  quantity: '',
  notes: '',
  movementType: StockMovementType.STOCK_IN,
  referenceType: StockReferenceType.ADJUSTMENT,
};

const emptyAddForm = {
  name: '',
  unit: '',
  currentUnitCost: '',
  reorderLevel: '',
};

export default function Inventory() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productRecipes, setProductRecipes] = useState<ProductRecipe[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isProductionOpen, setIsProductionOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [adjustForm, setAdjustForm] = useState(emptyAdjustForm);
  const [productionForm, setProductionForm] = useState({ productId: '', quantityProduced: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isProducing, setIsProducing] = useState(false);

    const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
    const [addForm, setAddForm] = useState(emptyAddForm);
    const [addIngredientSource, setAddIngredientSource] = useState<'IN_HOUSE' | 'SOURCED'>('IN_HOUSE');
    const [addIngredientSupplierId, setAddIngredientSupplierId] = useState<string>('');
    const [isAddingSaving, setIsAddingSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [ingredientSnap, movementSnap, supplierSnap, productSnap, recipeSnap] = await Promise.all([
        getDocs(query(collection(db, 'ingredients'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'stock_movements'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'suppliers')),
        getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'product_recipes')),
      ]);

      setIngredients(ingredientSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Ingredient)));
      setMovements(movementSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StockMovement)));
      setSuppliers(supplierSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Supplier)));
      setProducts(productSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      setProductRecipes(recipeSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductRecipe)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    } finally {
      setLoading(false);
    }
  }

  const filteredIngredients = useMemo(() => {
    const term = search.toLowerCase();
    return ingredients.filter((ingredient) => {
      return (
        ingredient.name.toLowerCase().includes(term) ||
        ingredient.ingredientCode.toLowerCase().includes(term) ||
        ingredient.unit.toLowerCase().includes(term)
      );
    });
  }, [ingredients, search]);

  const summary = useMemo(() => {
    const totalInventoryValue = ingredients.reduce((sum, ingredient) => {
      return sum + Number(ingredient.currentStock || 0) * Number(ingredient.currentUnitCost || 0);
    }, 0);
    const lowStockCount = ingredients.filter((ingredient) => Number(ingredient.currentStock || 0) > 0 && Number(ingredient.currentStock || 0) <= Number(ingredient.reorderLevel || 0)).length;
    const outOfStockCount = ingredients.filter((ingredient) => Number(ingredient.currentStock || 0) <= 0).length;

    return { totalInventoryValue, lowStockCount, outOfStockCount };
  }, [ingredients]);

  const ingredientMovements = useMemo(() => {
    if (!selectedIngredient) return [];
    return movements
      .filter((movement) => movement.ingredientId === selectedIngredient.id)
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements, selectedIngredient]);

  const openAdjustDialog = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setAdjustForm(emptyAdjustForm);
    setIsAdjustOpen(true);
  };

  const openHistoryDialog = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setIsHistoryOpen(true);
  };

    const handleAddIngredient = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const nextCode = generateNextIngredientCode(ingredients);

      if (!addForm.name.trim() || !addForm.unit.trim()) {
        return toast.error('Ingredient name and unit are required');
      }

      setIsAddingSaving(true);
      try {
        await addDoc(collection(db, 'ingredients'), {
          ingredientCode: nextCode,
          name: addForm.name.trim(),
          unit: addForm.unit.trim(),
          currentUnitCost: parseFloat(addForm.currentUnitCost) || 0,
          currentStock: 0,
          reorderLevel: parseFloat(addForm.reorderLevel) || 0,
          source: addIngredientSource,
          supplierId: addIngredientSource === 'SOURCED' ? addIngredientSupplierId || null : null,
          isActive: true,
          createdAt: new Date().toISOString(),
        });
        toast.success('Ingredient added to inventory');
        setIsAddIngredientOpen(false);
        setAddForm(emptyAddForm);
        setAddIngredientSource('IN_HOUSE');
        setAddIngredientSupplierId('');
        fetchData();
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'ingredients');
      } finally {
        setIsAddingSaving(false);
      }
    };

  const handleAdjustStock = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedIngredient) return toast.error('No ingredient selected');

    const quantityValue = Number(adjustForm.quantity || 0);
    if (quantityValue === 0) return toast.error('Quantity must be greater than zero');

    const signedQuantity = adjustForm.movementType === StockMovementType.STOCK_OUT
      ? -Math.abs(quantityValue)
      : quantityValue;
    const storedQuantity = Math.abs(quantityValue);
    const createdAt = new Date().toISOString();
    const movementId = doc(collection(db, 'stock_movements')).id;

    setIsSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        const ingredientRef = doc(db, 'ingredients', selectedIngredient.id);
        const ingredientSnap = await transaction.get(ingredientRef);
        if (!ingredientSnap.exists()) {
          throw new Error('Ingredient not found');
        }

        const ingredientData = ingredientSnap.data() as any;
        const currentStock = Number(ingredientData.currentStock || 0);
        const newStock = currentStock + signedQuantity;
        if (newStock < 0) {
          throw new Error('Stock cannot go below zero');
        }

        transaction.update(ingredientRef, {
          currentStock: newStock,
          updatedAt: createdAt,
        });

        transaction.set(doc(db, 'stock_movements', movementId), {
          ingredientId: selectedIngredient.id,
          movementType: adjustForm.movementType,
          quantity: storedQuantity,
          unitCost: Number(ingredientData.currentUnitCost || 0),
          totalValue: storedQuantity * Number(ingredientData.currentUnitCost || 0),
          referenceType: adjustForm.referenceType,
          notes: adjustForm.notes.trim(),
          balanceAfter: newStock,
          createdAt,
        });
      });

      toast.success('Stock adjusted successfully');
      setIsAdjustOpen(false);
      setSelectedIngredient(null);
      setAdjustForm(emptyAdjustForm);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stock_movements');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecordProduction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = productionRunSchema.safeParse(productionForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please correct the production form');
      return;
    }

    const product = products.find((currentProduct) => currentProduct.id === parsed.data.productId);
    if (!product) {
      toast.error('Select a valid product');
      return;
    }

    const recipeRows = productRecipes.filter((row) => row.productId === parsed.data.productId);
    if (recipeRows.length === 0) {
      toast.error('No recipe configured for the selected product');
      return;
    }

    setIsProducing(true);
    try {
      const createdAt = new Date().toISOString();
      const productionReferenceId = `PROD-${Date.now()}`;
      const requiredIngredients = recipeRows.map((row) => ({
        ...row,
        totalRequired: Number(row.quantityPerUnit || 0) * Number(parsed.data.quantityProduced),
      }));

      await runTransaction(db, async (transaction) => {
        const ingredientSnapshots = await Promise.all(
          requiredIngredients.map((item) => transaction.get(doc(db, 'ingredients', item.ingredientId)))
        );

        ingredientSnapshots.forEach((snapshot, index) => {
          if (!snapshot.exists()) {
            throw new Error('One or more ingredients could not be found');
          }

          const ingredientData = snapshot.data() as Ingredient;
          const required = requiredIngredients[index].totalRequired;
          const currentStock = Number(ingredientData.currentStock || 0);

          if (currentStock < required) {
            throw new Error(`Insufficient stock for ${ingredientData.name}`);
          }
        });

        ingredientSnapshots.forEach((snapshot, index) => {
          const ingredientData = snapshot.data() as Ingredient;
          const required = requiredIngredients[index].totalRequired;
          const currentStock = Number(ingredientData.currentStock || 0);
          const newStock = currentStock - required;
          const movementRef = doc(collection(db, 'stock_movements'));

          transaction.update(snapshot.ref, {
            currentStock: newStock,
            updatedAt: createdAt,
          });

          transaction.set(movementRef, {
            ingredientId: ingredientData.id,
            movementType: StockMovementType.STOCK_OUT,
            quantity: required,
            unitCost: Number(ingredientData.currentUnitCost || 0),
            totalValue: required * Number(ingredientData.currentUnitCost || 0),
            referenceType: StockReferenceType.PRODUCTION,
            referenceId: productionReferenceId,
            notes: `Production run for ${product.name}`,
            balanceAfter: newStock,
            createdAt,
          });
        });
      });

      toast.success('Production recorded successfully');
      setIsProductionOpen(false);
      setProductionForm({ productId: '', quantityProduced: '' });
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to record production';
      if (message.startsWith('Insufficient stock') || message.includes('recipe configured')) {
        toast.error(message);
      } else {
        handleFirestoreError(error, OperationType.WRITE, 'stock_movements');
      }
    } finally {
      setIsProducing(false);
    }
  };

  const getStatus = (ingredient: Ingredient) => {
    const stock = Number(ingredient.currentStock || 0);
    const reorderLevel = Number(ingredient.reorderLevel || 0);
    if (stock <= 0) return { label: 'OUT OF STOCK', className: 'bg-red-100 text-red-700 hover:bg-red-100' };
    if (stock <= reorderLevel) return { label: 'LOW STOCK', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' };
    return { label: 'OK', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Inventory</h1>
          <p className="text-slate-500 mt-1">Monitor stock levels and record inventory movements.</p>
        </div>
        <Dialog open={isProductionOpen} onOpenChange={setIsProductionOpen}>
          <DialogTrigger render={<Button className="bg-slate-900"><Factory className="w-4 h-4 mr-2" /> Record Production</Button>} />
          <DialogContent>
            <form onSubmit={handleRecordProduction}>
              <DialogHeader>
                <DialogTitle>Record Production</DialogTitle>
                <DialogDescription>Deduct raw ingredients and log stock movements for a finished product run.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Product</Label>
                  <Select value={productionForm.productId} onValueChange={(value) => setProductionForm((prev) => ({ ...prev, productId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.filter((product) => product.isActive).map((product) => (
                        <SelectItem key={product.id} value={product.id}>{product.productCode} - {product.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quantity-produced">Quantity Produced</Label>
                  <Input
                    id="quantity-produced"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={productionForm.quantityProduced}
                    onChange={(event) => setProductionForm((prev) => ({ ...prev, quantityProduced: event.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsProductionOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900" disabled={isProducing}>{isProducing ? 'Recording...' : 'Record Production'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
         <Dialog open={isAddIngredientOpen} onOpenChange={(open) => { setIsAddIngredientOpen(open); if (!open) { setAddIngredientSource('IN_HOUSE'); setAddIngredientSupplierId(''); } }}>
           <DialogTrigger render={<Button className="bg-slate-900"><Plus className="w-4 h-4 mr-2" /> Add Ingredient</Button>} />
           <DialogContent>
             <form onSubmit={handleAddIngredient}>
               <DialogHeader>
                 <DialogTitle>Add New Ingredient</DialogTitle>
                 <DialogDescription>Add a new ingredient to your inventory.</DialogDescription>
               </DialogHeader>
               <div className="grid gap-4 py-4">
                 <div className="grid gap-2">
                   <Label>Ingredient Source</Label>
                   <Select value={addIngredientSource} onValueChange={(value) => { setAddIngredientSource(value as 'IN_HOUSE' | 'SOURCED'); setAddIngredientSupplierId(''); }}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="IN_HOUSE">Made In-House</SelectItem>
                       <SelectItem value="SOURCED">Sourced from Supplier</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 {addIngredientSource === 'SOURCED' && (
                   <div className="grid gap-2">
                     <Label>Supplier</Label>
                     <Select value={addIngredientSupplierId} onValueChange={setAddIngredientSupplierId}>
                       <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                       <SelectContent>
                         {suppliers.map((supplier) => (
                           <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                 )}
                 <div className="grid gap-2">
                   <Label htmlFor="ingredient-name">Ingredient Name</Label>
                   <Input id="ingredient-name" value={addForm.name} onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))} required placeholder="e.g. Rice" />
                 </div>
                 <div className="grid gap-2">
                   <Label htmlFor="ingredient-unit">Unit</Label>
                   <Input id="ingredient-unit" value={addForm.unit} onChange={(e) => setAddForm((prev) => ({ ...prev, unit: e.target.value }))} required placeholder="e.g. kg" />
                 </div>
                 <div className="grid gap-2">
                   <Label htmlFor="ingredient-cost">Initial Unit Cost (LKR)</Label>
                   <Input id="ingredient-cost" type="number" step="0.01" min="0" value={addForm.currentUnitCost} onChange={(e) => setAddForm((prev) => ({ ...prev, currentUnitCost: e.target.value }))} defaultValue="0" />
                 </div>
                 <div className="grid gap-2">
                   <Label htmlFor="ingredient-reorder">Reorder Level</Label>
                   <Input id="ingredient-reorder" type="number" step="0.01" min="0" value={addForm.reorderLevel} onChange={(e) => setAddForm((prev) => ({ ...prev, reorderLevel: e.target.value }))} defaultValue="0" />
                 </div>
               </div>
               <DialogFooter>
                 <Button type="button" variant="outline" onClick={() => { setIsAddIngredientOpen(false); setAddIngredientSource('IN_HOUSE'); setAddIngredientSupplierId(''); }}>Cancel</Button>
                 <Button type="submit" className="bg-slate-900" disabled={isAddingSaving}>{isAddingSaving ? 'Adding...' : 'Add Ingredient'}</Button>
               </DialogFooter>
             </form>
           </DialogContent>
         </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Inventory Value</p>
            <h3 className="text-3xl font-black text-slate-900 mt-2">{formatLKR(summary.totalInventoryValue)}</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Low Stock Count</p>
            <h3 className="text-3xl font-black text-amber-600 mt-2">{summary.lowStockCount}</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Out of Stock Count</p>
            <h3 className="text-3xl font-black text-red-600 mt-2">{summary.outOfStockCount}</h3>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by code, name, or unit..."
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
                <TableHead className="font-semibold px-6">Ingredient</TableHead>
                <TableHead className="font-semibold">Unit</TableHead>
                <TableHead className="font-semibold">Current Stock</TableHead>
                <TableHead className="font-semibold">Reorder Level</TableHead>
                <TableHead className="font-semibold">Unit Cost</TableHead>
                <TableHead className="font-semibold">Total Stock Value</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Source</TableHead>
                <TableHead className="text-right font-semibold pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3].map((row) => (
                  <TableRow key={row}>
                    <TableCell colSpan={10} className="px-6 py-4"><div className="h-8 animate-pulse bg-slate-100 rounded w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredIngredients.map((ingredient) => {
                const status = getStatus(ingredient);
                const source = ingredient.source === 'SOURCED'
                  ? { label: 'Supplier', className: 'bg-sky-100 text-sky-700 hover:bg-sky-100' }
                  : { label: 'In-House', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100' };
                const totalValue = Number(ingredient.currentStock || 0) * Number(ingredient.currentUnitCost || 0);
                return (
                  <TableRow key={ingredient.id} className="border-slate-50 group">
                    <TableCell className="font-mono font-semibold text-slate-600">{ingredient.ingredientCode || '-'}</TableCell>
                    <TableCell className="px-6 font-medium text-slate-900">
                      <button className="flex items-center gap-3 text-left hover:text-slate-700" onClick={() => openHistoryDialog(ingredient)}>
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <Warehouse className="w-4 h-4" />
                        </div>
                        <span>{ingredient.name}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-semibold tracking-tight">{ingredient.unit}</Badge>
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">{Number(ingredient.currentStock || 0)}</TableCell>
                    <TableCell className="text-slate-500">{Number(ingredient.reorderLevel || 0)}</TableCell>
                    <TableCell className="text-slate-600">{formatLKR(ingredient.currentUnitCost || 0)}</TableCell>
                    <TableCell className="font-black text-slate-900">{formatLKR(totalValue)}</TableCell>
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={source.className}>{source.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openAdjustDialog(ingredient)} title="Adjust stock">
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openHistoryDialog(ingredient)} title="View stock movements">
                          <History className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && filteredIngredients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16 text-slate-400">No ingredients found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAdjustOpen} onOpenChange={(open) => { setIsAdjustOpen(open); if (!open) setSelectedIngredient(null); }}>
        <DialogContent>
          <form onSubmit={handleAdjustStock}>
            <DialogHeader>
              <DialogTitle>Adjust Stock</DialogTitle>
              <DialogDescription>{selectedIngredient ? `Record a movement for ${selectedIngredient.name}.` : 'Record a stock movement.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Movement Type</Label>
                <Select value={adjustForm.movementType} onValueChange={(value) => setAdjustForm((prev) => ({ ...prev, movementType: value as StockMovementType }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {Object.values(StockMovementType).map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Reference Type</Label>
                <Select value={adjustForm.referenceType} onValueChange={(value) => setAdjustForm((prev) => ({ ...prev, referenceType: value as StockReferenceType }))}>
                  <SelectTrigger><SelectValue placeholder="Select reference" /></SelectTrigger>
                  <SelectContent>
                    {Object.values(StockReferenceType).map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" type="number" step="0.01" value={adjustForm.quantity} onChange={(e) => setAdjustForm((prev) => ({ ...prev, quantity: e.target.value }))} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" value={adjustForm.notes} onChange={(e) => setAdjustForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAdjustOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-slate-900" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Adjustment'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={(open) => { setIsHistoryOpen(open); if (!open) setSelectedIngredient(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Stock Movement History</DialogTitle>
            <DialogDescription>{selectedIngredient ? `${selectedIngredient.name} - ${selectedIngredient.ingredientCode}` : 'Movement history'}</DialogDescription>
          </DialogHeader>
          {selectedIngredient && (
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-100">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50 border-slate-100">
                    <TableHead className="font-semibold text-xs uppercase">Date</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Type</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Reference</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Quantity</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Unit Cost</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Total Value</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Balance After</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredientMovements.length > 0 ? ingredientMovements.map((movement) => (
                    <TableRow key={movement.id} className="border-slate-50">
                      <TableCell className="text-slate-500">{new Date(movement.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                      <TableCell>
                        <Badge variant={movement.movementType === StockMovementType.STOCK_IN ? 'default' : 'secondary'}>{movement.movementType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{movement.referenceType}</TableCell>
                      <TableCell className="font-semibold">{movement.movementType === StockMovementType.STOCK_OUT ? `- ${movement.quantity}` : movement.quantity}</TableCell>
                      <TableCell>{formatLKR(movement.unitCost)}</TableCell>
                      <TableCell>{formatLKR(movement.totalValue)}</TableCell>
                      <TableCell className="font-semibold">{Number(movement.balanceAfter || 0)}</TableCell>
                      <TableCell className="text-slate-500 max-w-60 truncate">{movement.notes || '-'}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-400">No stock movements recorded yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
