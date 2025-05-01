
import React from 'react';
import { motion } from 'framer-motion';
import { QuizQuestion as QuizQuestionComponent } from './quiz/QuizQuestion';
import { QuizOptions } from './quiz/QuizOptions';
import { QuizProgress } from './quiz/QuizProgress';

interface QuizQuestionProps {
  question: {
    question: string;
    options: string[];
    correct_answer: string;
    image?: string;
  };
  userAnswer: string;
  answered: boolean;
  answerAnimation: boolean;
  countdown: number;
  handleAnswer: (answer: string) => void;
}

const QuizQuestion: React.FC<QuizQuestionProps> = ({
  question,
  userAnswer,
  answered,
  answerAnimation,
  countdown,
  handleAnswer,
}) => {
  // Calculate timer percentage
  const timerPercentage = (countdown / 15) * 100;
  
  // For QuizProgress component
  const totalTime = 15; // Total time in seconds
  const timeLeft = Math.max(0, Math.floor(countdown)); // Time left in seconds
  const totalScore = 0; // We don't have this information in this component

  return (
    <motion.div
      className="flex flex-col space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Timer Bar */}
      <div className="quiz-timer">
        <div className="flex justify-between text-gray-300 text-sm">
          <span>Time Remaining</span>
          <span>{timeLeft}s</span>
        </div>
        <div className="quiz-timer-bar">
          <motion.div
            className="quiz-timer-progress"
            style={{ width: `${Math.max(0, timerPercentage)}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <QuizQuestionComponent 
        question={question.question} 
        image={question.image}
      />

      {/* Options */}
      <QuizOptions
        options={question.options}
        selectedAnswer={userAnswer}
        isRevealed={answered}
        correctAnswer={question.correct_answer}
        onSelectAnswer={handleAnswer}
      />

      {/* Progress and Stats */}
      <QuizProgress 
        currentQuestion={1} 
        totalQuestions={10}
        timeLeft={timeLeft}
        totalTime={totalTime}
        totalScore={totalScore}
      />
    </motion.div>
  );
};

export default QuizQuestion;
