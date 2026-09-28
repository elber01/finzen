'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Key, Plus, Copy, Trash2, Check, Bot, Eye, EyeOff } from 'lucide-react';
import { useFinZenStore } from '@/store/finzen-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export function ApiKeyManager() {
  const { locale } = useFinZenStore();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState('read,write');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch (e) {
      console.error('Failed to load API keys:', e);
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadKeys(); }, [loadKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) { toast.error(locale === 'es' ? 'Nombre requerido' : 'Name required'); return; }
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim(), permissions: newKeyPerms }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setShowKey(false);
        toast.success(locale === 'es' ? 'API key creada' : 'API key created');
        setNewKeyName('');
        setNewKeyPerms('read,write');
        loadKeys();
      } else {
        toast.error(locale === 'es' ? 'Error al crear' : 'Failed to create');
      }
    } catch { toast.error('Error'); }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      toast.success(locale === 'es' ? 'API key revocada' : 'API key revoked');
      loadKeys();
    } catch { toast.error('Error'); }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    try {
      await fetch(`/api/api-keys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      toast.success(locale === 'es' ? (currentActive ? 'Desactivada' : 'Activada') : (currentActive ? 'Deactivated' : 'Activated'));
      loadKeys();
    } catch { toast.error('Error'); }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(locale === 'es' ? 'Copiado al portapapeles' : 'Copied to clipboard');
  }

  function closeDialog() {
    setDialogOpen(false);
    setCreatedKey(null);
    setShowKey(false);
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === 'es' ? 'es-DO' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">{locale === 'es' ? 'Integración con Agentes IA' : 'AI Agent Integration'}</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setCreatedKey(null); setDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1" />{locale === 'es' ? 'Nueva Key' : 'New Key'}
        </Button>
      </div>

      {keys.length === 0 && !loading ? (
        <div className="py-6 text-center">
          <Key className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground mb-3">
            {locale === 'es'
              ? 'Crea una API key para que un agente IA (como Claude) pueda leer tus finanzas y registrar transacciones automáticamente.'
              : 'Create an API key so an AI agent (like Claude) can read your finances and register transactions automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto scroll-area">
          {keys.map(key => (
            <div key={key.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-surface-2 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{key.name}</span>
                  {!key.isActive && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {locale === 'es' ? 'Inactiva' : 'Inactive'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <code className="font-mono">{key.keyPrefix}</code>
                  <span>·</span>
                  <span>{key.permissions}</span>
                  <span>·</span>
                  <span>{locale === 'es' ? 'Usada' : 'Used'}: {formatDate(key.lastUsedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleToggle(key.id, key.isActive)} className="p-1.5 rounded-md hover:bg-surface-2 text-muted-foreground min-w-[32px] min-h-[32px] flex items-center justify-center" title={key.isActive ? (locale === 'es' ? 'Desactivar' : 'Deactivate') : (locale === 'es' ? 'Activar' : 'Activate')}>
                  {key.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1.5 rounded-md hover:bg-expense-soft text-muted-foreground hover:text-expense min-w-[32px] min-h-[32px] flex items-center justify-center" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{locale === 'es' ? '¿Revocar API key?' : 'Revoke API key?'}</AlertDialogTitle>
                      <AlertDialogDescription>{locale === 'es' ? 'Esta acción no se puede deshacer. El agente IA perderá acceso inmediatamente.' : 'This cannot be undone. The AI agent will lose access immediately.'}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(key.id)} className="bg-expense text-white hover:bg-expense/90">{locale === 'es' ? 'Revocar' : 'Revoke'}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API documentation snippet */}
      <div className="mt-3 p-3 rounded-lg bg-surface-2 text-xs space-y-1">
        <div className="font-medium text-muted-foreground">{locale === 'es' ? 'Endpoints públicos (API key):' : 'Public endpoints (API key):'}</div>
        <code className="block text-[11px] text-muted-foreground">POST /api/v1/expenses&nbsp;&nbsp;&nbsp;— {locale === 'es' ? 'Registrar gasto (externo)' : 'Register expense (external)'}</code>
        <code className="block text-[11px] text-muted-foreground">GET&nbsp; /api/v1/expenses&nbsp;&nbsp;&nbsp;— {locale === 'es' ? 'Listar gastos (?limit=&month=)' : 'List expenses (?limit=&month=)'}</code>
        <code className="block text-[11px] text-muted-foreground">GET&nbsp; /api/v1/summary&nbsp;&nbsp;&nbsp;&nbsp;— {locale === 'es' ? 'Resumen mensual (?month=YYYY-MM)' : 'Monthly summary (?month=YYYY-MM)'}</code>
        <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border">
          {locale === 'es' ? 'Cabecera:' : 'Header:'} <code className="font-mono">X-API-Key: fz_…</code> {locale === 'es' ? 'o' : 'or'} <code className="font-mono">Authorization: Bearer fz_…</code>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{locale === 'es' ? 'Crear API Key' : 'Create API Key'}</DialogTitle></DialogHeader>
          {createdKey ? (
            <div className="space-y-4 mt-2">
              <div className="bg-income-soft/30 border border-income/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-income" />
                  <span className="text-sm font-medium">{locale === 'es' ? 'API key creada. Cópiala ahora — no se mostrará de nuevo.' : 'API key created. Copy it now — it won\'t be shown again.'}</span>
                </div>
                <div className="relative">
                  <Input value={createdKey} readOnly className="font-mono text-xs pr-20" />
                  <button onClick={() => copyToClipboard(createdKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-surface-2" title="Copy">
                    {copied ? <Check className="w-3.5 h-3.5 text-income" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {locale === 'es' ? 'Para usarla, incluye esta cabecera en las peticiones:' : 'To use it, include this header in requests:'}
                  <code className="block mt-1 p-2 bg-surface-2 rounded font-mono">Authorization: Bearer {createdKey.substring(0, 12)}...</code>
                </div>
              </div>
              <Button className="w-full h-11" onClick={closeDialog}>{locale === 'es' ? 'Listo' : 'Done'}</Button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Nombre del agente' : 'Agent name'}</Label>
                <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder={locale === 'es' ? 'ej. Claude, Mi GPT, Asistente' : 'e.g. Claude, My GPT, Assistant'} className="h-11" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Permisos' : 'Permissions'}</Label>
                <Select value={newKeyPerms} onValueChange={setNewKeyPerms}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read,write">{locale === 'es' ? 'Leer y escribir' : 'Read and write'}</SelectItem>
                    <SelectItem value="read">{locale === 'es' ? 'Solo lectura' : 'Read only'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full h-11">{locale === 'es' ? 'Crear API Key' : 'Create API Key'}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
