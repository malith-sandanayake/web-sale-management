import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, where, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Search, Filter, Receipt as ReceiptIcon, Eye, Download, Calendar, Trash2, Printer, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { formatLKR } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { PaymentType } from '../../types';
import { toast } from 'sonner';
import { exportToCSV, exportToExcel, printTable } from '../../lib/exportUtils';

export default function SalesList() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [returningSaleId, setReturningSaleId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSaleItems() {
      if (!selectedSale) {
        setSaleItems([]);
        return;
      }
      setItemsLoading(true);
      try {
        const q = query(collection(db, 'receipt_items'), where('receiptId', '==', selectedSale.id));
        const snap = await getDocs(q);
        const itemsData = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data();
          const productSnap = await getDoc(doc(db, 'products', data.productId));
          return {
            id: d.id,
            ...data,
            productName: productSnap.exists() ? productSnap.data().name : 'Unknown Product',
            productCode: productSnap.exists() ? productSnap.data().productCode : 'N/A'
          };
        }));
        setSaleItems(itemsData);
      } catch (e) {
        console.error("Failed to fetch sale items", e);
      } finally {
        setItemsLoading(false);
      }
    }
    fetchSaleItems();
  }, [selectedSale]);

  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    try {
      const q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const salesData = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const customerSnap = await getDoc(doc(db, 'customers', data.customerId));
        return {
          id: d.id,
          ...data,
          customerName: customerSnap.exists() ? customerSnap.data().name : 'Unknown',
          customerType: customerSnap.exists() ? customerSnap.data().customerType : 'N/A'
        };
      }));
      setSales(salesData);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'sales');
    } finally {
      setLoading(false);
    }
  }

  const reverseSale = async (saleId: string) => {
    const confirmed = window.confirm('Reverse this sale? This will mark it as reversed and remove it from income totals.');
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'receipts', saleId), {
        isReversed: true,
        reversedAt: new Date().toISOString()
      });
      toast.success('Sale reversed successfully');
      fetchSales();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'receipts');
    }
  };

  const processSaleReturn = async (sale: any) => {
    if (sale.isReturned) {
      return toast.error('This receipt has already been returned');
    }

    const confirmed = window.confirm(
      `Process return for ${sale.receiptNumber}? This will restore stock quantities and reverse the receipt balance if it was a credit sale.`
    );
    if (!confirmed) return;

    setReturningSaleId(sale.id);
    const createdAt = new Date().toISOString();

    try {
      const itemSnap = await getDocs(query(collection(db, 'receipt_items'), where('receiptId', '==', sale.id)));
      const itemRows = itemSnap.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }));

      const paymentSnap = !sale.paymentMethod
        ? await getDocs(query(collection(db, 'payments'), where('receiptId', '==', sale.id)))
        : null;
      const paymentData = paymentSnap?.docs[0]?.data();
      const originalPaymentMethod = sale.paymentMethod || sale.paymentType || paymentData?.paymentType || (sale.paymentStatus === 'PENDING' ? PaymentType.CREDIT : PaymentType.CASH);
      const totalAmount = Number(sale.totalAmount || 0);

      await runTransaction(db, async (transaction) => {
        const receiptRef = doc(db, 'receipts', sale.id);
        const receiptSnapshot = await transaction.get(receiptRef);

        if (!receiptSnapshot.exists()) {
          throw new Error('Receipt not found');
        }

        if (receiptSnapshot.data().isReturned) {
          throw new Error('This receipt has already been returned');
        }

        let balanceBefore = 0;
        let balanceAfter = 0;

        for (const item of itemRows) {
          const itemRef = doc(db, 'receipt_items', item.id);
          const itemSnapshot = await transaction.get(itemRef);
          if (!itemSnapshot.exists()) {
            throw new Error('A receipt item was missing during return processing');
          }

          const itemData = itemSnapshot.data();
          const productRef = doc(db, 'products', itemData.productId);
          const productSnapshot = await transaction.get(productRef);

          if (!productSnapshot.exists()) {
            throw new Error(`Product not found for receipt item ${itemData.productId}`);
          }

          const productData = productSnapshot.data();
          const currentStock = Number(productData.currentStock || 0);
          const quantity = Number(itemData.quantity || 0);

          transaction.update(productRef, {
            currentStock: currentStock + quantity,
            updatedAt: createdAt,
          });
        }

        transaction.update(receiptRef, {
          isReturned: true,
          returnedAt: createdAt,
        });

        if (originalPaymentMethod === PaymentType.CREDIT || originalPaymentMethod === 'CREDIT') {
          const customerRef = doc(db, 'customers', sale.customerId);
          const customerSnapshot = await transaction.get(customerRef);

          if (!customerSnapshot.exists()) {
            throw new Error('Customer record not found for return processing');
          }

          balanceBefore = Number(customerSnapshot.data().outstandingBalance || 0);
          balanceAfter = Math.max(0, balanceBefore - totalAmount);

          transaction.update(customerRef, {
            outstandingBalance: balanceAfter,
            updatedAt: createdAt,
          });

          const customerTransactionId = doc(collection(db, 'customer_transactions')).id;
          transaction.set(doc(db, 'customer_transactions', customerTransactionId), {
            customerId: sale.customerId,
            receiptId: sale.id,
            type: 'SALES_RETURN',
            amount: totalAmount,
            balanceBefore,
            balanceAfter,
            createdAt,
          });
        }
      });

      toast.success('Warehouse stock update loop has completed successfully');
      fetchSales();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to process sales return';
      toast.error(message);
    } finally {
      setReturningSaleId(null);
    }
  };

  const filtered = sales.filter(s => 
    s.receiptNumber.toLowerCase().includes(search.toLowerCase()) || 
    s.customerName.toLowerCase().includes(search.toLowerCase())
  );

  const exportRows = filtered.map((sale) => ({
    receiptNumber: sale.receiptNumber,
    date: sale.saleDate,
    customer: sale.customerName,
    type: sale.customerType,
    totalAmount: sale.totalAmount,
    status: sale.isReversed ? 'Reversed' : sale.isReturned ? 'Returned' : 'Active',
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Sales History</h1>
          <p className="text-slate-500 mt-1">Review all past transactions and receipts.</p>
        </div>
        <Button size="sm" className="bg-slate-900" render={<Link to="/sales/new">New Sale</Link>} />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportToCSV(exportRows, 'sales.csv')}><Download className="w-4 h-4 mr-2" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={() => exportToExcel(exportRows, 'sales.xlsx')}><Download className="w-4 h-4 mr-2" /> Excel</Button>
        <Button variant="outline" size="sm" onClick={() => printTable('sales-table')}><Printer className="w-4 h-4 mr-2" /> Print</Button>
      </div>

      <Card id="sales-table" className="border-none shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by receipt or customer..." 
              className="pl-10 bg-slate-50 border-none h-10" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-slate-50 border-none">
              <Calendar className="w-4 h-4 mr-2 text-slate-400" /> Date Range
            </Button>
            <Button variant="outline" size="sm" className="bg-slate-50 border-none">
              <Filter className="w-4 h-4 mr-2 text-slate-400" /> Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-slate-100">
                <TableHead className="font-semibold text-slate-600">Receipt No</TableHead>
                <TableHead className="font-semibold text-slate-600">Date</TableHead>
                <TableHead className="font-semibold text-slate-600">Customer</TableHead>
                <TableHead className="font-semibold text-slate-600">Type</TableHead>
                <TableHead className="font-semibold text-slate-600">Total (LKR)</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><div className="h-10 animate-pulse bg-slate-100 rounded w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.map((sale) => (
                <TableRow key={sale.id} className="border-slate-50 hover:bg-slate-50/20">
                  <TableCell className="font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <ReceiptIcon className="w-4 h-4 text-slate-400" />
                      {sale.receiptNumber}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {new Date(sale.saleDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="font-medium">{sale.customerName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={sale.customerType === 'WHOLESALE' ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}>
                      {sale.customerType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold">{formatLKR(sale.totalAmount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedSale(sale)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {!sale.isReversed ? (
                        <>
                          {!sale.isReturned && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              onClick={() => processSaleReturn(sale)}
                              disabled={returningSaleId === sale.id}
                              title="Process Return"
                            >
                              <Undo2 className="w-4 h-4 mr-2" />
                              {returningSaleId === sale.id ? 'Processing...' : 'Process Return'}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => reverseSale(sale.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="uppercase text-xs px-2 py-1">Reversed</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                    No sales records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale Details - {selectedSale?.receiptNumber}</DialogTitle>
            <DialogDescription>Full summary of the transaction.</DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Customer</p>
                  <p className="font-bold text-slate-900">{selectedSale.customerName}</p>
                  <p className="text-sm text-slate-500">{selectedSale.customerType}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-right">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Date</p>
                  <p className="font-bold text-slate-900">{new Date(selectedSale.saleDate).toLocaleDateString()}</p>
                  <p className="text-sm text-slate-500">Recorded: {new Date(selectedSale.createdAt).toLocaleTimeString()}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Itemized Breakdown</h4>
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow className="border-slate-100 hover:bg-transparent">
                        <TableHead className="w-25 font-semibold text-slate-600">Code</TableHead>
                        <TableHead className="font-semibold text-slate-600">Item Name</TableHead>
                        <TableHead className="text-right font-semibold text-slate-600">Qty</TableHead>
                        <TableHead className="text-right font-semibold text-slate-600">Unit Price</TableHead>
                        <TableHead className="text-right font-semibold text-slate-600">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemsLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                            <div className="animate-pulse space-y-3">
                               <div className="h-4 bg-slate-100 rounded w-full"></div>
                               <div className="h-4 bg-slate-100 rounded w-full"></div>
                               <div className="h-4 bg-slate-100 rounded w-full"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : saleItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-slate-400 font-medium">No items found.</TableCell>
                        </TableRow>
                      ) : (
                        saleItems.map((item) => (
                          <TableRow key={item.id} className="border-slate-50 hover:bg-slate-50/20">
                            <TableCell className="text-xs font-mono text-slate-500">{item.productCode}</TableCell>
                            <TableCell className="font-medium text-slate-900">{item.productName}</TableCell>
                            <TableCell className="text-right">{item.quantity} <span className="text-[10px] uppercase font-bold text-slate-400">{item.unitType}</span></TableCell>
                            <TableCell className="text-right">{formatLKR(item.unitPrice)}</TableCell>
                            <TableCell className="text-right font-bold text-slate-900">{formatLKR(item.subtotal)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-between items-center text-xl font-bold bg-slate-900 text-white p-4 rounded-lg shadow-inner">
                <span>Total Amount Paid</span>
                <span>{formatLKR(selectedSale.totalAmount)}</span>
              </div>
              
              <div className="text-xs text-slate-500 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="font-semibold text-slate-700 mb-1">Notes / Return Policy</p>
                <p>Items can be returned within 7 days of purchase with the original receipt. {selectedSale.notes && `Transaction note: ${selectedSale.notes}`}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
