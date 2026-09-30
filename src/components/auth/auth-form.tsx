'use client';

import { useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';

type Strength = 0 | 1 | 2 | 3;

function passwordStrength(pw: string): Strength {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  return Math.min(score, 3) as Strength;
}

export function AuthForm() {
  const router = useRouter();
  const { locale, setLocale } = useFinZenStore();
  const t = translations[locale];
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const strengthLabel = strength === 0 ? null : strength === 1
    ? t['auth.strength.weak']
    : strength === 2
    ? t['auth.strength.fair']
    : t['auth.strength.strong'];
  const strengthColor = strength <= 1 ? 'var(--expense)' : strength === 2 ? 'var(--warning)' : 'var(--income)';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t['auth.errorRequired']);
      return;
    }
    if (mode === 'register' && password.length < 6) {
      toast.error(t['auth.weakPassword']);
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || t['auth.errorGeneric']);
          setLoading(false);
          return;
        }
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(t['auth.invalidCredentials']);
        setLoading(false);
        return;
      }

      toast.success(mode === 'register' ? t['auth.welcome'] : t['auth.welcomeBack']);
      router.push('/');
      router.refresh();
    } catch (err) {
      toast.error(t['auth.errorGeneric']);
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-surface via-surface-2 to-primary/10">
      {/* Acentos de fondo sutiles — profundidad sin ruido */}
      <div aria-hidden className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-info/10 blur-3xl pointer-events-none" />
      <Card className="relative w-full max-w-md p-8">
        {/* Idioma — accesible antes del login */}
        <button
          onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
          className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          aria-label={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        >
          <Languages className="w-3.5 h-3.5" />
          {locale === 'es' ? 'EN' : 'ES'}
        </button>

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
            {mode === 'register' ? t['auth.registerSubtitle'] : t['auth.loginSubtitle']}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="name">{t['auth.name']}</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={locale === 'es' ? 'Tu nombre' : 'Your name'}
                className="h-11"
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t['auth.email']}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="h-11"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t['auth.password']}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t['auth.passwordHint']}
              className="h-11"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              aria-describedby={mode === 'register' && strength > 0 ? 'pw-strength' : undefined}
            />
            {/* Medidor de fortaleza — solo en registro y con valor escrito */}
            {mode === 'register' && strength > 0 && (
              <div id="pw-strength" className="flex items-center gap-2 pt-1" aria-live="polite">
                <div className="flex gap-1 flex-1" role="img" aria-label={`${t['auth.passwordStrength']}: ${strengthLabel}`}>
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="h-1 flex-1 rounded-full transition-colors"
                      style={{ background: i <= strength ? strengthColor : 'var(--border)' }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium" style={{ color: strengthColor }}>
                  {strengthLabel}
                </span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 text-base font-semibold"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {mode === 'register' ? t['auth.signUp'] : t['auth.signIn']}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className={cn(
              'text-sm text-muted-foreground hover:text-foreground transition-colors'
            )}
          >
            {mode === 'login' ? t['auth.noAccount'] : t['auth.hasAccount']}
          </button>
        </div>
      </Card>
    </div>
  );
}
