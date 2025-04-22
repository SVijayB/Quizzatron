
import { cn } from "@/lib/utils";

export interface QuizOptionsProps {
  options: string[];
  selectedAnswer: string;
  isRevealed: boolean;
  correctAnswer: string;
  onSelectAnswer: (answer: string) => void;
}

export const QuizOptions: React.FC<QuizOptionsProps> = ({
  options,
  selectedAnswer,
  isRevealed,
  correctAnswer,
  onSelectAnswer,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {options.map((option, index) => {
        const isSelected = selectedAnswer === option;
        const isCorrect = option === correctAnswer;
        
        return (
          <button
            key={index}
            onClick={() => !isRevealed && onSelectAnswer(option)}
            disabled={isRevealed}
            className={cn(
              "p-4 rounded-lg text-left transition-all",
              "hover:bg-white/10",
              "disabled:cursor-not-allowed",
              isRevealed && isSelected && !isCorrect && "bg-red-500/20 border-red-500",
              isRevealed && isCorrect && "bg-green-500/20 border-green-500",
              !isRevealed && isSelected && "bg-white/10 border-white",
              "border",
              isRevealed ? "border-opacity-100" : "border-opacity-10"
            )}
          >
            <span className="text-white">{option}</span>
          </button>
        );
      })}
    </div>
  );
};
