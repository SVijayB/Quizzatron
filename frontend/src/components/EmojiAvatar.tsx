import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dices, ChevronDown, X } from "lucide-react";

// List of emojis to choose from
const emojis = [
  // 🐾 Animals
  "🐶", "🐱", "🐭", "🐹", "🐰", "🐇", "🦊", "🐻", "🐻‍❄️", "🐼",
  "🐨", "🐯", "🦁", "🐷", "🐮", "🐺", "🦝", "🐄", "🐐", "🐑",
  "🫎", "🐴", "🦄", "🦓", "🦌", "🦬", "🐘", "🐪", "🦒", "🦘",
  "🐒", "🐵", "🦍", "🦧", "🐿️", "🦔", "🦥", "🦦", "🦨", 
  
  // 🐦 Birds
  "🐔", "🐓", "🐣", "🐤", "🐥", "🐦", "🐧", "🕊️", "🦃", "🦅",
  "🦆", "🦢", "🦉", "🦚", "🦜", "🦩", "🦤", "🪿", "🐦‍⬛", "🐦‍🔥",

  // 🌊 Marine & Reptiles
  "🐸", "🐲", "🦖", "🐳", "🐬", "🦭", "🐡", "🦈", "🐙",

  // 🧝 People / Fantasy
  "🧙🏻", "🧚🏻", "🧜🏻", "🧞‍♂️", "🧛🏻", "🧟", "🧝🏻", "🧌", "🦹🏻", "🦸🏻",
  "🧑🏻‍🎤", "🧑🏻‍🚀", "🧑🏻‍🔬", "🧑🏻‍🍳", "🧑🏻‍🎨", "🧑🏻‍🌾", "🧑🏻‍🏫",

  // 👻 Fun Stuff
  "👻", "👽", "🤖", "💩", "🧸"
]

// Group emojis into categories for tabbed navigation
const emojiCategories = [
  { name: "Animals", emojis: emojis.slice(0, 39) },
  { name: "Birds", emojis: emojis.slice(39, 59) },
  { name: "Marine", emojis: emojis.slice(59, 68) },
  { name: "Fantasy", emojis: emojis.slice(68) },
];

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
  const [activeCategory, setActiveCategory] = useState(0);
  
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

  // Animation variants
  const dropdownVariants = {
    hidden: { opacity: 0, scale: 0.9, y: -10 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 20 
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9, 
      y: -10,
      transition: { duration: 0.2 }
    }
  };

  const emojiButtonVariants = {
    hover: { scale: 1.1, transition: { type: "spring", stiffness: 400, damping: 10 } },
    tap: { scale: 0.95 }
  };

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
            
            <motion.div 
              className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-full"
              whileHover={{ scale: 1.05 }} 
            />
          </div>
        </DialogTrigger>

        <motion.button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="absolute -bottom-1 -right-1 p-1 rounded-full bg-violet-500 hover:bg-violet-600 text-white shadow-lg z-10"
          style={{ 
            width: `${size * 0.4}px`, 
            height: `${size * 0.4}px`,
            minWidth: '20px',
            minHeight: '20px'
          }}
          aria-label="Change emoji"
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronDown className="w-full h-full" />
        </motion.button>
      </div>

      <DialogContent className="p-0 border-none shadow-2xl bg-transparent w-[320px]">
        <motion.div 
          className="relative rounded-xl overflow-hidden backdrop-blur-xl"
          variants={dropdownVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Semi-transparent background with glassmorphism effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 to-violet-950/90 z-0" />
          <div className="absolute inset-0 bg-white/5 z-0" />
          
          {/* Content container with glow effect */}
          <div className="relative z-10 p-3 space-y-3 border border-indigo-500/20 rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            {/* Close button - updated positioning and styling */}
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-white/90">Choose Emoji</h3>
              <motion.button
                onClick={() => setDialogOpen(false)}
                className="flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors w-6 h-6"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close"
              >
                <X size={14} className="text-white/80" />
              </motion.button>
            </div>
            
            {/* Category tabs */}
            <div className="flex space-x-1 overflow-x-auto no-scrollbar">
              {emojiCategories.map((category, index) => (
                <motion.button
                  key={category.name}
                  onClick={() => setActiveCategory(index)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    activeCategory === index
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {category.name}
                </motion.button>
              ))}
            </div>

            {/* Added custom CSS to hide scrollbars */}
            <style jsx global>{`
              .no-scrollbar::-webkit-scrollbar {
                display: none;
              }
              .no-scrollbar {
                -ms-overflow-style: none;  /* IE and Edge */
                scrollbar-width: none;  /* Firefox */
              }
              .custom-scrollbar::-webkit-scrollbar {
                display: none;
              }
              .custom-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>

            <ScrollArea className="h-[240px] rounded-md px-1 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-6 gap-1.5"
                >
                  {emojiCategories[activeCategory].emojis.map((emojiOption, index) => (
                    <motion.button
                      key={index}
                      type="button"
                      onClick={() => handleEmojiSelect(emojiOption)}
                      className={`w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-200 ${
                        emoji === emojiOption 
                          ? 'bg-indigo-600/80 ring-2 ring-indigo-400/70 shadow-lg shadow-indigo-500/20' 
                          : 'hover:bg-indigo-600/40 bg-white/5'
                      }`}
                      variants={emojiButtonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      animate={emoji === emojiOption ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      <span className="text-xl select-none">{emojiOption}</span>
                      {emoji === emojiOption && (
                        <motion.div 
                          className="absolute inset-0 rounded-lg ring-2 ring-indigo-400"
                          initial={{ opacity: 0, scale: 1.2 }}
                          animate={{ opacity: 1, scale: 1 }}
                        />
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              </AnimatePresence>
            </ScrollArea>
            
            <motion.button 
              type="button"
              onClick={handleRandomEmoji}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-indigo-600/90 to-violet-600/90 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium shadow-lg hover:shadow-indigo-500/25 border border-indigo-500/30"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Dices className="w-4 h-4" />
              <span>Random</span>
            </motion.button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default EmojiAvatar;
