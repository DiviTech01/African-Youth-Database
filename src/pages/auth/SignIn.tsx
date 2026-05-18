import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AuthSwitch } from '@/components/ui/auth-switch';
import LanguagePrompt from '@/components/LanguagePrompt';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const SignIn = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  // No manual post-signin navigate — PublicOnly redirects to /dashboard
  // as soon as the auth context reports the user. Navigating eagerly here
  // races the async profile fetch and bounces through AuthRequired.
  const handleSignIn = async (data: { email: string; password: string }) => {
    try {
      await signIn(data.email, data.password);
      toast({ title: "Welcome back!", description: "You have successfully signed in." });
    } catch (err) {
      toast({ title: "Sign in failed", description: err instanceof Error ? err.message : "Invalid credentials.", variant: "destructive" });
    }
  };

  const handleSignUp = async (data: { name: string; email: string; password: string }) => {
    try {
      await signUp(data.name, data.email, data.password);
      navigate(`/auth/email-sent?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      toast({ title: "Sign up failed", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-12">
      <LanguagePrompt />
      {/* Grid BG */}
      <div
        className="absolute inset-0 opacity-30 w-full
        bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)]
        bg-[size:6rem_5rem]
        [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_50%,transparent_100%)]"
      />

      <Link
        to="/"
        className="absolute top-6 left-6 z-20 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to home
      </Link>

      <div className="relative z-10 w-full">
        <AuthSwitch
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
        />
      </div>
    </div>
  );
};

export default SignIn;
