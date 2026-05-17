import { useState, useEffect, type FormEvent } from 'react';
import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Search, ArrowLeft, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Separator } from '../../../components/ui/separator';
import { formatLKR, generateReceiptNo, generateInvoiceNo } from '../../../lib/utils';
import { toast } from 'sonner';
import { CustomerType, PaymentType } from '../../../types';

export default function NewSale() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerType, setCustomerType] = useState<CustomerType>(CustomerType.RETAIL);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT'>('CASH');
  const [items, setItems] = useState<any[]>([
    { id: '1', productId: '', quantity: 1, unitPrice: 0, subtotal: 0, unitType: '' }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const pSnap = await getDocs(query(collection(db, 'products'), where('isActive', '==', true)));
      setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const cSnap = await getDocs(collection(db, 'customers'));
      setCustomers(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    fetchData();
  }, []);

  const handleCustomerChange = (id: string) => {
    setSelectedCustomer(id);
    const customer = customers.find(c => c.id === id);
    if (customer) {
      setCustomerType(customer.customerType);
      // Update existing item prices based on type
      const newItems = items.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const price = customer.customerType === CustomerType.WHOLESALE ? product.wholesalePrice : product.retailPrice;
          return { ...item, unitPrice: price, subtotal: price * item.quantity };
        }
        return item;
      });
      setItems(newItems);
    }
  };

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), productId: '', quantity: 1, unitPrice: 0, subtotal: 0, unitType: '' }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id: string, field: string, value: any) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'productId') {
          const product = products.find(p => p.id === value);
          if (product) {
            const price = customerType === CustomerType.WHOLESALE ? product.wholesalePrice : product.retailPrice;
            updatedItem.unitPrice = price;
            updatedItem.unitType = product.unitType;
            updatedItem.subtotal = price * updatedItem.quantity;
          }
        }
        if (field === 'quantity') {
          updatedItem.subtotal = updatedItem.unitPrice * parseFloat(value || 0);
        }
        return updatedItem;
      }
      return item;
    });
    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return toast.error("Please select a customer");
    if (items.some((item) => !item.productId)) return toast.error("Please select products for all rows");
    if (items.some((item) => Number(item.quantity || 0) <= 0)) return toast.error("Item quantities must be greater than zero");

    setLoading(true);
    
    try {
      const receiptId = doc(collection(db, 'receipts')).id;
      const receiptNo = generateReceiptNo();
      const invoiceNo = generateInvoiceNo();
      const createdAt = new Date().toISOString();
      const paymentStatus = paymentMethod === 'CREDIT' ? 'PENDING' : 'PAID';

      await runTransaction(db, async (transaction) => {
        const customerRef = doc(db, 'customers', selectedCustomer);
        const customerTransactionId = paymentMethod === 'CREDIT' ? doc(collection(db, 'customer_transactions')).id : null;

        let balanceBefore = 0;
        let balanceAfter = 0;

        if (paymentMethod === 'CREDIT') {
          const customerSnapshot = await transaction.get(customerRef);
          if (!customerSnapshot.exists()) {
            throw new Error('Selected customer was not found');
          }

          balanceBefore = Number(customerSnapshot.data().outstandingBalance || 0);
          balanceAfter = balanceBefore + totalAmount;
        }

        for (const item of items) {
          const productRef = doc(db, 'products', item.productId);
          const productSnapshot = await transaction.get(productRef);

          if (!productSnapshot.exists()) {
            throw new Error(`Product not found for item ${item.productId}`);
          }

          const productData = productSnapshot.data();
          const currentStock = Number(productData.currentStock || 0);
          const quantity = Number(item.quantity || 0);

          if (currentStock < quantity) {
            throw new Error(`${productData.name || item.productId} does not have enough stock`);
          }

          transaction.update(productRef, {
            currentStock: currentStock - quantity,
            updatedAt: createdAt,
          });
        }

        transaction.set(doc(db, 'receipts', receiptId), {
          receiptNumber: receiptNo,
          customerId: selectedCustomer,
          saleDate: createdAt,
          subtotal: totalAmount,
          discountType,
          discountAmount,
          totalAmount,
          paymentMethod,
          paymentStatus,
          paymentType: paymentMethod === 'CREDIT' ? PaymentType.CREDIT : PaymentType.CASH,
          isReturned: false,
          createdAt,
        });

        for (const item of items) {
          const itemId = doc(collection(db, 'receipt_items')).id;
          transaction.set(doc(db, 'receipt_items', itemId), {
            receiptId,
            productId: item.productId,
            quantity: Number(item.quantity || 0),
            unitType: item.unitType,
            unitPrice: Number(item.unitPrice || 0),
            subtotal: Number(item.subtotal || 0),
          });
        }

        const paymentId = doc(collection(db, 'payments')).id;
        transaction.set(doc(db, 'payments', paymentId), {
          invoiceNumber: invoiceNo,
          receiptId,
          paymentType: paymentMethod === 'CREDIT' ? PaymentType.CREDIT : PaymentType.CASH,
          amount: paymentMethod === 'CREDIT' ? 0 : totalAmount,
          paymentDate: createdAt,
        });

        if (paymentMethod === 'CREDIT') {
          transaction.update(customerRef, {
            outstandingBalance: balanceAfter,
            updatedAt: createdAt,
          });

          if (!customerTransactionId) {
            throw new Error('Failed to create customer transaction record');
          }

          transaction.set(doc(db, 'customer_transactions', customerTransactionId), {
            customerId: selectedCustomer,
            receiptId,
            type: 'CREDIT_SALE',
            amount: totalAmount,
            balanceBefore,
            balanceAfter,
            createdAt,
          });
        }
      });

      toast.success(`Sale completed! Receipt: ${receiptNo}`);
      navigate('/sales');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete sale';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">New Sale</h1>
          <p className="text-slate-500">Create a new receipt and record payment.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm h-full">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg">Items Selection</CardTitle>
              <CardDescription>Add products to the receipt.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="pl-6 w-62.5">Product</TableHead>
                    <TableHead className="w-25">Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead className="w-12.5"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id} className="border-slate-50 group">
                      <TableCell className="pl-6">
                        <Select 
                          value={item.productId} 
                          onValueChange={(val) => handleItemChange(item.id, 'productId', val)}
                        >
                          <SelectTrigger className="border-slate-200">
                              <SelectValue placeholder="Select product">
                                {products.find(p => p.id === item.productId)?.name ?? undefined}
                              </SelectValue>
                            </SelectTrigger>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          min="0.1" 
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                          className="border-slate-200"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-slate-600">
                        {formatLKR(item.unitPrice)}/
                        <span className="text-[10px] uppercase font-bold text-slate-400">{item.unitType || '-'}</span>
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">
                        {formatLKR(item.subtotal)}
                      </TableCell>
                      <TableCell className="pr-6">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4 flex justify-between items-center bg-slate-50/50">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addItem}
                  className="bg-white"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Item
                </Button>
                <div className="text-right">
                  <p className="text-sm text-slate-500 font-medium">Total Items: {items.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Customer Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Customer</Label>
                <Select 
                  value={selectedCustomer} 
                  onValueChange={handleCustomerChange}
                >
                  <SelectTrigger className="h-11 border-slate-200">
                    <SelectValue placeholder="Select or search customer">
                      {customers.find(c => c.id === selectedCustomer)?.name ?? undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'CASH' | 'CREDIT')}>
                  <SelectTrigger className="h-11 border-slate-200">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">CASH</SelectItem>
                    <SelectItem value="CREDIT">CREDIT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedCustomer && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Type</p>
                    <p className="text-sm font-semibold text-slate-700">{customerType}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    Prices set to {customerType.toLowerCase()}
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                 <div className="flex justify-between text-sm text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatLKR(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-slate-900 border-t pt-2">
                  <span>Total (LKR)</span>
                  <span className="text-amber-600">{formatLKR(totalAmount)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button 
                type="submit" 
                className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-lg font-semibold"
                disabled={loading}
              >
                {loading ? "Processing..." : "Finish & Record Sale"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-amber-50 border-amber-100 shadow-none">
            <CardContent className="p-4 flex gap-3 text-amber-800">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Summary Notes</p>
                <p>This sale will be recorded as {paymentMethod} and processed atomically with stock and balance updates.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
