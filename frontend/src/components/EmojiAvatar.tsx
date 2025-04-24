import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dices, ChevronDown } from "lucide-react";

// List of emojis to choose from
const emojis = [
  // 🐾 Animals
  "🐶", "🐱", "🐭", "🐹", "🐰", "🐇", "🦊", "🐻", "🐻‍❄️", "🐼",
  "🐨", "🐯", "🦁", "🐷", "🐮", "🐺", "🦝", "🐄", "🐐", "🐑",
  "🦙", "🫎", "🐴", "🦄", "🦓", "🦌", "🦬", "🐘", "🐪", "🦒",
  "🐒", "🐵", "🦍", "🦧", "🐿️", "🦔", "🦥", "🦦", "🦨", "🦘",
  
  // 🐦 Birds
  "🐔", "🐓", "🐣", "🐤", "🐥", "🐦", "🐧", "🕊️", "🦃", "🦅",
  "🦆", "🦢", "🦉", "🦚", "🦜", "🦩", "🦤", "🪿", "🐦‍⬛", "🐦‍🔥",

  // 🌊 Marine & Reptiles
  "🐸", "🐲", "🦖", "🐳", "🐬", "🦭", "🐡", "🦈", "🐙",

  // 🧝 People / Fantasy (light skin tone)
  "🧙🏻", "🧚🏻", "🧜🏻", "🧞‍♂️", "🧛🏻", "🧟", "🧝🏻", "🧌", "🦹🏻", "🦸🏻",
  "🧑🏻‍🎤", "🧑🏻‍🚀", "🧑🏻‍🔬", "🧑🏻‍🍳", "🧑🏻‍🎨", "🧑🏻‍🌾", "🧑🏻‍🏫",

  // 👻 Fun Stuff
  "👻", "🎃", "👽", "🤖", "💩", "🧸"
]

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
  const [dialogOpen, setDialogOpen] = useState(false);
  
  useEffect(() => {
    setEmoji(initialEmoji);
  }, [initialEmoji]);

  const handleEmojiSelect = (selectedEmoji: string) => {
    setEmoji(selectedEmoji);
    setDialogOpen(false);
    if (onChange) {
      onChange(selectedEmoji);
    }
  };

  const handleRandomEmoji = () => {
    const newEmoji = getRandomEmoji();
    handleEmojiSelect(newEmoji);
  };

  const containerSize = `${size}px`;
  const fontSize = `${size * 0.6}px`;

  // Non-interactive version
  if (!isInteractive) {
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg ${className}`}
        style={{ width: containerSize, height: containerSize }}
      >
        <AnimatePresence mode="wait">
          <motion.span 
            key={emoji}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
            className="text-white select-none" 
            style={{ fontSize }}
          >
            {emoji}
          </motion.span>
        </AnimatePresence>
      </div>
    );
  }

  // Interactive version with Dialog and arrow button
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <div className="relative">
        <DialogTrigger asChild>
          <div
            className={`group relative flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 cursor-pointer overflow-hidden shadow-lg hover:shadow-indigo-500/25 transition-shadow ${className}`}
            style={{ width: containerSize, height: containerSize }}
          >
            <AnimatePresence mode="wait">
              <motion.span 
                key={emoji}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                className="text-white select-none" 
                style={{ fontSize }}
              >
                {emoji}
              </motion.span>
            </AnimatePresence>
            
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-full" />
          </div>
        </DialogTrigger>

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="absolute -bottom-1 -right-1 p-1 rounded-full bg-violet-500 hover:bg-violet-600 text-white shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 z-10"
          style={{ 
            width: `${size * 0.4}px`, 
            height: `${size * 0.4}px`,
            minWidth: '20px',
            minHeight: '20px'
          }}
          aria-label="Change emoji"
        >
          <ChevronDown className="w-full h-full" />
        </button>
      </div>

      <DialogContent className="w-[280px] p-0 bg-gradient-to-b from-indigo-950 to-violet-950 border-indigo-800/50 shadow-xl z-50">
        <div className="p-3 space-y-3">
          <ScrollArea className="h-[240px] rounded-md px-1">
            <div className="grid grid-cols-6 gap-1">
              {emojis.map((emojiOption, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleEmojiSelect(emojiOption)}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 
                    ${emoji === emojiOption 
                      ? 'bg-indigo-600 ring-2 ring-indigo-400 shadow-lg' 
                      : 'hover:bg-indigo-800/50'
                    }`}
                >
                  <span className="text-xl select-none">{emojiOption}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
          
          <button 
            type="button"
            onClick={handleRandomEmoji}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-indigo-500/25"
          >
            <Dices className="w-4 h-4" />
            Random
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmojiAvatar;
