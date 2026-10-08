'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, ShieldCheck, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/workstation';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        window.location.href = callbackUrl;
      } else {
        setError(res.status >= 500 ? 'Sign in is temporarily unavailable. Please try again.' : (json.message || json.error || 'Invalid email or password.'));
      }
    } catch (err) {
      setError('Network connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md space-y-6 mx-auto px-4 z-10 font-sans">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-card border border-border shadow-subtle mb-1">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center font-bold text-primary-foreground text-base shadow-sm">
            M
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          MineTech <span className="text-primary">Outbound</span>
        </h1>
        <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Your conversations. One connected workstation.
        </p>
      </div>

      {/* Clean Login Card */}
      <div className="bg-card border border-border rounded-2xl p-7 shadow-card space-y-5 text-foreground">
        <div className="border-b border-border pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Welcome Back
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sign in to your MineTech workstation.
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@minetechresources.com"
                className="w-full bg-muted/30 border border-border focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none transition-all duration-150"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Password
              </label>
            </div>
            <div className="relative">
              <KeyRound className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-muted/30 border border-border focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 rounded-xl pl-10 pr-10 py-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none transition-all duration-150 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full mt-2 py-3 px-6 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs rounded-xl shadow-sm focus:outline-none transition-all duration-150 active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign in to Workstation</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>Encrypted Workstation</span>
          <span className="text-primary flex items-center gap-1 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Supabase Protected
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <Suspense fallback={<div className="text-muted-foreground text-xs font-mono">Loading sign in…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
