
import { useState } from 'react';

interface EmojiAvatarProps {
  initialEmoji: string;
  size?: number;
  isInteractive?: boolean;
  onChange?: (emoji: string) => void;
  className?: string;
}

// List of emojis to choose from
const emojiOptions = [
  "😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊",
  "😋", "😎", "😍", "😘", "🥰", "😗", "😙", "😚", "🙂", "🤗",
  "🤩", "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😣", "😥",
  "😮", "🤐", "😯", "😪", "😫", "🥱", "😴", "😌", "😛", "😜",
  "😝", "🤤", "😒", "😓", "😔", "😕", "🙃", "🤑", "😲", "☹️",
  "🙁", "😖", "😞", "😟", "😤", "😢", "😭", "😦", "😧", "😨",
  "😩", "🤯", "😬", "😰", "😱", "🥵", "🥶", "😳", "🤪", "😵",
  "🥴", "😠", "😡", "🤬", "😷", "🤒", "🤕", "🤢", "🤮", "🤧",
  "😇", "🥳", "🥺", "🤠", "🤡", "🤥", "🤫", "🤭", "🧐", "🤓",
  "👻", "👽", "🤖", "💩", "🙈", "🙉", "🙊", "🐵", "🦁", "🐯",
  "🐶", "🐺", "🦊", "🦝", "🐱", "🐴", "🦓", "🦄", "🐮", "🐷"
];

const EmojiAvatar = ({
  initialEmoji = "😀",
  size = 40,
  isInteractive = false,
  onChange,
  className = "",
}: EmojiAvatarProps) => {
  const [emoji, setEmoji] = useState(initialEmoji);
  const [showPicker, setShowPicker] = useState(false);
  
  // Handle emoji selection
  const handleSelectEmoji = (newEmoji: string) => {
    setEmoji(newEmoji);
    setShowPicker(false);
    
    if (onChange) {
      onChange(newEmoji);
    }
  };
  
  return (
    <div className={`relative ${className}`}>
      <div 
        className={`
          flex items-center justify-center 
          rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 
          transition-all duration-200
          ${isInteractive ? 'cursor-pointer hover:shadow-lg hover:scale-105' : ''}
        `}
        style={{ width: size, height: size, fontSize: size * 0.6 }}
        onClick={() => isInteractive && setShowPicker(!showPicker)}
      >
        {emoji}
      </div>
      
      {isInteractive && showPicker && (
        <div className="absolute z-50 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 border border-gray-200 dark:border-gray-700" style={{ width: Math.max(size * 7, 280) }}>
          <div className="p-1 grid grid-cols-7 gap-1 max-h-48 overflow-y-auto">
            {emojiOptions.map((option) => (
              <button
                key={option}
                onClick={() => handleSelectEmoji(option)}
                className="hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 text-xl transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiAvatar;
