import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { UnitType, CustomerType } from '../types';

const INITIAL_PRODUCTS = [
  { productCode: "0001", name: "Asmi Large", unitType: UnitType.PIECE, wholesalePrice: 25, retailPrice: 30, isActive: true },
  { productCode: "0002", name: "Asmi Small", unitType: UnitType.PIECE, wholesalePrice: 15, retailPrice: 20, isActive: true },
  { productCode: "0003", name: "Konda Kavum", unitType: UnitType.PIECE, wholesalePrice: 20, retailPrice: 25, isActive: true },
  { productCode: "0004", name: "Mun Kavum", unitType: UnitType.PIECE, wholesalePrice: 20, retailPrice: 25, isActive: true },
  { productCode: "0005", name: "Kokis", unitType: UnitType.PIECE, wholesalePrice: 10, retailPrice: 15, isActive: true },
  { productCode: "0006", name: "Walithalapa", unitType: UnitType.PIECE, wholesalePrice: 30, retailPrice: 40, isActive: true },
  { productCode: "0007", name: "Rulan", unitType: UnitType.PIECE, wholesalePrice: 20, retailPrice: 25, isActive: true },
  { productCode: "0008", name: "Aluwa", unitType: UnitType.KG, wholesalePrice: 500, retailPrice: 600, isActive: true },
  { productCode: "0009", name: "Pani Walalu", unitType: UnitType.PIECE, wholesalePrice: 15, retailPrice: 20, isActive: true },
  { productCode: "0010", name: "Milk Toffee", unitType: UnitType.PIECE, wholesalePrice: 10, retailPrice: 15, isActive: true },
  { productCode: "0011", name: "Poll Toffee", unitType: UnitType.PIECE, wholesalePrice: 10, retailPrice: 15, isActive: true },
];

const INITIAL_INGREDIENTS = [
  { ingredientCode: "I001", name: "Rice" },
  { ingredientCode: "I002", name: "Oil" },
  { ingredientCode: "I003", name: "Sugar" },
  { ingredientCode: "I004", name: "LP Gas" },
  { ingredientCode: "I005", name: "Rice Milling" },
  { ingredientCode: "I006", name: "Polythene" },
  { ingredientCode: "I007", name: "Coloring" },
  { ingredientCode: "I008", name: "Rubber Bands" },
  { ingredientCode: "I009", name: "Whal Floot" },
  { ingredientCode: "I010", name: "Shopping Bags" },
  { ingredientCode: "I011", name: "Rulan (raw)" },
  { ingredientCode: "I012", name: "Mun Bean" },
  { ingredientCode: "I013", name: "Salt" },
  { ingredientCode: "I014", name: "Coconut" },
  { ingredientCode: "I015", name: "Treacle" }
];

const INITIAL_CUSTOMERS = [
  { customerCode: "C001", name: "Global Food Mart", customerType: CustomerType.WHOLESALE, phone: "011-2223334" },
  { customerCode: "C002", name: "City Retail Center", customerType: CustomerType.RETAIL, phone: "011-5556667" },
  { customerCode: "C003", name: "Traditional Sweets Shop", customerType: CustomerType.WHOLESALE, phone: "011-8889990" },
];

export async function seedDatabase() {
  const productsSnap = await getDocs(collection(db, 'products'));
  if (!productsSnap.empty) return; // Prevent double seeding

  const batch = writeBatch(db);

  INITIAL_PRODUCTS.forEach(p => {
    const d = doc(collection(db, 'products'));
    batch.set(d, { ...p, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  });

  INITIAL_INGREDIENTS.forEach(ing => {
    const d = doc(collection(db, 'ingredients'));
    batch.set(d, { ...ing, unit: 'kg', currentUnitCost: 0, currentStock: 0, reorderLevel: 0, isActive: true, createdAt: new Date().toISOString() });
  });

  INITIAL_CUSTOMERS.forEach(c => {
    const d = doc(collection(db, 'customers'));
    batch.set(d, { ...c, createdAt: new Date().toISOString() });
  });

  await batch.commit();
}
