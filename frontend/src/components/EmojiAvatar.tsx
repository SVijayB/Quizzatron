import { useState, useEffect } from "react";

// List of emojis to choose from
const emojis = [
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
  "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐔",
  "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🦄",
  "🐴", "🐗", "🐺", "🦝", "🦥", "🦨", "🦡", "🦘", "🦙", "🦔",
  "🐿️", "🦫", "🦦", "🦍", "🦧", "🐘", "🦏", "🦛", "🐪", "🐫",
  "🦬", "🐃", "🐂", "🐄", "🐓", "🦃", "🕊️", "🪿", "🦢", "🦩",
  "🦚", "🦜", "🦤", "🪽", "👽", "🤖"
];

// Function to get a random emoji
export const getRandomEmoji = (): string => {
  return emojis[Math.floor(Math.random() * emojis.length)];
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
  className = "",
}: EmojiAvatarProps) => {
  const [emoji, setEmoji] = useState(initialEmoji);
  
  // Update emoji when initialEmoji prop changes
  useEffect(() => {
    if (initialEmoji) {
      setEmoji(initialEmoji);
    }
  }, [initialEmoji]);
  
  // Handle random emoji generation on click
  const handleRandomEmoji = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    e.preventDefault(); // Prevent default behavior
    
    const newEmoji = getRandomEmoji();
    setEmoji(newEmoji);
    if (onChange) {
      onChange(newEmoji);
    }
  };
  
  // Container and font size based on the size prop
  const containerSize = `${size}px`;
  const fontSize = `${size * 0.6}px`;
  
  // Render a non-interactive avatar if isInteractive is false
  if (!isInteractive) {
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 ${className}`}
        style={{ width: containerSize, height: containerSize }}
      >
        <span className="text-white" style={{ fontSize }}>{emoji}</span>
      </div>
    );
  }
  
  // Render interactive avatar that generates random emoji on click
  return (
    <div className="relative inline-block" style={{ zIndex: 50 }}>
      {/* Avatar Button */}
      <button
        type="button"
        onClick={handleRandomEmoji}
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 cursor-pointer relative group overflow-hidden ${className}`}
        style={{ width: containerSize, height: containerSize }}
      >
        <span className="text-white" style={{ fontSize }}>{emoji}</span>
        <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-white font-medium">↻</span>
        </div>
      </button>
    </div>
  );
};

export default EmojiAvatar;
