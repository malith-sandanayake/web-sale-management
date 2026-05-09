import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Leaf, Plus, Search, DollarSign, Edit2, Trash } from 'lucide-react';
import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { formatLKR } from '../../lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';

export default function Ingredients() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUpdateLoading, setIsUpdateLoading] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', unit: '', currentUnitCost: 0, isActive: true });
  const editFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetchIngredients();
  }, []);

  async function fetchIngredients() {
    try {
      const snap = await getDocs(collection(db, 'ingredients'));
      setIngredients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'ingredients');
    } finally {
      setLoading(false);
    }
  }

  const handleAddIngredient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      currentUnitCost: parseFloat(formData.get('cost') as string || '0'),
      isActive: true,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'ingredients'), data);
      toast.success("Ingredient added successfully");
      setIsAddOpen(false);
      fetchIngredients();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'ingredients');
    }
  };

  const openEditDialog = (ing: any) => {
    setEditingIngredient(ing);
    setEditForm({
      name: ing.name || '',
      unit: ing.unit || '',
      currentUnitCost: ing.currentUnitCost || 0,
      isActive: ing.isActive ?? true
    });
    setIsEditOpen(true);
  };

  const handleUpdateIngredient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingIngredient) return toast.error('No ingredient selected');
    if (!editForm.name.trim()) return toast.error('Name is required');
    setIsUpdateLoading(true);
    try {
      await updateDoc(doc(db, 'ingredients', editingIngredient.id), {
        name: editForm.name.trim(),
        unit: editForm.unit,
        currentUnitCost: parseFloat(String(editForm.currentUnitCost)) || 0,
        isActive: editForm.isActive,
        updatedAt: new Date().toISOString()
      });
      toast.success('Ingredient updated');
      setIsEditOpen(false);
      setEditingIngredient(null);
      fetchIngredients();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'ingredients');
    } finally {
      setIsUpdateLoading(false);
    }
  };

  const deleteIngredient = async (id: string) => {
    const ok = window.confirm('Delete this ingredient? This action cannot be undone.');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'ingredients', id));
      toast.success('Ingredient deleted');
      fetchIngredients();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'ingredients');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Ingredients</h1>
          <p className="text-slate-500 mt-1">Manage raw materials and their current market costs.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="bg-slate-900"><Plus className="w-4 h-4 mr-2" /> Add Ingredient</Button>} />
          <DialogContent>
            <form onSubmit={handleAddIngredient}>
              <DialogHeader>
                <DialogTitle>Add New Ingredient</DialogTitle>
                <DialogDescription>Add a new raw material to the inventory.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Ingredient Name</Label>
                  <Input id="name" name="name" required placeholder="e.g. Rice Flour" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="unit">Unit (kg, g, l, ml...)</Label>
                    <Input id="unit" name="unit" required placeholder="kg" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cost">Initial Unit Cost (LKR)</Label>
                    <Input id="cost" name="cost" type="number" step="0.01" defaultValue="0" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900">Save Ingredient</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingIngredient(null); }}>
          <DialogContent>
            <form ref={editFormRef} onSubmit={handleUpdateIngredient}>
              <DialogHeader>
                <DialogTitle>Edit Ingredient</DialogTitle>
                <DialogDescription>Update ingredient details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Ingredient Name</Label>
                  <Input id="edit-name" name="name" required value={editForm.name} onChange={(e) => setEditForm(prev => ({...prev, name: e.target.value}))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-unit">Unit</Label>
                    <Input id="edit-unit" name="unit" value={editForm.unit} onChange={(e) => setEditForm(prev => ({...prev, unit: e.target.value}))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-cost">Unit Cost (LKR)</Label>
                    <Input id="edit-cost" name="cost" type="number" step="0.01" value={String(editForm.currentUnitCost)} onChange={(e) => setEditForm(prev => ({...prev, currentUnitCost: parseFloat(e.target.value || '0')}))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditingIngredient(null); }}>Cancel</Button>
                <Button type="button" className="bg-slate-900" disabled={isUpdateLoading} onClick={() => editFormRef.current?.requestSubmit()}>
                  {isUpdateLoading ? 'Saving...' : 'Save Changes'}
                </Button>
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
                <TableHead className="px-6 font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Unit</TableHead>
                <TableHead className="font-semibold">Current Unit Cost</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1,2,3].map(i => (
                  <TableRow key={i}>
                    <TableCell colSpan={4} className="px-6 py-4"><div className="h-8 animate-pulse bg-slate-100 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : ingredients.map((ing) => (
                <TableRow key={ing.id} className="border-slate-50">
                  <TableCell className="px-6 font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center">
                        <Leaf className="w-4 h-4 text-emerald-600" />
                      </div>
                      {ing.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-slate-50 font-normal">{ing.unit}</Badge>
                  </TableCell>
                  <TableCell className="font-bold text-slate-700">{formatLKR(ing.currentUnitCost)}</TableCell>
                  <TableCell>
                    <Badge className={ing.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                      {ing.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(ing)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteIngredient(ing.id)}>
                        <Trash className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && ingredients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-400">No ingredients found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
