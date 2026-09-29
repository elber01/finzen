'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        // Register first
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || 'Registration failed');
          setLoading(false);
          return;
        }
      }

      // Sign in
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Invalid email or password');
        setLoading(false);
        return;
      }

      toast.success(mode === 'register' ? 'Welcome to FinZen!' : 'Welcome back!');
      router.push('/');
      router.refresh();
    } catch (err) {
      toast.error('Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-surface via-surface-2 to-primary/10">
      {/* Acentos de fondo sutiles — profundidad sin ruido */}
      <div aria-hidden className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-info/10 blur-3xl pointer-events-none" />
      <Card className="relative w-full max-w-md p-8">
        {/* Logo — marca enso, alineada con el favicon */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center mb-3 shadow-lg">
            <svg viewBox="0 0 64 64" className="w-9 h-9" aria-hidden>
              <path d="M32 13 a19 19 0 1 0 18.5 23.2" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none" />
              <circle cx="32" cy="32" r="4.5" fill="#34D399" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-primary">FinZen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'register'
              ? 'Crea tu cuenta para empezar'
              : 'Inicia sesión para continuar'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="name">Nombre (opcional)</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="h-11"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="h-11"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 text-base font-semibold"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {mode === 'register' ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === 'login'
              ? '¿No tienes cuenta? Regístrate'
              : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </Card>
    </div>
  );
}
