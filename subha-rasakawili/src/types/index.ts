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

export enum SupplierCategory {
  INGREDIENT = 'INGREDIENT',
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE'
}

export enum SupplierPaymentMethod {
  CASH = 'CASH',
  CREDIT = 'CREDIT'
}

export enum StockMovementType {
  STOCK_IN = 'STOCK_IN',
  STOCK_OUT = 'STOCK_OUT',
  ADJUSTMENT = 'ADJUSTMENT'
}

export enum StockReferenceType {
  PURCHASE = 'PURCHASE',
  PRODUCTION = 'PRODUCTION',
  ADJUSTMENT = 'ADJUSTMENT',
  WASTE = 'WASTE'
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
  productCode: string;
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
  ingredientCode: string;
  name: string;
  unit: string;
  currentUnitCost: number;
  currentStock: number;
  reorderLevel: number;
  source?: 'IN_HOUSE' | 'SOURCED';
  supplierId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductRecipe {
  id: string;
  productId: string;
  ingredientId: string;
  quantityPerUnit: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  customerCode: string;
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
  isReversed?: boolean;
  reversedAt?: string;
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
  supplierId?: string;
  supplier?: string;
  notes?: string;
  isReversed?: boolean;
  reversedAt?: string;
  createdAt?: string;
}

export interface ExpenseGeneral {
  id: string;
  expenseDate: string;
  category: ExpenseCategory;
  description?: string;
  amount: number;
  notes?: string;
}

export interface Supplier {
  id: string;
  supplierCode: string;
  name: string;
  phone?: string;
  address?: string;
  category: SupplierCategory;
  paymentMethod: SupplierPaymentMethod;
  creditDays?: number;
  outstandingBalance: number;
  createdAt: string;
  updatedAt?: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  type: 'PURCHASE' | 'PAYMENT';
  referenceId?: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  notes?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  ingredientId: string;
  movementType: StockMovementType;
  quantity: number;
  unitCost: number;
  totalValue: number;
  referenceType: StockReferenceType;
  referenceId?: string;
  notes?: string;
  balanceAfter: number;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  createdAt: string;
}
