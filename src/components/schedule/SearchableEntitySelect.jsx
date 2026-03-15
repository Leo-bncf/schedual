import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, Search, X } from 'lucide-react';

const normalizeSearch = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export default function SearchableEntitySelect({
  items = [],
  value,
  onChange,
  placeholder,
  emptyText,
  renderSubtitle,
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const selectedItem = items.find((item) => item.id === value) || null;

  React.useEffect(() => {
    if (selectedItem && !open) {
      setQuery(selectedItem.full_name || '');
    }
  }, [selectedItem, open]);

  const filteredItems = items.filter((item) =>
    normalizeSearch(item.full_name).includes(normalizeSearch(query))
  );

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim() && value) onChange('');
          }}
          className="pl-9 pr-20 h-11 border-slate-200"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setQuery(''); onChange(''); setOpen(false); }}>
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen((prev) => !prev)}>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="max-h-72 overflow-y-auto p-1">
            {filteredItems.length > 0 ? filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  setQuery(item.full_name || '');
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{item.full_name}</div>
                  {renderSubtitle && (
                    <div className="text-xs text-slate-500">{renderSubtitle(item)}</div>
                  )}
                </div>
                {value === item.id && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            )) : (
              <div className="px-3 py-4 text-sm text-slate-500">{emptyText}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}