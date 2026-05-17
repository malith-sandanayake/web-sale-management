import { z } from "zod"
import { UnitType, CustomerType, ExpenseCategory } from "../types"

export const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  unitType: z.nativeEnum(UnitType),
  wholesalePrice: z.coerce.number().min(0),
  retailPrice: z.coerce.number().min(0),
  isActive: z.boolean().default(true),
})

export const ingredientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  unit: z.string().min(1, "Unit is required"),
  currentUnitCost: z.coerce.number().min(0),
  isActive: z.boolean().default(true),
})

export const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  customerType: z.nativeEnum(CustomerType),
  phone: z.string().optional(),
})

export const receiptItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unitType: z.string(),
  unitPrice: z.coerce.number().min(0),
  subtotal: z.coerce.number().min(0),
})

export const receiptSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  saleDate: z.string().default(() => new Date().toISOString()),
  notes: z.string().optional(),
  items: z.array(receiptItemSchema).min(1, "At least one item is required"),
  totalAmount: z.number().min(0),
})

export const expensePurchaseSchema = z.object({
  ingredientId: z.string().min(1, "Ingredient is required"),
  purchaseDate: z.string().default(() => new Date().toISOString()),
  quantity: z.coerce.number().positive(),
  unitRate: z.coerce.number().min(0),
  totalAmount: z.coerce.number().min(0),
  supplier: z.string().optional(),
  notes: z.string().optional(),
})

export const expenseGeneralSchema = z.object({
  expenseDate: z.string().default(() => new Date().toISOString()),
  category: z.nativeEnum(ExpenseCategory),
  description: z.string().optional(),
  amount: z.coerce.number().positive(),
  notes: z.string().optional(),
})

export const recipeIngredientSchema = z.object({
  ingredientId: z.string().min(1, "Ingredient is required"),
  quantityPerUnit: z.coerce.number().positive("Quantity per unit must be greater than 0"),
})

export const recipeSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  ingredients: z.array(recipeIngredientSchema).min(1, "At least one ingredient is required"),
})

export const productionRunSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantityProduced: z.coerce.number().positive("Quantity produced must be greater than 0"),
})
