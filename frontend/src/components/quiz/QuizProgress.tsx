
import { Progress } from "@/components/ui/progress";

export interface QuizProgressProps {
  currentQuestion: number;
  totalQuestions: number;
  timeLeft: number;
  totalTime: number;
  totalScore: number;
}

export const QuizProgress: React.FC<QuizProgressProps> = ({
  currentQuestion,
  totalQuestions,
  timeLeft,
  totalTime,
  totalScore,
}) => {
  const progressValue = (currentQuestion / totalQuestions) * 100;
  const timeProgress = (timeLeft / totalTime) * 100;

  return (
    <div className="space-y-4 mt-6">
      <div className="flex justify-between text-sm text-white/70">
        <span>Question {currentQuestion} of {totalQuestions}</span>
        <span>Score: {totalScore}</span>
      </div>
      <Progress value={progressValue} className="h-2" />
      <div className="flex justify-between text-sm text-white/70">
        <span>Time Left: {Math.ceil(timeLeft)}s</span>
        <span>{Math.round(timeProgress)}%</span>
      </div>
      <Progress value={timeProgress} className="h-2" />
    </div>
  );
};
