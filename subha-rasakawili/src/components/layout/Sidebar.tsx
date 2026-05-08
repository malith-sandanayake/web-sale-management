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
  Settings,
  LogOut
} from "lucide-react";
import { cn } from "../../lib/utils";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: ShoppingCart, label: "New Sale", path: "/sales/new" },
  { icon: Receipt, label: "Sales History", path: "/sales" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: Leaf, label: "Ingredients", path: "/ingredients" },
  { icon: ClipboardList, label: "Recipes", path: "/recipes" },
  { icon: Users, label: "Customers", path: "/customers" },
  { icon: Receipt, label: "Expense Purchases", path: "/expenses/purchases" },
  { icon: Settings, label: "General Expenses", path: "/expenses/general" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: User, label: "Profile", path: "/profile" },
];

export default function Sidebar() {
  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          Subha Rasakawili
        </h1>
        <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">
          Traditional Food
        </p>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        {navItems.map((item) => (
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
