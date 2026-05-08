import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { UnitType, CustomerType } from '../types';

const INITIAL_PRODUCTS = [
  { name: "Asmi Large", unitType: UnitType.PIECE, wholesalePrice: 25, retailPrice: 30, isActive: true },
  { name: "Asmi Small", unitType: UnitType.PIECE, wholesalePrice: 15, retailPrice: 20, isActive: true },
  { name: "Konda Kavum", unitType: UnitType.PIECE, wholesalePrice: 20, retailPrice: 25, isActive: true },
  { name: "Mun Kavum", unitType: UnitType.PIECE, wholesalePrice: 20, retailPrice: 25, isActive: true },
  { name: "Kokis", unitType: UnitType.PIECE, wholesalePrice: 10, retailPrice: 15, isActive: true },
  { name: "Walithalapa", unitType: UnitType.PIECE, wholesalePrice: 30, retailPrice: 40, isActive: true },
  { name: "Rulan", unitType: UnitType.PIECE, wholesalePrice: 20, retailPrice: 25, isActive: true },
  { name: "Aluwa", unitType: UnitType.KG, wholesalePrice: 500, retailPrice: 600, isActive: true },
  { name: "Pani Walalu", unitType: UnitType.PIECE, wholesalePrice: 15, retailPrice: 20, isActive: true },
  { name: "Milk Toffee", unitType: UnitType.PIECE, wholesalePrice: 10, retailPrice: 15, isActive: true },
  { name: "Poll Toffee", unitType: UnitType.PIECE, wholesalePrice: 10, retailPrice: 15, isActive: true },
];

const INITIAL_INGREDIENTS = [
  "Rice", "Oil", "Sugar", "LP Gas", "Rice Milling", "Polythene", "Coloring", "Rubber Bands", "Whal Floot", "Shopping Bags", "Rulan (raw)", "Mun Bean", "Salt", "Coconut", "Treacle"
];

const INITIAL_CUSTOMERS = [
  { name: "Global Food Mart", customerType: CustomerType.WHOLESALE, phone: "011-2223334" },
  { name: "City Retail Center", customerType: CustomerType.RETAIL, phone: "011-5556667" },
  { name: "Traditional Sweets Shop", customerType: CustomerType.WHOLESALE, phone: "011-8889990" },
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
    batch.set(d, { name: ing, unit: 'kg', currentUnitCost: 0, isActive: true, createdAt: new Date().toISOString() });
  });

  INITIAL_CUSTOMERS.forEach(c => {
    const d = doc(collection(db, 'customers'));
    batch.set(d, { ...c, createdAt: new Date().toISOString() });
  });

  await batch.commit();
}
