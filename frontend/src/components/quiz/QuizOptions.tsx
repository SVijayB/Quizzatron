
import { motion } from "framer-motion";

interface QuizOptionsProps {
  options: string[];
  selectedAnswer: string | null;
  isRevealed: boolean;
  correctAnswer: string;
  onSelectAnswer: (option: string) => void;
}

export function QuizOptions({
  options,
  selectedAnswer,
  isRevealed,
  correctAnswer,
  onSelectAnswer,
}: QuizOptionsProps) {
  return (
    <div className="grid grid-cols-2 gap-6 mb-8">
      {options.map((option, index) => {
        const optionLetter = option.charAt(0);
        const isSelected = selectedAnswer === optionLetter;
        const isCorrect = optionLetter === correctAnswer;
        
        let backgroundColor = "bg-white/5";
        let borderColor = "border-white/10";
        let ringEffect = "";
        
        if (isRevealed) {
          if (isCorrect) {
            backgroundColor = "bg-green-500/20";
            borderColor = "border-green-500";
            ringEffect = "ring-4 ring-green-500/30";
          } else if (isSelected) {
            backgroundColor = "bg-red-500/20";
            borderColor = "border-red-500";
            ringEffect = "ring-4 ring-red-500/30";
          }
        } else if (isSelected) {
          backgroundColor = "bg-violet-500/20";
          borderColor = "border-violet-500";
          ringEffect = "ring-4 ring-violet-500/30";
        }

        const colors = [
          "from-blue-400/20",
          "from-emerald-400/20",
          "from-orange-400/20",
          "from-pink-400/20"
        ];

        return (
          <motion.button
            key={option}
            onClick={() => onSelectAnswer(optionLetter)}
            className={`w-full p-8 rounded-xl text-left transition-all duration-300 border-2 ${backgroundColor} ${borderColor} ${ringEffect} backdrop-blur-sm bg-gradient-to-br ${colors[index]} to-transparent hover:bg-white/10 hover:scale-[1.02] shadow-lg`}
            disabled={selectedAnswer !== null || isRevealed}
            initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <span className="text-xl text-white/90">{option}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
