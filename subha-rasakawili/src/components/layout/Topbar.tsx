import { auth } from "../../lib/firebase";
import { User } from "lucide-react";

export default function Topbar() {
  const user = auth.currentUser;

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-slate-800">
          {window.location.pathname === '/' ? 'Overview' : 
           window.location.pathname.substring(1).charAt(0).toUpperCase() + window.location.pathname.slice(2).replace('/', ' / ')}
        </h2>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{user?.displayName || 'Admin'}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border text-slate-500">
          <User className="w-6 h-6" />
        </div>
      </div>
    </header>
  );
}
