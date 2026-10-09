import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import type { InventoryItemOutput } from '@restaurant-os/shared';

export interface ItemTypeaheadProps {
  items: InventoryItemOutput[];
  selectedItemId: string | null;
  onSelectItem: (item: InventoryItemOutput) => void;
  placeholder?: string;
  className?: string;
}

export const ItemTypeahead: React.FC<ItemTypeaheadProps> = ({
  items,
  selectedItemId,
  onSelectItem,
  placeholder = 'Search ingredient (e.g. Rice, Milk)...',
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  useEffect(() => {
    if (selectedItem) {
      setQuery(selectedItem.name);
    }
  }, [selectedItem]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-xs font-semibold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-surface-card border border-surface-border rounded-xl shadow-xl z-50 divide-y divide-surface-border/50">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-xs text-content-muted">
              No matching ingredients found
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = item.id === selectedItemId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectItem(item);
                    setQuery(item.name);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-surface-elevated transition-colors ${
                    isSelected ? 'bg-accent/10 font-bold' : ''
                  }`}
                >
                  <div>
                    <span className="text-content-primary font-semibold">{item.name}</span>
                    <span className="text-[11px] text-content-muted ml-2">
                      ({item.unit}) • Stock: {item.currentStock} {item.unit}
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
