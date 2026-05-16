import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Toaster } from 'sonner';
import { seedDatabase } from './lib/seed';
import { migrateProductCodes, migrateIngredientCodes, migrateCustomerCodes, migrateIngredientStockFields, migrateAccountingLedgers } from './lib/migrations';

// Layout
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';

// Pages
import Login from './app/login/page';
import Dashboard from './app/dashboard/page';
import Products from './app/products/page';
import SalesList from './app/sales/page';
import NewSale from './app/sales/new/page';
import Ingredients from './app/ingredients/page';
import Recipes from './app/recipes/page';
import Customers from './app/customers/page';
import Purchases from './app/expenses/purchases/page';
import GeneralExpenses from './app/expenses/general/page';
import Reports from './app/reports/page';
import Profile from './app/profile/page';
import ProductPerformance from './app/product-performance/page';
import Suppliers from './app/suppliers/page';
import Inventory from './app/inventory/page';
import Accounts from './app/accounts/page';
import type { ReactNode } from 'react';

function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex bg-slate-50 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        seedDatabase().catch(console.error);
        migrateProductCodes().catch(console.error);
        migrateIngredientCodes().catch(console.error);
        migrateCustomerCodes().catch(console.error);
        migrateIngredientStockFields().catch(console.error);
        migrateAccountingLedgers().catch(console.error);
      }
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route 
          path="/login" 
          element={!user ? <Login /> : <Navigate to="/" replace />} 
        />
        
        <Route 
          path="/" 
          element={user ? <ProtectedLayout><Dashboard /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/sales" 
          element={user ? <ProtectedLayout><SalesList /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/sales/new" 
          element={user ? <ProtectedLayout><NewSale /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/products" 
          element={user ? <ProtectedLayout><Products /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/ingredients" 
          element={user ? <ProtectedLayout><Ingredients /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/recipes" 
          element={user ? <ProtectedLayout><Recipes /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/customers" 
          element={user ? <ProtectedLayout><Customers /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/expenses/purchases" 
          element={user ? <ProtectedLayout><Purchases /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/expenses/general" 
          element={user ? <ProtectedLayout><GeneralExpenses /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/suppliers" 
          element={user ? <ProtectedLayout><Suppliers /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/inventory" 
          element={user ? <ProtectedLayout><Inventory /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/accounts" 
          element={user ? <ProtectedLayout><Accounts /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/reports" 
          element={user ? <ProtectedLayout><Reports /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/profile" 
          element={user ? <ProtectedLayout><Profile /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/product-performance" 
          element={user ? <ProtectedLayout><ProductPerformance /></ProtectedLayout> : <Navigate to="/login" replace />} 
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
