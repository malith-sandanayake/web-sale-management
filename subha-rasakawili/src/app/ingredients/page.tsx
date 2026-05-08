import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Leaf, Plus, Search, DollarSign } from 'lucide-react';
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
                </TableRow>
              ))}
              {!loading && ingredients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-slate-400">No ingredients found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
