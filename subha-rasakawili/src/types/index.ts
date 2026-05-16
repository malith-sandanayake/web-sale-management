export enum UnitType {
  PIECE = 'PIECE',
  KG = 'KG',
  G = 'G',
  PACKET = 'PACKET'
}

export interface ProductAttribute {
  key: string;
  value: string;
}

export enum ProductCategory {
  FOOD = 'FOOD',
  BEVERAGE = 'BEVERAGE',
  PACKAGING = 'PACKAGING',
  OTHER = 'OTHER'
}

export enum CustomerType {
  WHOLESALE = 'WHOLESALE',
  RETAIL = 'RETAIL',
  DEALER = 'DEALER'
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
  SALE = 'SALE',
  PRODUCTION = 'PRODUCTION',
  ADJUSTMENT = 'ADJUSTMENT',
  WASTE = 'WASTE',
  RETURN = 'RETURN'
}

export enum PaymentType {
  CASH = 'CASH',
  CARD = 'CARD',
  CREDIT = 'CREDIT'
}

export enum ReturnType {
  SALE_RETURN = 'SALE_RETURN',
  PURCHASE_RETURN = 'PURCHASE_RETURN'
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
  category?: ProductCategory;
  brandName?: string;
  attributes?: ProductAttribute[];
  lowStockThreshold?: number;
  dealerPrice?: number;
  profitMarginPercentage?: number;
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
}

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  customerType: CustomerType;
  phone?: string;
  outstandingBalance?: number;
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
  hasReturn?: boolean;
  returnedAt?: string;
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

export interface DueLedgerEntry {
  id: string;
  tenantReceiptId: string;
  customerId?: string;
  supplierId?: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  originalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: 'OPEN' | 'PARTIAL' | 'CLEARED';
  createdAt: string;
  updatedAt?: string;
}

export interface DuePayment {
  id: string;
  dueLedgerEntryId: string;
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface ReturnEntry {
  id: string;
  returnType: ReturnType;
  originalReceiptId?: string;
  originalPurchaseId?: string;
  partyId: string;
  items: Array<{ productId: string; ingredientId?: string; quantity: number; unitPrice: number; subtotal: number; }>;
  totalAmount: number;
  reason?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  ingredientId?: string;
  productId?: string;
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
