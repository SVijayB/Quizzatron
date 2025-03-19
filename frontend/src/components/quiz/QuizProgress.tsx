
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";

interface QuizProgressProps {
  currentQuestion: number;
  totalQuestions: number;
  timeLeft: number;
  totalTime: number;
  totalScore: number;
}

export function QuizProgress({
  currentQuestion,
  totalQuestions,
  timeLeft,
  totalTime,
  totalScore,
}: QuizProgressProps) {
  return (
    <div className="w-full mb-12">
      <div className="flex justify-between items-center mb-2">
        <motion.span 
          className="text-3xl font-bold text-white/90"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Question {currentQuestion + 1}/{totalQuestions}
        </motion.span>
        <div className="flex items-center gap-4">
          <motion.div
            className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-xl font-bold text-white/90">{totalScore}</span>
          </motion.div>
          <motion.span 
            className="text-3xl font-bold text-white/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {timeLeft}s
          </motion.span>
        </div>
      </div>
      <Progress 
        value={(timeLeft / totalTime) * 100} 
        className="h-4 bg-white/10" 
      />
    </div>
  );
}
