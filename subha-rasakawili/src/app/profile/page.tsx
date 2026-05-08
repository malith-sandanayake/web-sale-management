import { useState } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { AlertTriangle, Trash2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const collectionsToDelete = [
  'receipt_items',
  'payments',
  'receipts',
  'expense_purchases',
  'expense_general',
  'products',
  'ingredients',
  'customers'
];

export default function Profile() {
  const user = auth.currentUser;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const resetAllData = async () => {
    setIsResetting(true);

    try {
      await Promise.all(
        collectionsToDelete.map(async (collectionName) => {
          const snapshot = await getDocs(collection(db, collectionName));
          await Promise.all(
            snapshot.docs.map((document) => deleteDoc(doc(db, collectionName, document.id)))
          );
        })
      );

      toast.success('All app data has been reset successfully.');
      setIsConfirmOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'all-data');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-slate-900">
            <User className="w-5 h-5" />
            <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          </div>
          <p className="text-slate-500">Manage your account and reset stored application data.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Data Reset</CardTitle>
          <CardDescription>
            Use this action to permanently remove all application records. This includes customers, products, sales, receipts, payments, and expenses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <div>
              <p className="font-semibold text-slate-900">Warning</p>
              <p className="text-sm text-slate-700">
                Resetting will permanently delete all saved data. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Current user</p>
            <p className="font-medium text-slate-900">{user?.displayName || 'Unknown User'}</p>
            <p className="text-sm text-slate-500">{user?.email || 'No email available'}</p>
          </div>

          <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <DialogTrigger render={
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="w-4 h-4 mr-2" /> Reset All Data
              </Button>
            } />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Data Reset</DialogTitle>
                <DialogDescription>
                  This will permanently delete all application data. Are you sure you want to continue?
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-slate-600">
                  The following collections will be cleared:
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {collectionsToDelete.map((collectionName) => (
                    <li key={collectionName}>{collectionName}</li>
                  ))}
                </ul>
                <p className="text-xs text-red-600">
                  This cannot be undone. Make sure you have a backup before confirming.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" type="button" onClick={resetAllData} disabled={isResetting}>
                  {isResetting ? 'Resetting...' : 'Confirm Reset'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
