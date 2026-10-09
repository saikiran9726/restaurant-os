import React from 'react';
import { Tag } from 'lucide-react';

interface PreferenceTagsProps {
  selectedTags: string[];
  onChangeTags: (tags: string[]) => void;
  note?: string;
  onChangeNote?: (note: string) => void;
  availableTags?: string[];
  showNoteInput?: boolean;
  className?: string;
}

const DEFAULT_TAGS = [
  'Less spicy',
  'Extra spicy',
  'No onion',
  'No garlic',
  'Jain',
  'Vegan',
  'Gluten free',
];

export const PreferenceTags: React.FC<PreferenceTagsProps> = ({
  selectedTags,
  onChangeTags,
  note = '',
  onChangeNote,
  availableTags = DEFAULT_TAGS,
  showNoteInput = true,
  className = '',
}) => {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChangeTags(selectedTags.filter((t) => t !== tag));
    } else {
      onChangeTags([...selectedTags, tag]);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              type="button"
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                  : 'bg-surface-subtle border-surface-border text-content-secondary hover:border-surface-elevated hover:text-content-primary'
              }`}
            >
              <Tag className={`w-3 h-3 ${isSelected ? 'text-amber-400' : 'text-content-muted'}`} />
              <span>{tag}</span>
            </button>
          );
        })}
      </div>

      {showNoteInput && onChangeNote && (
        <div>
          <input
            type="text"
            placeholder="Special dietary note (e.g. Nut allergy, extra crispy)"
            value={note}
            onChange={(e) => onChangeNote(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary placeholder:text-content-muted focus:outline-none focus:border-primary"
          />
        </div>
      )}
    </div>
  );
};
