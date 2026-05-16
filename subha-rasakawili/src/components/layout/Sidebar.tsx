import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Leaf, 
  ClipboardList, 
  Users, 
  User,
  Receipt, 
  BarChart3,
  Building2,
  Warehouse,
  BookOpen,
  Settings,
  LogOut
} from "lucide-react";
import { cn } from "../../lib/utils";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";

const mainNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: ShoppingCart, label: "New Sale", path: "/sales/new" },
  { icon: Receipt, label: "Sales History", path: "/sales" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: Leaf, label: "Ingredients", path: "/ingredients" },
  { icon: ClipboardList, label: "Recipes", path: "/recipes" },
  { icon: Users, label: "Customers", path: "/customers" },
];

const expenseNavItems = [
  { icon: Receipt, label: "Expense Purchases", path: "/expenses/purchases" },
  { icon: Settings, label: "General Expenses", path: "/expenses/general" },
  { icon: Building2, label: "Suppliers", path: "/suppliers" },
  { icon: Warehouse, label: "Inventory", path: "/inventory" },
];

const accountingNavItems = [
  { icon: BookOpen, label: "Final Accounts", path: "/accounts" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
];

const supportNavItems = [
  { icon: User, label: "Profile", path: "/profile" },
];

export default function Sidebar() {
  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-dvh sticky top-0 shrink-0 overflow-hidden">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-amber-400">
          Subha Rasakawili
        </h1>
        <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">
          The Taste of Tradition - For your Family
        </p>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-2 space-y-3">
        <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          Main
        </div>
        {mainNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                isActive 
                  ? "bg-slate-800 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{item.label}</span>
          </NavLink>
        ))}

        <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          Expenses
        </div>
        {expenseNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                isActive 
                  ? "bg-slate-800 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{item.label}</span>
          </NavLink>
        ))}

        <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          Accounting
        </div>
        {accountingNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                isActive 
                  ? "bg-slate-800 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{item.label}</span>
          </NavLink>
        ))}

        <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          Support
        </div>
        {supportNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                isActive 
                  ? "bg-slate-800 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-slate-400 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
}
