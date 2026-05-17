import { collection, getDocs, updateDoc, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { generateNextProductCode, generateNextIngredientCode, generateNextCustomerCode } from './utils';

type CodeDoc = {
  id: string;
  productCode?: string;
  ingredientCode?: string;
  customerCode?: string;
  currentStock?: number;
  reorderLevel?: number;
};

type PurchaseDoc = {
  id: string;
  ingredientId?: string;
  supplierId?: string | null;
  purchaseDate?: string;
  quantity?: number;
  unitRate?: number;
  totalAmount?: number;
  notes?: string;
  isReversed?: boolean;
};

type SupplierDoc = {
  id: string;
  outstandingBalance?: number;
};

type IngredientDoc = {
  id: string;
  currentStock?: number;
  currentUnitCost?: number;
};

type SupplierTransactionDoc = {
  id: string;
  supplierId?: string;
  referenceId?: string;
};

type StockMovementDoc = {
  id: string;
  referenceId?: string;
};

export async function migrateProductCodes() {
  try {
    const productsSnap = await getDocs(collection(db, 'products'));
    const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CodeDoc[];
    
    // Find products without productCode
    const productsNeedingCodes = allProducts.filter(p => !p.productCode);
    
    if (productsNeedingCodes.length === 0) {
      console.log('All products already have codes');
      return { updated: 0, message: 'All products already have codes' };
    }

    // Get the highest existing code
    const productsWithCodes = allProducts.filter(p => p.productCode);
    const batch = writeBatch(db);
    
    let nextCodeNumber = 1;
    if (productsWithCodes.length > 0) {
      const codes = productsWithCodes
        .map(p => parseInt(p.productCode, 10))
        .filter(code => !isNaN(code))
        .sort((a, b) => b - a);
      
      nextCodeNumber = codes.length > 0 ? codes[0] + 1 : 1;
    }

    // Assign codes to products without them
    productsNeedingCodes.forEach((product) => {
      const code = String(nextCodeNumber).padStart(4, '0');
      batch.update(doc(db, 'products', product.id), { productCode: code });
      nextCodeNumber++;
    });

    await batch.commit();
    console.log(`Successfully assigned codes to ${productsNeedingCodes.length} products`);
    return { updated: productsNeedingCodes.length, message: `Assigned codes to ${productsNeedingCodes.length} products` };
  } catch (error) {
    console.error('Migration error:', error);
    throw new Error('Failed to migrate product codes');
  }
}

export async function migrateIngredientCodes() {
  try {
    const ingredientsSnap = await getDocs(collection(db, 'ingredients'));
    const allIngredients = ingredientsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CodeDoc[];
    
    const ingredientsNeedingCodes = allIngredients.filter(i => !i.ingredientCode);
    
    if (ingredientsNeedingCodes.length === 0) {
      console.log('All ingredients already have codes');
      return { updated: 0, message: 'All ingredients already have codes' };
    }

    const ingredientsWithCodes = allIngredients.filter(i => i.ingredientCode);
    const batch = writeBatch(db);
    
    let nextCodeNumber = 1;
    if (ingredientsWithCodes.length > 0) {
      const codes = ingredientsWithCodes
        .map(i => {
          const match = i.ingredientCode.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        })
        .filter(code => !isNaN(code))
        .sort((a, b) => b - a);
      
      nextCodeNumber = codes.length > 0 ? codes[0] + 1 : 1;
    }

    ingredientsNeedingCodes.forEach((ingredient) => {
      const code = 'I' + String(nextCodeNumber).padStart(3, '0');
      batch.update(doc(db, 'ingredients', ingredient.id), { ingredientCode: code });
      nextCodeNumber++;
    });

    await batch.commit();
    console.log(`Successfully assigned codes to ${ingredientsNeedingCodes.length} ingredients`);
    return { updated: ingredientsNeedingCodes.length, message: `Assigned codes to ${ingredientsNeedingCodes.length} ingredients` };
  } catch (error) {
    console.error('Migration error:', error);
    throw new Error('Failed to migrate ingredient codes');
  }
}

export async function migrateCustomerCodes() {
  try {
    const customersSnap = await getDocs(collection(db, 'customers'));
    const allCustomers = customersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CodeDoc[];
    
    const customersNeedingCodes = allCustomers.filter(c => !c.customerCode);
    
    if (customersNeedingCodes.length === 0) {
      console.log('All customers already have codes');
      return { updated: 0, message: 'All customers already have codes' };
    }

    const customersWithCodes = allCustomers.filter(c => c.customerCode);
    const batch = writeBatch(db);
    
    let nextCodeNumber = 1;
    if (customersWithCodes.length > 0) {
      const codes = customersWithCodes
        .map(c => {
          const match = c.customerCode.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        })
        .filter(code => !isNaN(code))
        .sort((a, b) => b - a);
      
      nextCodeNumber = codes.length > 0 ? codes[0] + 1 : 1;
    }

    customersNeedingCodes.forEach((customer) => {
      const code = 'C' + String(nextCodeNumber).padStart(3, '0');
      batch.update(doc(db, 'customers', customer.id), { customerCode: code });
      nextCodeNumber++;
    });

    await batch.commit();
    console.log(`Successfully assigned codes to ${customersNeedingCodes.length} customers`);
    return { updated: customersNeedingCodes.length, message: `Assigned codes to ${customersNeedingCodes.length} customers` };
  } catch (error) {
    console.error('Migration error:', error);
    throw new Error('Failed to migrate customer codes');
  }
}

export async function migrateIngredientStockFields() {
  try {
    const ingredientsSnap = await getDocs(collection(db, 'ingredients'));
    const allIngredients = ingredientsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CodeDoc[];

    const ingredientsNeedingUpdates = allIngredients.filter(i => i.currentStock === undefined || i.reorderLevel === undefined);

    if (ingredientsNeedingUpdates.length === 0) {
      console.log('All ingredients already have stock fields');
      return { updated: 0, message: 'All ingredients already have stock fields' };
    }

    const batch = writeBatch(db);
    ingredientsNeedingUpdates.forEach((ingredient) => {
      batch.update(doc(db, 'ingredients', ingredient.id), {
        currentStock: Number(ingredient.currentStock || 0),
        reorderLevel: Number(ingredient.reorderLevel || 0),
      });
    });

    await batch.commit();
    console.log(`Successfully backfilled stock fields for ${ingredientsNeedingUpdates.length} ingredients`);
    return { updated: ingredientsNeedingUpdates.length, message: `Backfilled stock fields for ${ingredientsNeedingUpdates.length} ingredients` };
  } catch (error) {
    console.error('Migration error:', error);
    throw new Error('Failed to migrate ingredient stock fields');
  }
}

export async function migrateAccountingLedgers() {
  try {
    const [purchaseSnap, supplierSnap, ingredientSnap, supplierTransactionSnap, stockMovementSnap] = await Promise.all([
      getDocs(collection(db, 'expense_purchases')),
      getDocs(collection(db, 'suppliers')),
      getDocs(collection(db, 'ingredients')),
      getDocs(collection(db, 'supplier_transactions')),
      getDocs(collection(db, 'stock_movements')),
    ]);

    const purchases = purchaseSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as PurchaseDoc[];
    const suppliers = supplierSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SupplierDoc[];
    const ingredients = ingredientSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as IngredientDoc[];
    const supplierTransactions = supplierTransactionSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SupplierTransactionDoc[];
    const stockMovements = stockMovementSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as StockMovementDoc[];

    const existingMovementRefs = new Set(stockMovements.map((movement) => movement.referenceId).filter(Boolean) as string[]);
    const existingSupplierTxRefs = new Set(supplierTransactions.map((transaction) => transaction.referenceId).filter(Boolean) as string[]);

    const ingredientBalances = ingredients.reduce<Record<string, number>>((acc, ingredient) => {
      acc[ingredient.id] = Number(ingredient.currentStock || 0);
      return acc;
    }, {});

    const supplierBalances = suppliers.reduce<Record<string, number>>((acc, supplier) => {
      acc[supplier.id] = Number(supplier.outstandingBalance || 0);
      return acc;
    }, {});

    const batch = writeBatch(db);
    let writes = 0;

    const sortedPurchases = purchases
      .filter((purchase) => !purchase.isReversed)
      .sort((a, b) => new Date(a.purchaseDate || 0).getTime() - new Date(b.purchaseDate || 0).getTime());

    for (const purchase of sortedPurchases) {
      if (!purchase.id || !purchase.ingredientId) continue;

      const createdAt = purchase.purchaseDate || new Date().toISOString();
      const quantity = Number(purchase.quantity || 0);
      const unitRate = Number(purchase.unitRate || 0);
      const totalAmount = Number(purchase.totalAmount || quantity * unitRate);

      if (!existingMovementRefs.has(purchase.id)) {
        const currentBalance = Number(ingredientBalances[purchase.ingredientId] || 0) + quantity;
        ingredientBalances[purchase.ingredientId] = currentBalance;

        batch.set(doc(db, 'stock_movements', doc(collection(db, 'stock_movements')).id), {
          ingredientId: purchase.ingredientId,
          movementType: 'STOCK_IN',
          quantity,
          unitCost: unitRate,
          totalValue: totalAmount,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          notes: purchase.notes || 'Backfilled from purchase history',
          balanceAfter: currentBalance,
          createdAt,
        });
        batch.update(doc(db, 'ingredients', purchase.ingredientId), {
          currentStock: currentBalance,
          currentUnitCost: unitRate,
          updatedAt: createdAt,
        });
        existingMovementRefs.add(purchase.id);
        writes++;
      }

      if (purchase.supplierId && !existingSupplierTxRefs.has(purchase.id)) {
        const currentBalance = Number(supplierBalances[purchase.supplierId] || 0) + totalAmount;
        supplierBalances[purchase.supplierId] = currentBalance;

        batch.set(doc(db, 'supplier_transactions', doc(collection(db, 'supplier_transactions')).id), {
          supplierId: purchase.supplierId,
          type: 'PURCHASE',
          referenceId: purchase.id,
          amount: totalAmount,
          balanceBefore: currentBalance - totalAmount,
          balanceAfter: currentBalance,
          notes: purchase.notes || 'Backfilled from purchase history',
          createdAt,
        });
        batch.update(doc(db, 'suppliers', purchase.supplierId), {
          outstandingBalance: currentBalance,
          updatedAt: createdAt,
        });
        existingSupplierTxRefs.add(purchase.id);
        writes++;
      }
    }

    if (writes > 0) {
      await batch.commit();
    }

    console.log(`Backfilled accounting ledgers from ${writes} purchase-linked records`);
    return { updated: writes, message: `Backfilled accounting ledgers from ${writes} purchase-linked records` };
  } catch (error) {
    console.error('Migration error:', error);
    throw new Error('Failed to migrate accounting ledgers');
  }
}
