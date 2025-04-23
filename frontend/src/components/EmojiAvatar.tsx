import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Emoji categories for a structured, manageable selection
const emojiCategories = {
  animals: [
    "🐶", "🦊", "🐱", "🦁", "🐯", "🐻", "🐼", "🐨", "🐻‍❄️", "🐷", 
    "🦄", "🐴", "🦓", "🐘", "🦧", "🐪", "🦒", "🐫", "🦝", "🦡", 
    "🦊", "🐿️", "🦔", "🦇", "🐁", "🐹", "🦫", "🐇", "🐰", "🐿️"
  ],
  aquatic: [
    "🐙", "🦑", "🦞", "🦀", "🦐", "🐠", "🐡", "🐬", "🐳", "🦈"
  ],
  insects: [
    "🦋", "🐌", "🐛", "🐝", "🪱", "🐞", "🦟", "🦗", "🪲", "🦂"
  ],
  birds: [
    "🦜", "🐓", "🦃", "🦢", "🐧", "🦩", "🦉", "🦅", "🦤", "🦆"
  ],
  misc: [
    "👻", "🤖", "👽", "👾", "🎃", "💩", "🤡", "👹", "👺", "🧙‍♀️"
  ],
};

// Flatten emoji list for random selection
const allEmojis = Object.values(emojiCategories).flat();

export const getRandomEmoji = () => {
  return allEmojis[Math.floor(Math.random() * allEmojis.length)];
};

interface EmojiAvatarProps {
  initialEmoji?: string;
  onChange?: (emoji: string) => void;
  size?: number;
  isInteractive?: boolean;
  className?: string;
}

const EmojiAvatar = ({
  initialEmoji = "🐶",
  onChange,
  size = 40,
  isInteractive = false,
  className,
}: EmojiAvatarProps) => {
  const [emoji, setEmoji] = useState(initialEmoji);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  
  useEffect(() => {
    if (initialEmoji) {
      setEmoji(initialEmoji);
    }
  }, [initialEmoji]);

  useEffect(() => {
    // Calculate and set menu position when it opens
    if (isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX + rect.width / 2
      });
    }
  }, [isMenuOpen]);

  // Handle clicks outside the menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && 
          !menuRef.current.contains(event.target as Node) && 
          buttonRef.current && 
          !buttonRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleEmojiChange = (newEmoji: string) => {
    setEmoji(newEmoji);
    if (onChange) {
      onChange(newEmoji);
    }
    setIsMenuOpen(false);
  };

  // Fix for background of the entire card turning black
  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    e.preventDefault(); // Prevent default behavior
    setIsMenuOpen(!isMenuOpen);
  };

  const containerSize = `${size}px`;
  const fontSize = `${size * 0.6}px`;

  // Non-interactive version
  if (!isInteractive) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600",
          className
        )}
        style={{ width: containerSize, height: containerSize }}
      >
        <span style={{ fontSize }}>{emoji}</span>
      </div>
    );
  }

  // Interactive version with direct DOM handling
  return (
    <div className="relative inline-block" style={{ zIndex: 1 }}>
      {/* Avatar Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 cursor-pointer relative group",
          className
        )}
        style={{ width: containerSize, height: containerSize }}
      >
        <span style={{ fontSize }}>{emoji}</span>
        <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronDown className="w-5 h-5 text-white/80" />
        </div>
      </button>

      {/* Emoji Selection Menu - Rendered in a portal to avoid z-index issues */}
      {isMenuOpen && (
        <div 
          ref={menuRef}
          className="fixed p-3 w-[280px] max-h-[320px] overflow-y-auto bg-gray-900/95 border border-white/10 backdrop-blur-md rounded-lg shadow-xl"
          style={{ 
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            transform: 'translateX(-50%)',
            zIndex: 9999
          }}
        >
          <div className="grid grid-cols-6 gap-2">
            {allEmojis.map((e, i) => (
              <button
                key={i}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleEmojiChange(e);
                }}
                className={`w-10 h-10 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-white/10 transition-colors ${
                  emoji === e ? "bg-white/20 ring-1 ring-white/30" : ""
                }`}
              >
                <span className="text-xl text-white">{e}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiAvatar;
