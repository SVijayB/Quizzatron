import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface EmojiAvatarProps {
  initialEmoji: string;
  size?: number;
  isInteractive?: boolean;
  onChange?: (emoji: string) => void;
  className?: string;
}

// List of emojis to choose from - organized by categories for the grid layout
const emojiOptions = [
  ["🐶", "🦊", "🐱", "🦁", "🐯", "🐻", "🐼", "🐨", "🐻‍❄️", "🐮"],
  ["🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦆", "🦅", "🦉", "🦇"],
  ["🦄", "🐴", "🦓", "🦍", "🦧", "🐘", "🦏", "🦛", "🦒", "🐫"],
  ["🐿️", "🦫", "🦥", "🦘", "🦡", "🦔", "🐀", "🐰", "🦝", "🦨"],
  ["🐙", "🦑", "🦞", "🦐", "🦀", "🐠", "🐬", "🐳", "🐊", "🐢"],
  ["🦋", "🐌", "🐜", "🐝", "🪱", "🪰", "🪲", "🪳", "🦟", "🦗"],
  ["👻", "🤖", "👽", "👾", "🎃", "💩", "🧙‍♂️", "🧚‍♀️", "🧛‍♀️", "🧜‍♀️"]
];

// Flattened emoji list for random selection
const flatEmojiList = emojiOptions.flat();

// Helper function to get a random emoji from options
export const getRandomEmoji = (): string => {
  return flatEmojiList[Math.floor(Math.random() * flatEmojiList.length)];
};

const EmojiAvatar = ({
  initialEmoji = "🐶",
  size = 40,
  isInteractive = false,
  onChange,
  className = "",
}: EmojiAvatarProps) => {
  // Ensure the initialEmoji is from our options list
  const safeInitialEmoji = flatEmojiList.includes(initialEmoji) ? initialEmoji : getRandomEmoji();
  const [emoji, setEmoji] = useState(safeInitialEmoji);
  const [isOpen, setIsOpen] = useState(false);
  
  // Handle emoji selection
  const handleSelectEmoji = (newEmoji: string) => {
    setEmoji(newEmoji);
    setIsOpen(false);
    
    if (onChange) {
      onChange(newEmoji);
    }
  };
  
  // Handle random emoji selection
  const handleRandomEmoji = () => {
    if (!isInteractive) return;
    
    // Get a new random emoji (different from current)
    let newEmoji = emoji;
    while (newEmoji === emoji) {
      newEmoji = getRandomEmoji();
    }
    
    setEmoji(newEmoji);
    
    if (onChange) {
      onChange(newEmoji);
    }
  };
  
  return (
    <div className={`relative ${className}`}>
      {/* Avatar */}
      <div 
        className={`
          flex items-center justify-center 
          rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 
          transition-all duration-200
          ${isInteractive ? 'cursor-pointer hover:shadow-lg hover:scale-105' : ''}
        `}
        style={{ width: size, height: size, fontSize: size * 0.6 }}
        onClick={isInteractive ? () => setIsOpen(prev => !prev) : undefined}
      >
        {emoji}
        {isInteractive && (
          <div 
            className="absolute -bottom-1 -right-1 bg-white rounded-full w-4 h-4 flex items-center justify-center border border-indigo-500 shadow-md"
            style={{ fontSize: 10 }}
          >
            <ChevronDown className="w-3 h-3 text-indigo-600" />
          </div>
        )}
      </div>
      
      {/* Emoji Picker Dialog (Modal Style) */}
      {isInteractive && isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-3 bg-gray-50 border-b">
              <h3 className="text-center text-sm font-medium text-gray-700">Choose an avatar</h3>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-10 gap-2">
                {flatEmojiList.map((emojiChar) => (
                  <button
                    key={emojiChar}
                    onClick={() => handleSelectEmoji(emojiChar)}
                    className={`
                      w-10 h-10 flex items-center justify-center rounded-md text-xl
                      hover:bg-indigo-100 transition-colors
                      ${emoji === emojiChar ? 'bg-indigo-200 ring-2 ring-indigo-500' : 'bg-gray-50'}
                    `}
                  >
                    {emojiChar}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-3 border-t bg-gray-50 flex justify-between">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRandomEmoji}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700"
              >
                Random Avatar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiAvatar;
