export enum UnitType {
  PIECE = 'PIECE',
  KG = 'KG',
  G = 'G',
  PACKET = 'PACKET'
}

export enum CustomerType {
  WHOLESALE = 'WHOLESALE',
  RETAIL = 'RETAIL'
}

export enum PaymentType {
  CASH = 'CASH'
}

export enum ExpenseCategory {
  TRANSPORT = 'TRANSPORT',
  LP_GAS = 'LP_GAS',
  POLYTHENE = 'POLYTHENE',
  COLORING = 'COLORING',
  RUBBER_BANDS = 'RUBBER_BANDS',
  SHOPPING_BAGS = 'SHOPPING_BAGS',
  STATIONERY = 'STATIONERY',
  RICE_MILLING = 'RICE_MILLING',
  OTHER = 'OTHER'
}

export interface Product {
  id: string;
  name: string;
  unitType: UnitType;
  wholesalePrice: number;
  retailPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentUnitCost: number;
  isActive: boolean;
  createdAt: string;
}

export interface ProductRecipe {
  id: string;
  productId: string;
  ingredientId: string;
  quantityPerUnit: number;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  customerType: CustomerType;
  phone?: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  customerId: string;
  saleDate: string;
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

export interface ReceiptItem {
  id: string;
  receiptId: string;
  productId: string;
  quantity: number;
  unitType: string;
  unitPrice: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  invoiceNumber: string;
  receiptId: string;
  paymentType: PaymentType;
  amount: number;
  paymentDate: string;
  notes?: string;
}

export interface ExpensePurchase {
  id: string;
  ingredientId: string;
  purchaseDate: string;
  quantity: number;
  unitRate: number;
  totalAmount: number;
  supplier?: string;
  notes?: string;
}

export interface ExpenseGeneral {
  id: string;
  expenseDate: string;
  category: ExpenseCategory;
  description?: string;
  amount: number;
  notes?: string;
}

export interface User {
  id: string;
  username: string;
  createdAt: string;
}
