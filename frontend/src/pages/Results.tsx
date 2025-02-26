
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Trophy, Home, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";

interface QuizResult {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  score: number;
}

const Results = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<QuizResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);

  useEffect(() => {
    const resultsData = localStorage.getItem("quizResults");
    const scoreData = localStorage.getItem("totalScore");
    
    if (!resultsData) {
      navigate("/");
      return;
    }

    try {
      const parsedResults = JSON.parse(resultsData);
      if (!Array.isArray(parsedResults)) {
        throw new Error("Invalid results format");
      }

      const validResults = parsedResults.map((result: any) => ({
        question: result.question || "Unknown Question",
        userAnswer: result.userAnswer || "Unanswered",
        correctAnswer: result.correctAnswer || "Unknown",
        isCorrect: Boolean(result.isCorrect),
        score: Number(result.score) || 0
      }));

      setResults(validResults);
      setTotalScore(scoreData ? parseInt(scoreData) : 0);

      // Show confetti for good scores
      const correctAnswers = validResults.filter(r => r.isCorrect).length;
      const percentage = Math.round((correctAnswers / validResults.length) * 100);
      if (percentage >= 70) {
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
  }, [navigate]);

  if (!results.length) return null;

  const correctAnswers = results.filter((r) => r.isCorrect).length;
  const totalQuestions = results.length;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100) || 0;

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return "Outstanding!";
    if (percentage >= 80) return "Excellent!";
    if (percentage >= 70) return "Great Job!";
    if (percentage >= 60) return "Good Effort!";
    return "Keep Practicing!";
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1a1a2e]">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f3ed0,#8b5cf6)] opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#1a1a2e_100%)]" />
        <div className="absolute inset-0 bg-grid-white/[0.02]" />
      </div>

      <div className="relative z-10 container mx-auto py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-8"
        >
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
            <CardHeader className="text-center pb-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-indigo-500/10" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="relative mb-4 flex flex-col items-center gap-2"
              >
                <Trophy className="w-20 h-20 text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]" />
                <div className="text-2xl font-bold text-yellow-400">Total Score: {totalScore}</div>
              </motion.div>
              <CardTitle className="relative text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                {getGrade(percentage)}
              </CardTitle>
              <div className="relative mt-4">
                <div className="text-6xl font-bold text-white flex items-center justify-center gap-2">
                  {percentage}%
                  <Sparkles className="w-8 h-8 text-violet-400" />
                </div>
                <p className="text-white/70 mt-2">
                  {correctAnswers} out of {totalQuestions} correct
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <AnimatePresence>
                {results.map((result, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 transition-all duration-200 hover:bg-white/10"
                  >
                    <div className="flex items-start gap-4">
                      {result.isCorrect ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
                      )}
                      <div className="space-y-2 flex-1">
                        <p className="text-white/90">{result.question}</p>
                        <div className="text-sm space-y-1">
                          <p className="text-white/70">
                            Your answer:{" "}
                            <span className={result.isCorrect ? "text-green-400" : "text-red-400"}>
                              {result.userAnswer}
                            </span>
                            {result.isCorrect && (
                              <span className="ml-2 text-yellow-400">
                                +{result.score} points
                              </span>
                            )}
                          </p>
                          {!result.isCorrect && (
                            <p className="text-white/70">
                              Correct answer:{" "}
                              <span className="text-green-400">{result.correctAnswer}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </CardContent>
          </Card>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center"
          >
            <Button
              onClick={() => navigate("/")}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)] backdrop-blur-sm px-8 py-6 text-lg"
            >
              <Home className="mr-2 h-5 w-5" /> Try Another Quiz
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Results;
