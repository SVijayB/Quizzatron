import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const EMOJI_GRID = [
  ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'],
  ['🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵'],
  ['🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🐣'],
  ['🐥', '🦆', '🦅', '🦉', '🦇', '👽', '🤖'],
];

interface EmojiAvatarProps {
  initialEmoji?: string;
  size?: number;
  onEmojiChange?: (emoji: string) => void;
  isInteractive?: boolean;
  className?: string;
}

const EmojiAvatar = ({ 
  initialEmoji = '😀', 
  size = 40, 
  onEmojiChange,
  isInteractive = true,
  className = '',
}: EmojiAvatarProps) => {
  const [selectedEmoji, setSelectedEmoji] = useState(initialEmoji);
  const [isOpen, setIsOpen] = useState(false);
  
  // When initialEmoji prop changes, update the selectedEmoji state
  useEffect(() => {
    if (initialEmoji) {
      setSelectedEmoji(initialEmoji);
      
      // IMPORTANT: Update global state when auto-generating a random emoji
      // This ensures the emoji shown is the same one saved to state
      if (!localStorage.getItem('playerEmoji') && initialEmoji !== '😀') {
        localStorage.setItem('playerEmoji', initialEmoji);
        if (onEmojiChange) {
          onEmojiChange(initialEmoji);
        }
      }
    }
  }, [initialEmoji, onEmojiChange]);

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setIsOpen(false);
    if (onEmojiChange) {
      onEmojiChange(emoji);
    }
  };

  if (!isInteractive) {
    return (
      <div
        className={`emoji-avatar ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${size * 0.6}px`,
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '100%',
        }}
      >
        {selectedEmoji}
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`emoji-avatar-button ${className}`}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${size * 0.6}px`,
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '100%',
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={() => {
            const button = document.querySelector('.emoji-avatar-button');
            if (button) {
              button.classList.add('pulse');
            }
          }}
          onMouseLeave={() => {
            const button = document.querySelector('.emoji-avatar-button');
            if (button) {
              button.classList.remove('pulse');
            }
          }}
          onClick={() => setIsOpen(true)}
        >
          {selectedEmoji}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="p-3 bg-violet-950 text-white border-b border-violet-800">
          <h3 className="font-medium">Select an avatar</h3>
        </div>
        <div className="bg-violet-900 text-center p-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {EMOJI_GRID.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center mb-2">
              {row.map((emoji, emojiIndex) => (
                <button
                  key={`${rowIndex}-${emojiIndex}`}
                  className="hover:bg-violet-800 rounded-md transition-colors w-8 h-8 flex items-center justify-center mx-0.5"
                  onClick={() => handleEmojiSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiAvatar;
