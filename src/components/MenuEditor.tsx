import { Plus, Trash2, ImagePlus, X } from 'lucide-react';
import type { MenuCategory, MenuItem } from '@/types';

interface MenuEditorProps {
  value: MenuCategory[];
  onChange: (menu: MenuCategory[]) => void;
  onUploadImage?: (file: File, categoryIndex: number) => Promise<string | null>;
}

function emptyItem(): MenuItem {
  return { name: '', price: '', description: '' };
}

function emptyCategory(): MenuCategory {
  return { name: '', items: [emptyItem()] };
}

const inputBase = 'px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent-text';
const inputWide = `${inputBase} w-full`;
const inputRow = `${inputBase} flex-1 min-w-0`;

export default function MenuEditor({ value, onChange, onUploadImage }: MenuEditorProps) {
  const menu = value || [];

  const updateCategory = (ci: number, cat: MenuCategory) => {
    onChange(menu.map((c, i) => i === ci ? cat : c));
  };
  const updateItem = (ci: number, ii: number, patch: Partial<MenuItem>) => {
    onChange(menu.map((c, i) => i === ci ? { ...c, items: c.items.map((it, j) => j === ii ? { ...it, ...patch } : it) } : c));
  };
  const addItem = (ci: number) => {
    onChange(menu.map((c, i) => i === ci ? { ...c, items: [...c.items, emptyItem()] } : c));
  };
  const removeItem = (ci: number, ii: number) => {
    onChange(menu.map((c, i) => i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c));
  };
  const addCategory = () => {
    onChange([...menu, emptyCategory()]);
  };
  const removeCategory = (ci: number) => {
    onChange(menu.filter((_, i) => i !== ci));
  };
  const pickImage = async (ci: number, file: File) => {
    if (!onUploadImage) return;
    const url = await onUploadImage(file, ci);
    if (url) updateCategory(ci, { ...menu[ci], image: url });
  };
  const clearImage = (ci: number) => {
    updateCategory(ci, { ...menu[ci], image: undefined });
  };

  return (
    <div className="space-y-4">
      {menu.map((cat, ci) => (
        <div key={ci} className="bg-space border border-line rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            {cat.image && (
              <div className="relative flex-shrink-0">
                <img src={cat.image} alt="" className="w-11 h-11 rounded-lg object-cover border border-line" />
                <button onClick={() => clearImage(ci)} aria-label="Remove category image" className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger text-white text-[10px] leading-none flex items-center justify-center cursor-pointer"><X className="w-2.5 h-2.5" /></button>
              </div>
            )}
            <input
              value={cat.name}
              onChange={(e) => updateCategory(ci, { ...cat, name: e.target.value })}
              placeholder="Category (e.g. Tacos, Drinks, Desserts)"
              className={`${inputRow} font-semibold`}
            />
            <label className="p-2 text-ink-faint hover:text-accent-text transition cursor-pointer" title="Add a category photo">
              <ImagePlus className="w-4 h-4" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(ci, f); e.target.value = ''; }} />
            </label>
            <button onClick={() => removeCategory(ci)} aria-label="Remove category" className="p-2 text-ink-faint hover:text-danger transition cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {cat.items.map((item, ii) => (
              <div key={ii} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(ci, ii, { name: e.target.value })}
                    placeholder="Item name"
                    className={inputRow}
                  />
                  <input
                    value={item.price || ''}
                    onChange={(e) => updateItem(ci, ii, { price: e.target.value })}
                    placeholder="$5"
                    className={`${inputBase} w-20 flex-shrink-0 text-right`}
                  />
                  <button onClick={() => removeItem(ci, ii)} aria-label="Remove item" className="p-2 text-ink-faint hover:text-danger transition cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  value={item.description || ''}
                  onChange={(e) => updateItem(ci, ii, { description: e.target.value })}
                  placeholder="Description (optional)"
                  className={inputWide}
                />
              </div>
            ))}
          </div>

          <button onClick={() => addItem(ci)} className="mt-2 text-xs font-semibold text-accent-text hover:text-accent-text-hover cursor-pointer">
            + Add item
          </button>
        </div>
      ))}

      <button
        onClick={addCategory}
        className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent-text hover:text-accent-text transition cursor-pointer"
      >
        <Plus className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Add Category
      </button>

      <p className="text-[11px] text-ink-faint">
        Items with a name show on your card page. Add a photo per category for a more appetizing menu.
      </p>
    </div>
  );
}
