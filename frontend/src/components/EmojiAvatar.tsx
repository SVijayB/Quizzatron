import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const emojis = ['😀', '😎', '🚀', '💡', '🎉', '🧠', '🎮', '🌟', '🤖', '🥳', '🤔', '🔥', '💯', '🎯', '🏆', '🍕'];

interface EmojiAvatarProps {
  initialEmoji?: string;
  onEmojiChange?: (emoji: string) => void;
  className?: string;
  size?: number;
  isInteractive?: boolean;
}

const EmojiAvatar: React.FC<EmojiAvatarProps> = ({
  initialEmoji,
  onEmojiChange,
  className,
  size = 40, // Default size 40px
  isInteractive = true,
}) => {
  const [currentEmoji, setCurrentEmoji] = useState(
    initialEmoji && emojis.includes(initialEmoji) ? initialEmoji : emojis[0]
  );

  useEffect(() => {
    // If initialEmoji changes from outside, update the state
    if (initialEmoji && emojis.includes(initialEmoji) && initialEmoji !== currentEmoji) {
      setCurrentEmoji(initialEmoji);
    }
  }, [initialEmoji, currentEmoji]);

  const handleClick = () => {
    if (!isInteractive) return;

    const currentIndex = emojis.indexOf(currentEmoji);
    const nextIndex = (currentIndex + 1) % emojis.length;
    const nextEmoji = emojis[nextIndex];
    setCurrentEmoji(nextEmoji);
    if (onEmojiChange) {
      onEmojiChange(nextEmoji);
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        'relative rounded-full flex items-center justify-center bg-gradient-to-br from-violet-400 to-indigo-500 overflow-hidden shadow-lg',
        isInteractive ? 'cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-150' : 'cursor-default',
        className
      )}
      style={{ width: size, height: size }}
      whileTap={isInteractive ? { scale: 0.9 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      disabled={!isInteractive}
      aria-label={isInteractive ? "Change Avatar Emoji" : "Player Avatar"}
    >
      {/* Hover highlight instead of animated shine */}
      {isInteractive && (
        <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 transition-opacity duration-200" />
      )}
      <motion.span
        key={currentEmoji} // Trigger animation on emoji change
        className="text-center select-none relative z-10" // Added z-10 to keep emoji on top
        style={{ fontSize: size * 0.6 }} // Adjust emoji size based on container size
        initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      >
        {currentEmoji}
      </motion.span>
    </motion.button>
  );
};

export default EmojiAvatar;
