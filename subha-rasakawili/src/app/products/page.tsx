import { useState, useEffect, useRef, type FormEvent } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Plus, Search, Edit2, Check, X, Package, Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatLKR, generateNextProductCode } from '@/lib/utils';
import { toast } from 'sonner';
import { ProductAttribute, ProductCategory, UnitType } from '@/types';

const emptyAttribute: ProductAttribute = { key: '', value: '' };

function calculateProfitMargin(retailPrice: number, currentUnitCost: number) {
  if (!retailPrice || retailPrice <= 0) return 0;
  return ((retailPrice - currentUnitCost) / retailPrice) * 100;
}

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUpdateLoading, setIsUpdateLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [addForm, setAddForm] = useState({
    category: ProductCategory.FOOD,
    brandName: '',
    wholesalePrice: '',
    retailPrice: '',
    dealerPrice: '',
    lowStockThreshold: '5'
  });
  const [addAttributes, setAddAttributes] = useState<ProductAttribute[]>([]);
  const [editForm, setEditForm] = useState({
    name: '',
    unitType: UnitType.PIECE,
    category: ProductCategory.FOOD,
    brandName: '',
    wholesalePrice: '',
    retailPrice: '',
    dealerPrice: '',
    lowStockThreshold: '5',
    attributes: [] as ProductAttribute[]
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

  const handleAddProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nextCode = generateNextProductCode(products);
    const retailPrice = parseFloat(formData.get('retailPrice') as string);
    const currentUnitCost = parseFloat(formData.get('currentUnitCost') as string) || 0;
    const data = {
      productCode: nextCode,
      name: formData.get('name') as string,
      unitType: formData.get('unitType') as string,
      category: addForm.category,
      brandName: addForm.brandName.trim(),
      wholesalePrice: parseFloat(formData.get('wholesalePrice') as string),
      retailPrice,
      dealerPrice: parseFloat(addForm.dealerPrice) || null,
      lowStockThreshold: parseFloat(addForm.lowStockThreshold) || 5,
      attributes: addAttributes.filter((attribute) => attribute.key.trim() && attribute.value.trim()),
      profitMarginPercentage: calculateProfitMargin(retailPrice, currentUnitCost),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'products'), data);
      toast.success("Product added successfully");
      setIsAddOpen(false);
      setAddForm({ category: ProductCategory.FOOD, brandName: '', wholesalePrice: '', retailPrice: '', dealerPrice: '', lowStockThreshold: '5' });
      setAddAttributes([]);
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
      category: product.category || ProductCategory.FOOD,
      brandName: product.brandName || '',
      wholesalePrice: product.wholesalePrice?.toString() ?? '',
      retailPrice: product.retailPrice?.toString() ?? '',
      dealerPrice: product.dealerPrice?.toString() ?? '',
      lowStockThreshold: product.lowStockThreshold?.toString() ?? '5',
      attributes: Array.isArray(product.attributes) ? product.attributes : []
    });
    setIsEditOpen(true);
  };

  const handleUpdateProduct = async (e: FormEvent<HTMLFormElement>) => {
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
        category: editForm.category,
        brandName: editForm.brandName.trim(),
        wholesalePrice: wholesalePrice,
        retailPrice: retailPrice,
        dealerPrice: parseFloat(editForm.dealerPrice) || null,
        lowStockThreshold: parseFloat(editForm.lowStockThreshold) || 5,
        attributes: editForm.attributes.filter((attribute) => attribute.key.trim() && attribute.value.trim()),
        profitMarginPercentage: calculateProfitMargin(retailPrice, Number(editingProduct.currentUnitCost || 0)),
        updatedAt: new Date().toISOString()
      });

      toast.success("Product updated successfully");
      setIsEditOpen(false);
      setEditingProduct(null);
      setEditForm({
        name: '',
        unitType: UnitType.PIECE,
        category: ProductCategory.FOOD,
        brandName: '',
        wholesalePrice: '',
        retailPrice: '',
        dealerPrice: '',
        lowStockThreshold: '5',
        attributes: []
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

  const deleteProduct = async (id: string) => {
    const ok = window.confirm('Delete this product? This action cannot be undone.');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('Product deleted');
      fetchProducts();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'products');
    }
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.productCode && p.productCode.includes(search))
  );

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
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={addForm.category} onValueChange={(value) => setAddForm((prev) => ({ ...prev, category: value as ProductCategory }))}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {Object.values(ProductCategory).map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="brandName">Brand Name</Label>
                    <Input id="brandName" value={addForm.brandName} onChange={(event) => setAddForm((prev) => ({ ...prev, brandName: event.target.value }))} placeholder="Optional brand" />
                  </div>
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
                    <Input id="wholesalePrice" name="wholesalePrice" type="number" step="0.01" value={addForm.wholesalePrice} onChange={(event) => setAddForm((prev) => ({ ...prev, wholesalePrice: event.target.value }))} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="retailPrice">Retail Price (LKR)</Label>
                    <Input id="retailPrice" name="retailPrice" type="number" step="0.01" value={addForm.retailPrice} onChange={(event) => setAddForm((prev) => ({ ...prev, retailPrice: event.target.value }))} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dealerPrice">Dealer Price (LKR)</Label>
                    <Input id="dealerPrice" type="number" step="0.01" value={addForm.dealerPrice} onChange={(event) => setAddForm((prev) => ({ ...prev, dealerPrice: event.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                    <Input id="lowStockThreshold" type="number" step="1" min="0" value={addForm.lowStockThreshold} onChange={(event) => setAddForm((prev) => ({ ...prev, lowStockThreshold: event.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Profit Margin %</Label>
                  <Input readOnly value={`${calculateProfitMargin(Number(addForm.retailPrice || 0), 0).toFixed(2)}%`} className="bg-slate-50" />
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <Label>Attributes</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAddAttributes((prev) => [...prev, { ...emptyAttribute }])}>Add Attribute</Button>
                  </div>
                  {addAttributes.map((attribute, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2">
                      <Input placeholder="Key" value={attribute.key} onChange={(event) => setAddAttributes((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))} />
                      <Input placeholder="Value" value={attribute.value} onChange={(event) => setAddAttributes((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} />
                    </div>
                  ))}
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={editForm.category} onValueChange={(value) => setEditForm((prev) => ({ ...prev, category: value as ProductCategory }))}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {Object.values(ProductCategory).map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-brandName">Brand Name</Label>
                    <Input id="edit-brandName" value={editForm.brandName} onChange={(event) => setEditForm((prev) => ({ ...prev, brandName: event.target.value }))} />
                  </div>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-dealerPrice">Dealer Price (LKR)</Label>
                    <Input id="edit-dealerPrice" type="number" step="0.01" value={editForm.dealerPrice} onChange={(event) => setEditForm((prev) => ({ ...prev, dealerPrice: event.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-lowStockThreshold">Low Stock Threshold</Label>
                    <Input id="edit-lowStockThreshold" type="number" step="1" min="0" value={editForm.lowStockThreshold} onChange={(event) => setEditForm((prev) => ({ ...prev, lowStockThreshold: event.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Profit Margin %</Label>
                  <Input readOnly value={`${calculateProfitMargin(Number(editForm.retailPrice || 0), Number(editingProduct?.currentUnitCost || 0)).toFixed(2)}%`} className="bg-slate-50" />
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <Label>Attributes</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditForm((prev) => ({ ...prev, attributes: [...prev.attributes, { ...emptyAttribute }] }))}>Add Attribute</Button>
                  </div>
                  {editForm.attributes.map((attribute, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2">
                      <Input placeholder="Key" value={attribute.key} onChange={(event) => setEditForm((prev) => ({ ...prev, attributes: prev.attributes.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item) }))} />
                      <Input placeholder="Value" value={attribute.value} onChange={(event) => setEditForm((prev) => ({ ...prev, attributes: prev.attributes.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} />
                    </div>
                  ))}
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
                <TableHead className="w-[260px] font-semibold">Name</TableHead>
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
                    <TableCell colSpan={7}><div className="h-10 animate-pulse bg-slate-100 rounded w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.map((product) => (
                <TableRow key={product.id} className="border-slate-50 group">
                  <TableCell className="font-mono font-semibold text-slate-600">{product.productCode || '-'}</TableCell>
                  <TableCell className="font-medium text-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                        <Package className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <div>{product.name}</div>
                        {Array.isArray(product.attributes) && product.attributes.length > 0 && (
                          <div className="mt-1 hidden flex-wrap gap-1 group-hover:flex">
                            {product.attributes.map((attribute: ProductAttribute, index: number) => (
                              <Badge key={`${attribute.key}-${index}`} variant="outline" className="bg-slate-50 text-[10px] font-medium">
                                {attribute.key}: {attribute.value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
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
                      <Button variant="ghost" size="icon" onClick={() => deleteProduct(product.id)}>
                        <Trash className="w-4 h-4 text-red-500" />
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
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">
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
