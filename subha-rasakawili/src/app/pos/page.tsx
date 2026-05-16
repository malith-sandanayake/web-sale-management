import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { formatLKR, generateInvoiceNo, generateNextDueCode, generateReceiptNo } from '../../lib/utils';
import { CustomerType, PaymentType, ProductCategory, StockMovementType, StockReferenceType } from '../../types';
import { toast } from 'sonner';

type ProductRow = any;
type CustomerRow = any;
type CartItem = { productId: string; name: string; quantity: number; unitPrice: number; subtotal: number; unitType: string };
type DiscountType = 'FLAT' | 'PERCENTAGE';

export default function POS() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [dues, setDues] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>(CustomerType.RETAIL);
  const [items, setItems] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const [discountType, setDiscountType] = useState<DiscountType>('FLAT');
  const [discountValue, setDiscountValue] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.CASH);
  const [paidAmount, setPaidAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [productSnap, customerSnap, dueSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
          getDocs(collection(db, 'customers')),
          getDocs(collection(db, 'due_ledger')),
        ]);
        setProducts(productSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCustomers(customerSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setDues(dueSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'pos');
      }
    }
    fetchData();
  }, []);

  const priceForProduct = (product: ProductRow) => {
    if (customerType === CustomerType.WHOLESALE) return Number(product.wholesalePrice || product.retailPrice || 0);
    if (customerType === CustomerType.DEALER) return Number(product.dealerPrice || product.wholesalePrice || product.retailPrice || 0);
    return Number(product.retailPrice || 0);
  };

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return products.filter((product) => {
      const matchesSearch = product.name?.toLowerCase().includes(term) || product.productCode?.toLowerCase().includes(term);
      const matchesCategory = category === 'ALL' || product.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = discountType === 'PERCENTAGE' ? subtotal * (Number(discountValue || 0) / 100) : Number(discountValue || 0);
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const changeDue = Number(paidAmount || 0) - totalAmount;

  const addProduct = (product: ProductRow) => {
    const unitPrice = priceForProduct(product);
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice } : item);
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, unitPrice, subtotal: unitPrice, unitType: product.unitType || 'PIECE' }];
    });
  };

  const updateQuantity = (productId: string, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setItems((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }
    setItems((prev) => prev.map((item) => item.productId === productId ? { ...item, quantity: nextQuantity, subtotal: nextQuantity * item.unitPrice } : item));
  };

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomer(customerId);
    const customer = customers.find((row) => row.id === customerId);
    const nextType = customer?.customerType || CustomerType.RETAIL;
    setCustomerType(nextType);
    setItems((prev) => prev.map((item) => {
      const product = products.find((row) => row.id === item.productId);
      const unitPrice = product ? (nextType === CustomerType.WHOLESALE ? Number(product.wholesalePrice || product.retailPrice || 0) : nextType === CustomerType.DEALER ? Number(product.dealerPrice || product.wholesalePrice || product.retailPrice || 0) : Number(product.retailPrice || 0)) : item.unitPrice;
      return { ...item, unitPrice, subtotal: unitPrice * item.quantity };
    }));
  };

  const completeSale = async () => {
    if (!selectedCustomer) return toast.error('Please select a customer');
    if (items.length === 0) return toast.error('Please add at least one item');

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const receiptId = doc(collection(db, 'receipts')).id;
      const receiptNumber = generateReceiptNo();
      const invoiceNumber = generateInvoiceNo();
      const createdAt = new Date().toISOString();

      batch.set(doc(db, 'receipts', receiptId), {
        receiptNumber,
        customerId: selectedCustomer,
        saleDate: createdAt,
        subtotal,
        discountType,
        discountAmount,
        totalAmount,
        paymentType,
        createdAt,
      });

      items.forEach((item) => {
        const itemId = doc(collection(db, 'receipt_items')).id;
        batch.set(doc(db, 'receipt_items', itemId), { receiptId, productId: item.productId, quantity: item.quantity, unitType: item.unitType, unitPrice: item.unitPrice, subtotal: item.subtotal });

        const movementId = doc(collection(db, 'stock_movements')).id;
        batch.set(doc(db, 'stock_movements', movementId), {
          productId: item.productId,
          movementType: StockMovementType.STOCK_OUT,
          quantity: item.quantity,
          unitCost: item.unitPrice,
          totalValue: item.subtotal,
          referenceType: StockReferenceType.SALE,
          referenceId: receiptId,
          notes: `POS sale ${receiptNumber}`,
          balanceAfter: null,
          createdAt,
        });

        const product = products.find((row) => row.id === item.productId);
        if (typeof product?.currentStock === 'number') {
          batch.update(doc(db, 'products', item.productId), { currentStock: Number(product.currentStock || 0) - item.quantity, updatedAt: createdAt });
        }
      });

      const paymentId = doc(collection(db, 'payments')).id;
      batch.set(doc(db, 'payments', paymentId), {
        invoiceNumber,
        receiptId,
        paymentType,
        amount: paymentType === PaymentType.CREDIT ? 0 : totalAmount,
        paymentDate: createdAt,
      });

      if (paymentType === PaymentType.CREDIT) {
        const dueId = doc(collection(db, 'due_ledger')).id;
        batch.set(doc(db, 'due_ledger', dueId), {
          dueCode: generateNextDueCode(dues),
          tenantReceiptId: receiptId,
          customerId: selectedCustomer,
          partyType: 'CUSTOMER',
          originalAmount: totalAmount,
          paidAmount: 0,
          dueAmount: totalAmount,
          status: 'OPEN',
          createdAt,
        });

        const customer = customers.find((row) => row.id === selectedCustomer);
        batch.update(doc(db, 'customers', selectedCustomer), { outstandingBalance: Number(customer?.outstandingBalance || 0) + totalAmount, updatedAt: createdAt });
      }

      await batch.commit();
      toast.success(`Sale completed! Receipt: ${receiptNumber}`);
      navigate('/sales');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'pos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden animate-in fade-in duration-500">
      <div className="flex h-full gap-6">
        <div className="flex-[3] space-y-4 overflow-hidden">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-10 bg-white" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="flex gap-2">
              {['ALL', ...Object.values(ProductCategory)].map((value) => (
                <Button key={value} variant={category === value ? 'default' : 'outline'} size="sm" className={category === value ? 'bg-slate-900' : ''} onClick={() => setCategory(value)}>{value}</Button>
              ))}
            </div>
          </div>
          <div className="grid max-h-[calc(100vh-9rem)] gap-4 overflow-y-auto pr-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const lowStock = Number(product.currentStock ?? 999999) <= Number(product.lowStockThreshold ?? 5);
              return (
                <button key={product.id} type="button" onClick={() => addProduct(product)} className="rounded-lg border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-slate-300">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{product.name}</p>
                      <p className="font-mono text-xs text-slate-400">{product.productCode}</p>
                    </div>
                    <Badge className={lowStock ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'}>{lowStock ? 'Low' : 'Stock'}</Badge>
                  </div>
                  <div className="mt-4 flex justify-between text-sm">
                    <span className="text-slate-500">Retail {formatLKR(product.retailPrice || 0)}</span>
                    <span className="font-bold text-slate-900">{formatLKR(product.wholesalePrice || 0)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Card className="flex-[2] overflow-hidden border-none shadow-sm">
          <CardHeader className="border-b space-y-3">
            <div className="grid gap-2">
              <Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={handleCustomerChange}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex h-[calc(100%-6rem)] flex-col p-0">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-slate-400">{formatLKR(item.unitPrice)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" onClick={() => updateQuantity(item.productId, item.quantity - 1)}><Minus className="w-3 h-3" /></Button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <Button variant="outline" size="icon" onClick={() => updateQuantity(item.productId, item.quantity + 1)}><Plus className="w-3 h-3" /></Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatLKR(item.subtotal)}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => updateQuantity(item.productId, 0)}><Trash2 className="w-4 h-4 text-red-500" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && <TableRow><TableCell colSpan={4} className="py-12 text-center text-slate-400">No items added.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 border-t p-4">
              <div className="grid grid-cols-2 gap-2">
                <Select value={discountType} onValueChange={(value) => setDiscountType(value as DiscountType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAT">FLAT</SelectItem>
                    <SelectItem value="PERCENTAGE">PERCENTAGE</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" step="0.01" placeholder="Discount" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={paymentType} onValueChange={(value) => setPaymentType(value as PaymentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(PaymentType).map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" step="0.01" placeholder="Paid Amount" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatLKR(subtotal)}</span></div>
                <div className="flex justify-between text-red-600"><span>Discount</span><span>- {formatLKR(discountAmount)}</span></div>
                <div className="flex justify-between text-lg font-black"><span>Total</span><span>{formatLKR(totalAmount)}</span></div>
                <div className={`flex justify-between font-semibold ${changeDue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}><span>Change Due</span><span>{formatLKR(changeDue)}</span></div>
              </div>
              <Button className="w-full bg-slate-900" disabled={saving || !selectedCustomer || items.length === 0} onClick={completeSale}>{saving ? 'Completing...' : 'Complete Sale'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
