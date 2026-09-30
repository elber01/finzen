'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { useFinZenStore } from '@/store/finzen-store';
import { toast } from 'sonner';

const ICON_OPTIONS = ['📦', '🍔', '🏠', '🚇', '🎬', '⚡', '🏥', '🛍️', '💼', '📈', '💻', '↩️', '₿', '💰', '🎓', '✈️', '📱', '🐕', '🍷', '💡'];
const COLOR_OPTIONS = ['#059669', '#10B981', '#14B8A6', '#1E3A5F', '#F59E0B', '#3B82F6', '#A855F7', '#EF4444', '#EC4899', '#F97316', '#F7931A', '#6B7280'];

export function CategoriesManager() {
  const { categories, locale, addCategory, updateCategory, deleteCategory } = useFinZenStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState('#6B7280');
  const [direction, setDirection] = useState('expense');

  function resetForm() { setName(''); setNameEs(''); setNameEn(''); setIcon('📦'); setColor('#6B7280'); setDirection('expense'); }
  function openCreate() { resetForm(); setEditingId(null); setDialogOpen(true); }
  function openEdit(id: string) {
    const c = categories.find(x => x.id === id); if (!c) return;
    setEditingId(id); setName(c.name); setNameEs(c.nameEs || ''); setNameEn(c.nameEn || '');
    setIcon(c.icon || '📦'); setColor(c.color || '#6B7280'); setDirection(c.direction); setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditingId(null); setTimeout(resetForm, 200); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error(locale === 'es' ? 'Nombre requerido' : 'Name required'); return; }
    const payload = { name: name.trim(), nameEs: nameEs.trim() || name.trim(), nameEn: nameEn.trim() || name.trim(), icon, color, direction };
    try {
      if (editingId) { await updateCategory(editingId, payload); toast.success(locale === 'es' ? 'Categoría actualizada' : 'Category updated'); }
      else { await addCategory(payload); toast.success(locale === 'es' ? 'Categoría creada' : 'Category created'); }
      closeDialog();
    } catch (err) { toast.error(String(err).replace('Error: ', '')); }
  }

  async function handleDelete(id: string) {
    try { await deleteCategory(id); toast.success(locale === 'es' ? 'Categoría eliminada' : 'Category deleted'); }
    catch (err) { toast.error(String(err).replace('Error: ', '')); }
  }

  const expenseCats = categories.filter(c => c.direction === 'expense');
  const incomeCats = categories.filter(c => c.direction === 'income');

  function renderCategoryList(cats: typeof categories, title: string) {
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-1">{title}</h4>
        {cats.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-surface-2 transition-colors">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: `${c.color ?? '#6B7280'}20`, color: c.color ?? undefined }}>
              {c.icon || '📦'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{locale === 'es' ? (c.nameEs || c.name) : (c.nameEn || c.name)}</div>
              {c.isSystem && <div className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> {locale === 'es' ? 'Sistema' : 'System'}</div>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => openEdit(c.id)} className="p-1.5 rounded-md hover:bg-surface-2 text-muted-foreground hover:text-foreground min-w-[40px] min-h-[40px] flex items-center justify-center" aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></button>
              {!c.isSystem && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1.5 rounded-md hover:bg-expense-soft text-muted-foreground hover:text-expense min-w-[40px] min-h-[40px] flex items-center justify-center" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{locale === 'es' ? '¿Eliminar categoría?' : 'Delete category?'}</AlertDialogTitle>
                      <AlertDialogDescription>{locale === 'es' ? 'No se puede deshacer. Si tiene transacciones asociadas, no se podrá eliminar.' : 'Cannot undo. If transactions use it, deletion will be blocked.'}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-expense text-white hover:bg-expense/90">{locale === 'es' ? 'Eliminar' : 'Delete'}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{locale === 'es' ? 'Gestión de Categorías' : 'Category Management'}</h3>
        <Button size="sm" variant="outline" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />{locale === 'es' ? 'Nueva' : 'New'}</Button>
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto scroll-area">
        {renderCategoryList(expenseCats, locale === 'es' ? 'Gastos' : 'Expenses')}
        {renderCategoryList(incomeCats, locale === 'es' ? 'Ingresos' : 'Income')}
      </div>

      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? (locale === 'es' ? 'Editar categoría' : 'Edit category') : (locale === 'es' ? 'Nueva categoría' : 'New category')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Nombre (es)' : 'Name (es)'}</Label>
              <Input value={nameEs} onChange={e => { setNameEs(e.target.value); if (!nameEn) setName(e.target.value); }} placeholder={locale === 'es' ? 'ej. Restaurantes' : 'e.g. Restaurants'} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Nombre (en)' : 'Name (en)'}</Label>
              <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="e.g. Restaurants" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Tipo' : 'Direction'}</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{locale === 'es' ? 'Gasto' : 'Expense'}</SelectItem>
                  <SelectItem value="income">{locale === 'es' ? 'Ingreso' : 'Income'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Ícono' : 'Icon'}</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map(ic => (
                  <button key={ic} type="button" onClick={() => setIcon(ic)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors ${icon === ic ? 'bg-primary/15 ring-2 ring-primary' : 'bg-surface-2 hover:bg-surface-2'}`}>{ic}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Color' : 'Color'}</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(cl => (
                  <button key={cl} type="button" onClick={() => setColor(cl)}
                    className={`w-8 h-8 rounded-full transition-transform ${color === cl ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''}`}
                    style={{ background: cl }} />
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full h-11">{editingId ? (locale === 'es' ? 'Guardar' : 'Save') : (locale === 'es' ? 'Crear' : 'Create')}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
