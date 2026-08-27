import { BookOpen, Database, SearchCheck, Sparkles, Tag, Wand2 } from "lucide-react";

import type { Category, QuestionSource } from "@/types/api";

interface CategorySuggestionsProps {
  categories: Category[];
  searchQuery: string;
  visible: boolean;
  onSelectCategory: (category: Category | null, name: string) => void;
  /** Cap the list so the panel never becomes an endless scroll. */
  limit?: number;
}

const SOURCE_META: Record<QuestionSource, { icon: typeof Database; name: string }> = {
  opentdb: { icon: Database, name: "OpenTDB" },
  mongo: { icon: BookOpen, name: "TriviaQA" },
  llm: { icon: Tag, name: "Generated" },
};

/**
 * Typeahead panel for the category field. Solid surface, hard border.
 *
 * Rewritten for the v2 `{name, source, ref}` shape. v1's categories endpoint
 * returned a flat map whose *value type* was the source discriminator — an
 * `int` meant OpenTDB, the string `"trivia-qa"` meant MongoDB — so this
 * component had to sniff `typeof` to label a row.
 */
const CategorySuggestions = ({
  categories,
  searchQuery,
  visible,
  onSelectCategory,
  limit = 40,
}: CategorySuggestionsProps) => {
  const query = searchQuery.trim();
  if (!visible || !query) return null;

  const needle = query.toLowerCase();
  const matches = categories
    .filter((category) => category.name.toLowerCase().includes(needle))
    .slice(0, limit);

  return (
    <div className="absolute z-sticky mt-2 max-h-64 w-full overflow-y-auto overscroll-contain rounded-lg border-2 border-ink-line bg-ink-raised shadow-hard">
      <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-bone-dim">
        {matches.length > 0
          ? `Matches (${matches.length})`
          : "No match — generate a custom quiz"}
      </p>

      <ul className="flex flex-col gap-1 p-2 pt-0">
        <li>
          <button
            type="button"
            onClick={() => onSelectCategory(null, query)}
            className="flex min-h-touch w-full items-center justify-between gap-2 rounded-sm border-2 border-ink-line bg-acid px-3 py-2 text-left text-sm font-bold text-ink transition-colors duration-fast ease-out hover:bg-acid-deep"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Wand2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{query}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Generated
            </span>
          </button>
        </li>

        {matches.map((category) => {
          const meta = SOURCE_META[category.source] ?? SOURCE_META.llm;
          const Icon = meta.icon;
          return (
            <li key={`${category.source}:${category.ref}`}>
              <button
                type="button"
                onClick={() => onSelectCategory(category, category.name)}
                className="flex min-h-touch w-full items-center justify-between gap-2 rounded-sm border-2 border-transparent px-3 py-2 text-left text-sm font-semibold text-bone transition-colors duration-fast ease-out hover:border-ink-line hover:bg-ink-sunken hover:text-acid"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <SearchCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{category.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-bone-dim">
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {meta.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CategorySuggestions;
