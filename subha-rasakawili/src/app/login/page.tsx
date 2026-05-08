import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from 'sonner';

export default function Login() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Login successful!");
    } catch (error: any) {
      console.error(error);
      const errorCode = error.code || "unknown";
      toast.error(`Login failed (${errorCode}). Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-1">
          <div className="mx-auto w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white mb-4">
            <span className="text-xl font-bold">S</span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            SweetBiz Manager
          </CardTitle>
          <CardDescription>
            Welcome back! Please login to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            className="w-full bg-slate-900 hover:bg-slate-800 h-11" 
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Continue with Google"}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-2 text-slate-500">
                Single User Access
              </span>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500 px-4">
            For this preview, we use Google Login to securely identify the administrator.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center text-xs text-slate-400">
          <span>&copy; 2024 SweetBiz Sri Lanka</span>
        </CardFooter>
      </Card>
    </div>
  );
}
