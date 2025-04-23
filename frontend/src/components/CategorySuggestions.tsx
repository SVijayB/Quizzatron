import React, { useEffect } from "react";
import { SearchCheck, Database, BookOpen, Tag, Sparkles, Wand2 } from "lucide-react";

interface CategorySuggestionsProps {
  categories: string[];
  searchQuery: string;
  visible: boolean;
  onSelectCategory: (category: string) => void;
  categoryData: {[key: string]: number | string};
}

const CategorySuggestions = ({
  categories,
  searchQuery,
  visible,
  onSelectCategory,
  categoryData,
}: CategorySuggestionsProps) => {
  useEffect(() => {
    if (visible && searchQuery) {
      console.log("CategorySuggestions debug:", { 
        categories: categories?.length || 0,
        categoryData: Object.keys(categoryData || {}).length,
        searchQuery
      });
    }
  }, [categories, categoryData, visible, searchQuery]);

  if (!visible || !searchQuery.trim()) return null;

  const filteredCategories = categories.filter((category) =>
    category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Always show a "generated" suggestion based on the user's input
  const generatedSuggestion = searchQuery.trim();

  // Helper function to determine the source icon and name
  const getCategorySource = (category: string) => {
    if (!categoryData || !category) {
      return { icon: <Database className="w-3 h-3" />, name: "Unknown" };
    }
    
    const value = categoryData[category];
    
    // Based on the value type, determine the source
    if (typeof value === 'number') {
      return { icon: <Database className="w-3 h-3" />, name: "OpenTDB" };
    } else if (typeof value === 'string') {
      if (value === 'trivia-qa') {
        return { icon: <BookOpen className="w-3 h-3" />, name: "TriviaQA" };
      } else {
        return { icon: <Tag className="w-3 h-3" />, name: value };
      }
    } else {
      return { icon: <Database className="w-3 h-3" />, name: "Unknown" };
    }
  };

  return (
    <div className="absolute w-full z-50 mt-2 bg-gray-800/90 backdrop-blur-md border border-violet-400/30 rounded-xl shadow-xl max-h-60 overflow-y-auto">
      <div className="p-2">
        <div className="text-xs text-white/60 px-3 py-1.5">
          {filteredCategories.length > 0 ? 
            `Category Suggestions (${filteredCategories.length})` : 
            "Generate a custom quiz"}
        </div>
        <ul>
          {/* Always show the generated option first */}
          <li>
            <button
              onClick={() => onSelectCategory(generatedSuggestion)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-white bg-gradient-to-r from-violet-600/20 to-indigo-600/20 hover:from-violet-600/30 hover:to-indigo-600/30 rounded-lg text-left transition-colors mb-1"
            >
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-violet-400" />
                <span>{generatedSuggestion}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-violet-500/20 rounded-full text-xs font-medium text-violet-300">
                <Sparkles className="w-3 h-3" />
                <span>generated</span>
              </div>
            </button>
          </li>
          
          {/* Show filtered categories if any */}
          {filteredCategories.map((category, index) => {
            const source = getCategorySource(category);
            
            return (
              <li key={index}>
                <button
                  onClick={() => onSelectCategory(category)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-white hover:bg-white/10 rounded-lg text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <SearchCheck className="w-4 h-4 text-violet-400" />
                    <span>{category}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    {source.icon}
                    <span>{source.name}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default CategorySuggestions;
