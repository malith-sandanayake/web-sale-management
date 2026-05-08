import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Plus, Search, Edit2, Check, X, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatLKR } from '@/lib/utils';
import { toast } from 'sonner';
import { UnitType } from '@/types';

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUpdateLoading, setIsUpdateLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    unitType: UnitType.PIECE,
    wholesalePrice: '',
    retailPrice: ''
  });
  const editFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const snap = await getDocs(collection(db, 'products'));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'products');
    } finally {
      setLoading(false);
    }
  }

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      unitType: formData.get('unitType') as string,
      wholesalePrice: parseFloat(formData.get('wholesalePrice') as string),
      retailPrice: parseFloat(formData.get('retailPrice') as string),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'products'), data);
      toast.success("Product added successfully");
      setIsAddOpen(false);
      fetchProducts();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'products');
    }
  };

  const openEditDialog = (product: any) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name || '',
      unitType: product.unitType || UnitType.PIECE,
      wholesalePrice: product.wholesalePrice?.toString() ?? '',
      retailPrice: product.retailPrice?.toString() ?? ''
    });
    setIsEditOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) {
      toast.error("No product selected for editing");
      return;
    }

    if (!editForm.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    const wholesalePrice = parseFloat(editForm.wholesalePrice);
    const retailPrice = parseFloat(editForm.retailPrice);

    if (isNaN(wholesalePrice) || isNaN(retailPrice)) {
      toast.error("Please enter valid prices");
      return;
    }

    setIsUpdateLoading(true);

    try {
      await updateDoc(doc(db, 'products', editingProduct.id), {
        name: editForm.name.trim(),
        unitType: editForm.unitType,
        wholesalePrice: wholesalePrice,
        retailPrice: retailPrice,
        updatedAt: new Date().toISOString()
      });

      toast.success("Product updated successfully");
      setIsEditOpen(false);
      setEditingProduct(null);
      setEditForm({
        name: '',
        unitType: UnitType.PIECE,
        wholesalePrice: '',
        retailPrice: ''
      });
      fetchProducts();
    } catch (e) {
      console.error('Update error:', e);
      toast.error("Failed to update product");
      handleFirestoreError(e, OperationType.UPDATE, 'products');
    } finally {
      setIsUpdateLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'products', id), { isActive: !currentStatus });
      toast.success(`Product ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchProducts();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'products');
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Products</h1>
          <p className="text-slate-500 mt-1">Manage your product catalog and pricing.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="bg-slate-900">
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
          } />
          <DialogContent>
            <form onSubmit={handleAddProduct}>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>Enter the details for the new product.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input id="name" name="name" required placeholder="e.g. Asmi Large" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unitType">Unit Type</Label>
                  <Select name="unitType" defaultValue="PIECE">
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(UnitType).map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="wholesalePrice">Wholesale Price (LKR)</Label>
                    <Input id="wholesalePrice" name="wholesalePrice" type="number" step="0.01" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="retailPrice">Retail Price (LKR)</Label>
                    <Input id="retailPrice" name="retailPrice" type="number" step="0.01" required />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900">Save Product</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditingProduct(null);
          }
        }}>
          <DialogContent>
            <form ref={editFormRef} onSubmit={handleUpdateProduct}>
              <DialogHeader>
                <DialogTitle>Edit Product</DialogTitle>
                <DialogDescription>Update the details for this product.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Product Name</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    required
                    value={editForm.name}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-unitType">Unit Type</Label>
                  <Select
                    name="unitType"
                    value={editForm.unitType}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, unitType: value as UnitType }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(UnitType).map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-wholesalePrice">Wholesale Price (LKR)</Label>
                    <Input
                      id="edit-wholesalePrice"
                      name="wholesalePrice"
                      type="number"
                      step="0.01"
                      required
                      value={editForm.wholesalePrice}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, wholesalePrice: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-retailPrice">Retail Price (LKR)</Label>
                    <Input
                      id="edit-retailPrice"
                      name="retailPrice"
                      type="number"
                      step="0.01"
                      required
                      value={editForm.retailPrice}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, retailPrice: event.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditingProduct(null); }}>
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  className="bg-slate-900" 
                  disabled={isUpdateLoading}
                  onClick={() => editFormRef.current?.requestSubmit()}
                >
                  {isUpdateLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search products..." 
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
                <TableHead className="w-[300px] font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Unit</TableHead>
                <TableHead className="font-semibold">Wholesale Price</TableHead>
                <TableHead className="font-semibold">Retail Price</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1,2,3].map(i => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><div className="h-10 animate-pulse bg-slate-100 rounded w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.map((product) => (
                <TableRow key={product.id} className="border-slate-50">
                  <TableCell className="font-medium text-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                        <Package className="w-4 h-4 text-slate-500" />
                      </div>
                      {product.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-slate-50 font-normal">
                      {product.unitType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">{formatLKR(product.wholesalePrice)}</TableCell>
                  <TableCell className="font-medium text-slate-700">{formatLKR(product.retailPrice)}</TableCell>
                  <TableCell>
                    <Badge className={product.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                      {product.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                        <Edit2 className="w-4 h-4 text-slate-600" />
                      </Button>
                       <Button variant="ghost" size="icon" onClick={() => toggleStatus(product.id, product.isActive)}>
                        {product.isActive ? <X className="w-4 h-4 text-red-500" /> : <Check className="w-4 h-4 text-emerald-500" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    No products found.
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
