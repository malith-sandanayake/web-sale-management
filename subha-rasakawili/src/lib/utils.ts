import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatLKR(amount: number | string) {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(value);
}

export function generateReceiptNo() {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `REC-${year}-${random}`;
}

export function generateInvoiceNo() {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${random}`;
}

export function generateNextProductCode(existingProducts: Array<{ productCode: string }>) {
  if (!existingProducts || existingProducts.length === 0) {
    return '0001';
  }
  
  const codes = existingProducts
    .map(p => parseInt(p.productCode, 10))
    .filter(code => !isNaN(code))
    .sort((a, b) => b - a);
  
  const nextCode = codes.length > 0 ? codes[0] + 1 : 1;
  return String(nextCode).padStart(4, '0');
}

export function generateNextIngredientCode(existingIngredients: Array<{ ingredientCode: string }>) {
  if (!existingIngredients || existingIngredients.length === 0) {
    return 'I001';
  }
  
  const codes = existingIngredients
    .map(i => {
      const match = i.ingredientCode.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .filter(code => !isNaN(code))
    .sort((a, b) => b - a);
  
  const nextCode = codes.length > 0 ? codes[0] + 1 : 1;
  return 'I' + String(nextCode).padStart(3, '0');
}

export function generateNextCustomerCode(existingCustomers: Array<{ customerCode: string }>) {
  if (!existingCustomers || existingCustomers.length === 0) {
    return 'C001';
  }
  
  const codes = existingCustomers
    .map(c => {
      const match = c.customerCode.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .filter(code => !isNaN(code))
    .sort((a, b) => b - a);
  
  const nextCode = codes.length > 0 ? codes[0] + 1 : 1;
  return 'C' + String(nextCode).padStart(3, '0');
}
