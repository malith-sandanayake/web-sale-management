import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collection, doc, getDocs, query, orderBy, writeBatch } from 'firebase/firestore';
import { ClipboardList, Eye, PencilLine, Plus, Search, Trash2, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { Product, Ingredient, ProductRecipe } from '../../types';
import { recipeSchema } from '../../lib/validations';

type RecipeRowForm = {
  id: string;
  ingredientId: string;
  quantityPerUnit: string;
};

type RecipeFormState = {
  productId: string;
  rows: RecipeRowForm[];
};

type RecipeGroup = {
  product: Product;
  rows: ProductRecipe[];
};

const createRecipeRow = (ingredientId = '', quantityPerUnit = ''): RecipeRowForm => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  ingredientId,
  quantityPerUnit,
});

const emptyRecipeForm: RecipeFormState = {
  productId: '',
  rows: [createRecipeRow()],
};

export default function Recipes() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [viewingProductId, setViewingProductId] = useState<string | null>(null);
  const [recipeForm, setRecipeForm] = useState<RecipeFormState>(emptyRecipeForm);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [productSnap, ingredientSnap, recipeSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'ingredients'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'product_recipes')),
      ]);

      setProducts(productSnap.docs.map((currentDoc) => ({ id: currentDoc.id, ...currentDoc.data() } as Product)));
      setIngredients(ingredientSnap.docs.map((currentDoc) => ({ id: currentDoc.id, ...currentDoc.data() } as Ingredient)));
      setRecipes(recipeSnap.docs.map((currentDoc) => ({ id: currentDoc.id, ...currentDoc.data() } as ProductRecipe)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'product_recipes');
    } finally {
      setLoading(false);
    }
  }

  const ingredientLookup = useMemo(() => {
    return new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  }, [ingredients]);

  const recipeGroups = useMemo<RecipeGroup[]>(() => {
    const grouped = new Map<string, RecipeGroup>();

    recipes.forEach((recipe) => {
      const product = products.find((currentProduct) => currentProduct.id === recipe.productId);
      if (!product) return;

      const existing = grouped.get(recipe.productId);
      if (existing) {
        existing.rows.push(recipe);
      } else {
        grouped.set(recipe.productId, {
          product,
          rows: [recipe],
        });
      }
    });

    return Array.from(grouped.values()).sort((left, right) => left.product.name.localeCompare(right.product.name));
  }, [products, recipes]);

  const filteredRecipeGroups = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return recipeGroups;

    return recipeGroups.filter(({ product, rows }) => {
      if (product.name.toLowerCase().includes(term)) return true;
      if ((product.productCode || '').toLowerCase().includes(term)) return true;
      return rows.some((row) => {
        const ingredient = ingredientLookup.get(row.ingredientId);
        return ingredient?.name.toLowerCase().includes(term) || ingredient?.ingredientCode?.toLowerCase().includes(term);
      });
    });
  }, [ingredientLookup, recipeGroups, search]);

  const viewingRecipeGroup = useMemo(() => {
    if (!viewingProductId) return null;
    return recipeGroups.find((group) => group.product.id === viewingProductId) || null;
  }, [recipeGroups, viewingProductId]);

  const openCreateDialog = () => {
    setEditingProductId(null);
    setRecipeForm(emptyRecipeForm);
    setIsFormOpen(true);
  };

  const openEditDialog = (group: RecipeGroup) => {
    setEditingProductId(group.product.id);
    setRecipeForm({
      productId: group.product.id,
      rows: group.rows.length > 0
        ? group.rows.map((row) => ({
          id: `${row.id}`,
          ingredientId: row.ingredientId,
          quantityPerUnit: String(row.quantityPerUnit),
        }))
        : [createRecipeRow()],
    });
    setIsFormOpen(true);
  };

  const openViewDialog = (productId: string) => {
    setViewingProductId(productId);
    setIsViewOpen(true);
  };

  const closeFormDialog = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingProductId(null);
      setRecipeForm(emptyRecipeForm);
    }
  };

  const handleRowChange = (rowId: string, field: keyof Omit<RecipeRowForm, 'id'>, value: string) => {
    setRecipeForm((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    }));
  };

  const addRow = () => {
    setRecipeForm((current) => ({
      ...current,
      rows: [...current.rows, createRecipeRow()],
    }));
  };

  const removeRow = (rowId: string) => {
    setRecipeForm((current) => ({
      ...current,
      rows: current.rows.length > 1 ? current.rows.filter((row) => row.id !== rowId) : [createRecipeRow()],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = recipeSchema.safeParse({
      productId: recipeForm.productId,
      ingredients: recipeForm.rows.map((row) => ({
        ingredientId: row.ingredientId,
        quantityPerUnit: row.quantityPerUnit,
      })),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please correct the recipe form');
      return;
    }

    const ingredientIds = parsed.data.ingredients.map((row) => row.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      toast.error('Each ingredient can only be added once');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const batch = writeBatch(db);
      const existingRows = recipes.filter((row) => row.productId === parsed.data.productId);

      existingRows.forEach((row) => {
        batch.delete(doc(db, 'product_recipes', row.id));
      });

      parsed.data.ingredients.forEach((row) => {
        const recipeRef = doc(collection(db, 'product_recipes'));
        batch.set(recipeRef, {
          productId: parsed.data.productId,
          ingredientId: row.ingredientId,
          quantityPerUnit: row.quantityPerUnit,
          createdAt: now,
          updatedAt: now,
        });
      });

      await batch.commit();
      toast.success(existingRows.length > 0 ? 'Recipe updated successfully' : 'Recipe created successfully');
      closeFormDialog(false);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'product_recipes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (productId: string) => {
    const group = recipeGroups.find((currentGroup) => currentGroup.product.id === productId);
    if (!group) return;

    const confirmed = window.confirm(`Delete the recipe for ${group.product.name}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const batch = writeBatch(db);
      group.rows.forEach((row) => {
        batch.delete(doc(db, 'product_recipes', row.id));
      });
      await batch.commit();
      toast.success('Recipe deleted');
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'product_recipes');
    }
  };

  const viewRows = viewingRecipeGroup?.rows || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Recipes</h1>
          <p className="text-slate-500 mt-1">Link finished products to their ingredient bill of materials.</p>
        </div>
        <Button className="bg-slate-900" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" /> New Recipe
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by product, code, or ingredient..."
              className="pl-10 bg-slate-50 border-none h-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-slate-100">
                <TableHead className="w-24 font-semibold">Code</TableHead>
                <TableHead className="font-semibold">Product</TableHead>
                <TableHead className="font-semibold">Ingredients</TableHead>
                <TableHead className="font-semibold">Configured Rows</TableHead>
                <TableHead className="text-right font-semibold pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3].map((row) => (
                  <TableRow key={row}>
                    <TableCell colSpan={5} className="px-6 py-4">
                      <div className="h-8 animate-pulse bg-slate-100 rounded w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredRecipeGroups.map((group) => {
                const ingredientNames = group.rows
                  .map((row) => ingredientLookup.get(row.ingredientId)?.name || 'Unknown ingredient')
                  .slice(0, 3);

                return (
                  <TableRow key={group.product.id} className="border-slate-50 group">
                    <TableCell className="font-mono font-semibold text-slate-600">{group.product.productCode || '-'}</TableCell>
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                          <ClipboardList className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <div>{group.product.name}</div>
                          <Badge variant="outline" className="mt-1 bg-slate-50 font-normal">
                            {group.product.unitType}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <div className="flex flex-wrap gap-2">
                        {ingredientNames.map((name) => (
                          <Badge key={name} variant="outline" className="bg-slate-50 font-normal">
                            {name}
                          </Badge>
                        ))}
                        {group.rows.length > 3 && (
                          <Badge variant="outline" className="bg-slate-50 font-normal">
                            +{group.rows.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{group.rows.length} rows</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openViewDialog(group.product.id)} title="View recipe">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(group)} title="Edit recipe">
                          <PencilLine className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(group.product.id)} title="Delete recipe">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && filteredRecipeGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-slate-400">
                    No recipes found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={closeFormDialog}>
        <DialogContent className="max-w-3xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingProductId ? 'Edit Recipe' : 'New Recipe'}</DialogTitle>
              <DialogDescription>Create or update the ingredient formula for a product.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-auto pr-1">
              <div className="grid gap-2">
                <Label>Product</Label>
                <Select
                  value={recipeForm.productId}
                  onValueChange={(value) => setRecipeForm((current) => ({ ...current, productId: value }))}
                  disabled={Boolean(editingProductId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.productCode} - {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Ingredients</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addRow}>
                    <Plus className="w-4 h-4 mr-2" /> Add Row
                  </Button>
                </div>
                <div className="space-y-3">
                  {recipeForm.rows.map((row, index) => (
                    <div key={row.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
                      <div className="grid gap-2">
                        <Label>Ingredient {index + 1}</Label>
                        <Select value={row.ingredientId} onValueChange={(value) => handleRowChange(row.id, 'ingredientId', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select ingredient" />
                          </SelectTrigger>
                          <SelectContent>
                            {ingredients.map((ingredient) => (
                              <SelectItem key={ingredient.id} value={ingredient.id}>
                                {ingredient.ingredientCode} - {ingredient.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Quantity Per Unit</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.0001"
                          placeholder="0"
                          value={row.quantityPerUnit}
                          onChange={(event) => handleRowChange(row.id, 'quantityPerUnit', event.target.value)}
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.id)} title="Remove ingredient">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => closeFormDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-slate-900" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Recipe'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={(open) => { setIsViewOpen(open); if (!open) setViewingProductId(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewingRecipeGroup?.product.name || 'Recipe Details'}</DialogTitle>
            <DialogDescription>
              {viewingRecipeGroup?.product.productCode || '-'} - {viewingRecipeGroup?.product.unitType || ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-slate-100">
                  <TableHead className="font-semibold text-xs uppercase">Ingredient</TableHead>
                  <TableHead className="font-semibold text-xs uppercase">Code</TableHead>
                  <TableHead className="font-semibold text-xs uppercase">Unit</TableHead>
                  <TableHead className="font-semibold text-xs uppercase">Quantity Per Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewRows.length > 0 ? viewRows.map((row) => {
                  const ingredient = ingredientLookup.get(row.ingredientId);
                  return (
                    <TableRow key={row.id} className="border-slate-50">
                      <TableCell className="font-medium text-slate-900">{ingredient?.name || 'Unknown ingredient'}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{ingredient?.ingredientCode || '-'}</TableCell>
                      <TableCell>{ingredient?.unit || '-'}</TableCell>
                      <TableCell className="font-semibold">{Number(row.quantityPerUnit || 0)}</TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-slate-400">
                      No recipe rows available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
