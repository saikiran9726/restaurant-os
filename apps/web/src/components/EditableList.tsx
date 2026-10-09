import React from 'react';
import { ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { IconButton } from './ui/Button.js';

interface EditableListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  onReorder: (newItems: T[]) => void;
  disabled?: boolean;
}

export function EditableList<T>({
  items,
  keyExtractor,
  renderItem,
  onReorder,
  disabled = false,
}: EditableListProps<T>): React.JSX.Element {
  const moveUp = (index: number) => {
    if (index === 0 || disabled) return;
    const next = [...items];
    const temp = next[index - 1]!;
    next[index - 1] = next[index]!;
    next[index] = temp;
    onReorder(next);
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1 || disabled) return;
    const next = [...items];
    const temp = next[index + 1]!;
    next[index + 1] = next[index]!;
    next[index] = temp;
    onReorder(next);
  };

  return (
    <ul className="space-y-2 select-none" role="list">
      {items.map((item, index) => {
        const key = keyExtractor(item);
        return (
          <li
            key={key}
            className="flex items-center gap-3 p-3.5 bg-surface-card border border-surface-border rounded-xl transition-all duration-150 hover:border-surface-border-strong group"
          >
            {/* Reorder Buttons (Accessible non-drag alternative + indicator) */}
            <div className="flex items-center gap-1 text-content-muted">
              <GripVertical className="w-4 h-4 cursor-grab opacity-40 group-hover:opacity-100" />
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={index === 0 || disabled}
                  onClick={() => moveUp(index)}
                  className="p-1 rounded hover:bg-surface-elevated text-content-secondary disabled:opacity-20 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  aria-label="Move item up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1 || disabled}
                  onClick={() => moveDown(index)}
                  className="p-1 rounded hover:bg-surface-elevated text-content-secondary disabled:opacity-20 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  aria-label="Move item down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Custom Item Content */}
            <div className="flex-1 min-w-0">{renderItem(item, index)}</div>
          </li>
        );
      })}
    </ul>
  );
}
