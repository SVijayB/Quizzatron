import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Trophy, Home, Sparkles, Clock, Users, ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import EmojiAvatar from "@/components/EmojiAvatar";

interface QuizResult {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  score: number;
  timeRemaining?: number;
}

interface PlayerScore {
  name: string;
  avatar: string;
  score: number;
  answeredQuestions: number;
  rank?: number;
}

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [results, setResults] = useState<QuizResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [playerAvatar, setPlayerAvatar] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  
  useEffect(() => {
    // Determine if we're coming from a multiplayer game
    const isFromMultiplayer = location.pathname.includes('multiplayer');
    setIsMultiplayer(isFromMultiplayer);
    
    // Load the appropriate results
    const resultsData = localStorage.getItem("quizResults");
    const scoreData = localStorage.getItem("totalScore");
    const playerScoresData = localStorage.getItem("playerScores");
    
    if (!resultsData) {
      navigate("/");
      return;
    }

    try {
      // Parse and validate quiz results
      const parsedResults = JSON.parse(resultsData);
      if (!Array.isArray(parsedResults)) {
        throw new Error("Invalid results format");
      }

      // Create a fresh array from the parsed results to ensure proper mapping
      const validResults = [...parsedResults].map((result: any) => ({
        question: result.question || "Unknown Question",
        userAnswer: result.userAnswer || "Unanswered",
        correctAnswer: result.correctAnswer || "Unknown",
        isCorrect: Boolean(result.isCorrect),
        score: Number(result.score) || 0,
        timeRemaining: result.timeRemaining || 0
      }));

      console.log("Valid results array length:", validResults.length);
      console.log("Last result item:", validResults[validResults.length - 1]);
      
      // Set the results array immediately to avoid race conditions
      setResults(validResults);
      setTotalScore(scoreData ? parseInt(scoreData) : 0);

      // For multiplayer games, load and sort player scores
      if (isFromMultiplayer && playerScoresData) {
        const parsedScores: PlayerScore[] = JSON.parse(playerScoresData);
        
        // Sort scores (highest to lowest) and assign ranks
        const sortedScores = [...parsedScores].sort((a, b) => b.score - a.score);
        const rankedScores = sortedScores.map((player, idx) => ({
          ...player,
          rank: idx + 1
        }));
        
        setPlayerScores(rankedScores);
        setPlayerName(localStorage.getItem("playerName") || "Player");
        setPlayerAvatar(localStorage.getItem("playerAvatar") || "👤");
      }

      // Show confetti for good scores
      const correctAnswers = validResults.filter(r => r.isCorrect).length;
      const percentage = Math.round((correctAnswers / validResults.length) * 100);
      if (percentage >= 70) {
        setShowConfetti(true);
        
        // Launch celebration confetti
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        function randomInRange(min: number, max: number) {
          return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }
          
          const particleCount = 50 * (timeLeft / duration);
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          });
        }, 250);

        return () => clearInterval(interval);
      }
    } catch (error) {
      console.error("Error loading results:", error);
      navigate("/");
    }
  }, [navigate, location.pathname]);

  // Explicitly create a function for home navigation
  const goToHome = () => {
    // Clear any quiz-related data from localStorage to prevent future issues
    localStorage.removeItem("quizResults");
    localStorage.removeItem("quizData");
    // Navigate to home
    navigate("/", { replace: true });
  };

  if (!results.length) return null;

  const correctAnswers = results.filter((r) => r.isCorrect).length;
  const totalQuestions = results.length;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100) || 0;
  
  // Fix average time calculation - calculate time used (10 - timeRemaining) instead of time left
  const QUESTION_TIME = 10; // Same value as QUESTION_TIMEOUT in Quiz.tsx
  const averageTimeUsed = results.reduce((acc, curr) => 
    acc + (QUESTION_TIME - (curr.timeRemaining || 0)), 0) / results.length;

  // Performance grade based on percentage
  const getGrade = (percentage: number) => {
    if (percentage >= 90) return "Outstanding!";
    if (percentage >= 80) return "Excellent!";
    if (percentage >= 70) return "Great Job!";
    if (percentage >= 60) return "Good Effort!";
    return "Keep Practicing!";
  };

  // Badge based on performance
  const getBadge = (percentage: number) => {
    if (percentage >= 90) return "🏆 Quiz Master";
    if (percentage >= 80) return "🥇 Expert";
    if (percentage >= 70) return "🥈 Proficient";
    if (percentage >= 50) return "🥉 Novice";
    return "🎯 Beginner";
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-800">
      {/* Background effects */}
      <div className="absolute inset-0">
        {showConfetti && (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f3ed0,#8b5cf6)] opacity-20" />
            <div className="absolute w-full h-full">
              {Array.from({ length: 15 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-white/20 backdrop-blur-3xl"
                  style={{
                    width: `${Math.random() * 150 + 50}px`,
                    height: `${Math.random() * 150 + 50}px`,
                  }}
                  animate={{
                    x: [
                      Math.random() * window.innerWidth,
                      Math.random() * window.innerWidth,
                    ],
                    y: [
                      Math.random() * window.innerHeight,
                      Math.random() * window.innerHeight,
                    ],
                    opacity: [0.1, 0.3, 0.1],
                  }}
                  transition={{
                    duration: 15 + Math.random() * 15,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative z-10 container mx-auto py-8 md:py-12 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Back button */}
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={goToHome}
              className="text-white bg-white/10 hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
            </Button>
          </div>
          
          {/* Main results panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header & Score Summary */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-violet-600/20 to-indigo-600/20 p-6 md:p-8 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-4 flex justify-center"
                >
                  {isMultiplayer ? (
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <span className="text-4xl">{playerAvatar}</span>
                      </div>
                      {playerScores.find(p => p.name === playerName)?.rank === 1 && (
                        <div className="absolute -top-3 -right-3 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-amber-900" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                      <Trophy className="w-12 h-12 text-amber-100" />
                    </div>
                  )}
                </motion.div>
                
                <motion.h1 
                  className="text-3xl md:text-4xl font-bold text-white mb-2"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {getGrade(percentage)}
                </motion.h1>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <p className="text-white/70 text-lg mb-3">{getBadge(percentage)}</p>
                  
                  <div className="flex flex-wrap justify-center gap-3">
                    <div className="bg-white/10 rounded-lg px-4 py-2 inline-flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      <span className="text-lg font-bold text-white">{totalScore} pts</span>
                    </div>
                    
                    <div className="bg-white/10 rounded-lg px-4 py-2 inline-flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="text-white">
                        <span className="font-bold">{percentage}%</span> 
                        <span className="text-white/70 text-sm"> ({correctAnswers}/{totalQuestions})</span>
                      </span>
                    </div>
                    
                    <div className="bg-white/10 rounded-lg px-4 py-2 inline-flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-400" />
                      <span className="text-white text-sm">Avg. Time: {averageTimeUsed.toFixed(1)}s</span>
                    </div>
                  </div>
                </motion.div>
              </div>
              
              {/* Multiplayer Leaderboard (if multiplayer) */}
              {isMultiplayer && (
                <div className="px-6 py-4 border-t border-white/10">
                  <h3 className="text-white/80 text-sm font-medium mb-3 flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Leaderboard
                  </h3>
                  
                  <div className="space-y-2">
                    {playerScores.map((player, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + idx * 0.1 }}
                        className={`flex items-center p-2 rounded-lg ${
                          player.name === playerName 
                            ? "bg-violet-600/30 border border-violet-500/30" 
                            : "bg-white/5"
                        }`}
                      >
                        <div className="w-8 text-center font-bold text-white/70">#{player.rank}</div>
                        <div className="w-8 h-8 flex items-center justify-center">
                          <span>{player.avatar}</span>
                        </div>
                        <div className="ml-3 flex-1 text-white">{player.name}</div>
                        <div className="font-bold text-amber-400">{player.score}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Question Results */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-violet-400" />
                Question Details
              </h2>
              
              <div className="space-y-4">
                {results.map((result, index) => (
                  <motion.div
                    key={`result-${index}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`
                      rounded-xl p-4 transition-all duration-200
                      ${result.isCorrect 
                        ? "bg-green-950/30 border border-green-700/40" 
                        : "bg-red-950/30 border border-red-700/40"
                      }
                    `}
                  >
                    <div className="flex gap-3">
                      <div className="mt-1">
                        {result.isCorrect ? (
                          <div className="w-6 h-6 rounded-full bg-green-600/50 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-green-300" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-red-600/50 flex items-center justify-center">
                            <XCircle className="w-4 h-4 text-red-300" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <p className="text-white font-medium" dangerouslySetInnerHTML={{ __html: result.question }} />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div className={`p-2 rounded-lg ${
                            result.isCorrect 
                              ? "bg-green-800/30 text-green-300" 
                              : "bg-red-800/30 text-red-300"
                          }`}>
                            <span className="text-white/70">Your answer: </span>
                            {result.userAnswer}
                          </div>
                          
                          {!result.isCorrect && (
                            <div className="p-2 rounded-lg bg-white/10 text-green-300">
                              <span className="text-white/70">Correct answer: </span>
                              {result.correctAnswer}
                            </div>
                          )}
                        </div>
                        
                        {result.score > 0 && (
                          <div className="flex items-center gap-1 text-amber-400 text-sm">
                            <Trophy className="w-3 h-3" />
                            <span>+{result.score} points</span>
                            
                            {result.timeRemaining !== undefined && (
                              <span className="text-white/50 ml-2">
                                (answered with {result.timeRemaining.toFixed(1)}s left)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row justify-center gap-4 pt-4"
            >
              <Button
                onClick={goToHome}
                size="lg"
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-none shadow-lg shadow-purple-900/30"
              >
                <Home className="mr-2 h-5 w-5" />
                Return to Home
              </Button>
              
              <Button
                onClick={() => navigate("/categories")}
                variant="outline"
                size="lg"
                className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border-white/20"
              >
                Try Another Quiz
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Results;
