import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { ClipboardList, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';

export default function Recipes() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Recipes</h1>
        <Button className="bg-slate-900"><Plus className="w-4 h-4 mr-2" /> New Recipe</Button>
      </div>
      <Card className="border-none shadow-sm">
        <CardContent className="p-12 text-center text-slate-400">
           <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
           <p className="font-medium">Recipe management is coming soon.</p>
           <p className="text-sm">You'll be able to link products to ingredients here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
