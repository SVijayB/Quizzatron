
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, X, Award, ArrowRight } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  currentQuestion: number;
}

interface QuizScoreboardProps {
  players: Player[];
  correctAnswer: string;
  userAnswer: string;
  onNextQuestion: () => void;
}

const QuizScoreboard: React.FC<QuizScoreboardProps> = ({
  players,
  correctAnswer,
  userAnswer,
  onNextQuestion,
}) => {
  // Sort players by score (highest first)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  // Check if the user's answer is correct
  const isCorrect = userAnswer === correctAnswer;

  return (
    <motion.div
      className="quiz-container max-w-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block"
        >
          {isCorrect ? (
            <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-500" />
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
              <X className="w-8 h-8 text-red-500" />
            </div>
          )}
        </motion.div>
        
        <h2 className="text-2xl font-bold text-white mt-4">
          {isCorrect ? "Correct!" : "Incorrect!"}
        </h2>
        
        <div className="mt-2 p-4 bg-white/5 rounded-lg">
          <p className="text-gray-300 mb-2">Correct answer:</p>
          <p className="text-lg font-medium text-green-400">{correctAnswer}</p>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl p-4 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Award className="w-5 h-5 mr-2 text-yellow-400" />
          Current Standings
        </h3>
        
        <div className="space-y-3">
          {sortedPlayers.map((player, index) => (
            <div 
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                index === 0 ? "bg-yellow-500/20 border border-yellow-500/30" : "bg-white/5"
              }`}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 flex items-center justify-center font-bold text-gray-400">
                  {index + 1}
                </div>
                <div className="w-10 h-10 flex items-center justify-center text-xl rounded-full bg-white/10">
                  {player.avatar}
                </div>
                <span className="ml-3 font-medium text-white">{player.name}</span>
              </div>
              <span className="text-lg font-bold text-indigo-400">{player.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={onNextQuestion}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Next Question
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export default QuizScoreboard;
