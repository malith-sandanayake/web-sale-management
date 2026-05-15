import { collection, getDocs, updateDoc, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { generateNextProductCode, generateNextIngredientCode, generateNextCustomerCode } from './utils';

export async function migrateProductCodes() {
  try {
    const productsSnap = await getDocs(collection(db, 'products'));
    const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
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
    const allIngredients = ingredientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
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
    const allCustomers = customersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
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
