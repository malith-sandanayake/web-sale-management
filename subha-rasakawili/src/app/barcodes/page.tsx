import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Search, Printer, QrCode } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { formatLKR } from '../../lib/utils';

type ProductRow = {
  id: string;
  productCode: string;
  name: string;
  retailPrice: number;
  isActive: boolean;
};

function barsForCode(code: string) {
  const seed = code || '0000';
  return seed.split('').flatMap((character, index) => {
    const value = character.charCodeAt(0) + index;
    return [value % 2 === 0 ? 1 : 2, value % 3 === 0 ? 3 : 1, value % 5 === 0 ? 2 : 1];
  });
}

function BarcodeVisual({ code }: { code: string }) {
  return (
    <div className="flex h-12 items-end gap-[2px] bg-white">
      {barsForCode(code).map((width, index) => (
        <div key={index} className="bg-slate-950" style={{ width: `${width * 2}px`, height: index % 2 === 0 ? '100%' : '82%' }} />
      ))}
    </div>
  );
}

export default function Barcodes() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [labels, setLabels] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const snap = await getDocs(query(collection(db, 'products'), where('isActive', '==', true)));
        const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProductRow));
        setProducts(rows);
        setQuantities(Object.fromEntries(rows.map((product) => [product.id, 1])));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'barcodes');
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return products.filter((product) => product.name.toLowerCase().includes(term) || product.productCode?.toLowerCase().includes(term));
  }, [products, search]);

  const generateLabels = () => {
    const nextLabels = products.flatMap((product) => {
      if (!selected[product.id]) return [];
      return Array.from({ length: Math.max(1, Number(quantities[product.id] || 1)) }, () => product);
    });
    setLabels(nextLabels);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] animate-in fade-in duration-500">
      <Card className="border-none shadow-sm no-print">
        <CardHeader className="border-b pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-10 bg-slate-50 border-none" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {loading ? [1, 2, 3].map((row) => <div key={row} className="m-4 h-14 animate-pulse rounded bg-slate-100" />) : filtered.map((product) => (
            <label key={product.id} className="flex items-center gap-3 border-b border-slate-50 p-4 hover:bg-slate-50">
              <input type="checkbox" checked={!!selected[product.id]} onChange={(event) => setSelected((prev) => ({ ...prev, [product.id]: event.target.checked }))} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{product.name}</p>
                <p className="font-mono text-xs text-slate-400">{product.productCode}</p>
              </div>
              <Input className="w-20" type="number" min="1" value={quantities[product.id] || 1} onChange={(event) => setQuantities((prev) => ({ ...prev, [product.id]: Number(event.target.value || 1) }))} />
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 no-print md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Barcode Labels</h1>
            <p className="text-slate-500 mt-1">Generate print-ready product labels.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={generateLabels}><QrCode className="w-4 h-4 mr-2" /> Generate Labels</Button>
            <Button className="bg-slate-900" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Print Labels</Button>
          </div>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            {labels.length === 0 ? (
              <div className="text-center py-24 text-slate-400">Select products and generate labels.</div>
            ) : (
              <div className="print-only grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {labels.map((product, index) => (
                  <div key={`${product.id}-${index}`} className="break-inside-avoid rounded border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label className="text-base font-black text-slate-900">{product.name}</Label>
                        <p className="font-mono text-xs text-slate-500">{product.productCode}</p>
                      </div>
                      <Badge variant="outline">{formatLKR(product.retailPrice || 0)}</Badge>
                    </div>
                    <div className="mt-4"><BarcodeVisual code={product.productCode} /></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
