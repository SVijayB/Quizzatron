import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, ArrowLeft, CheckCircle2, XCircle, RefreshCw, Clock, Users } from "lucide-react";
import confetti from "canvas-confetti";
import QuizLogo from "@/components/QuizLogo";
import CursorEffect from "@/components/CursorEffect";
import { useMultiplayer } from "@/contexts/MultiplayerContext";

interface MultiplayerResult {
  id?: string;
  player_id?: string;
  name: string;
  avatar: string;
  score: number;
  correctAnswers?: number;
  correct_answers?: number;
  totalQuestions?: number;
  total_questions?: number;
  incorrectAnswers?: number;
  incorrect_answers?: number;
  answers?: {
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    score: number;
    timeTaken?: number;
  }[];
  rank?: number;
}

interface ResultsData {
  results: MultiplayerResult[];
  settings: {
    numQuestions: number;
    timePerQuestion: number;
    difficulty: string;
    topic: string | null;
    categories?: string[];
    allowSkipping?: boolean;
    model?: string;
  };
  quiz_id: string;
}

const MultiplayerResults = () => {
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [results, setResults] = useState<MultiplayerResult[]>([]);
  const [settings, setSettings] = useState({
    numQuestions: 10,
    timePerQuestion: 15,
    difficulty: "medium",
    topic: null as string | null,
    categories: [] as string[],
    allowSkipping: false,
    model: "default"
  });
  const [isLoading, setIsLoading] = useState(true);
  const [quizId, setQuizId] = useState<string>("");
  const { setGameSettings, setPlayers } = useMultiplayer();

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const storedResults = localStorage.getItem(`quiz_results_${lobbyCode}`);
        if (storedResults) {
          const parsedData = JSON.parse(storedResults);
          console.log("Loaded multiplayer results:", parsedData);
          
          // Process the results data
          if (parsedData.players) {
            setResults(parsedData.players.map((player: any) => ({
              id: player.id,
              name: player.name,
              avatar: player.avatar || "👤",
              score: player.score || 0,
              correctAnswers: player.correctAnswers || player.correct_answers || 0,
              totalQuestions: player.totalQuestions || player.total_questions || parsedData.totalQuestions || 10,
              answers: player.answers || []
            })));
            
            // Also capture any game settings if available
            if (parsedData.settings) {
              setSettings(parsedData.settings);
            }
          } else if (Array.isArray(parsedData)) {
            setResults(parsedData.map((player: any) => ({
              id: player.id,
              name: player.name,
              avatar: player.avatar || "👤",
              score: player.score || 0,
              correctAnswers: player.correctAnswers || player.correct_answers || 0,
              totalQuestions: player.totalQuestions || player.total_questions || 10,
              answers: player.answers || []
            })));
          }
          
          // Show confetti effect for celebration
          setTimeout(() => {
            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

            const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

            const interval: any = setInterval(() => {
              const timeLeft = animationEnd - Date.now();
              if (timeLeft <= 0) {
                return clearInterval(interval);
              }
              
              const particleCount = 50 * (timeLeft / duration);
              
              // Trigger confetti from both sides
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
          }, 500);
        } else {
          toast({
            title: "No Results Found",
            description: "Results could not be loaded. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching results:", error);
        toast({
          title: "Error",
          description: "Failed to load results.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [lobbyCode, toast]);

  const handleReturnToLobby = () => {
    setGameSettings({
      numQuestions: 10,
      timePerQuestion: 15,
      difficulty: "medium",
      topic: null,
      categories: [],
      allowSkipping: false,
      model: "gemini",
      includeImages: false
    });
    setPlayers([]);
    navigate("/multiplayer");
  };

  // Calculate average time taken for a player
  const calculateAverageTime = (player: MultiplayerResult) => {
    // If player has no answers array or it's empty, return a default value
    if (!player.answers || player.answers.length === 0) {
      return (settings.timePerQuestion / 2).toFixed(1);
    }
    
    // Filter for only correct answers if we're calculating for the winner
    const correctAnswersArray = player.answers.filter(answer => answer.isCorrect);
    
    if (correctAnswersArray.length === 0) {
      return (settings.timePerQuestion / 2).toFixed(1);
    }
    
    // Calculate total time taken for all questions from the player's answers
    let totalTimeTaken = 0;
    let answersWithTime = 0;
    
    // First try to use the explicit timeTaken property if available
    correctAnswersArray.forEach(answer => {
      if (answer.hasOwnProperty('timeTaken') && typeof answer.timeTaken === 'number') {
        totalTimeTaken += answer.timeTaken;
        answersWithTime++;
      }
    });
    
    if (answersWithTime > 0) {
      return (totalTimeTaken / answersWithTime).toFixed(1);
    }
    
    // If no timeTaken available, calculate based on the time per question and scores
    // For correct answers, score = remaining time, so timeTaken = timePerQuestion - score
    let totalTimeEstimated = 0;
    correctAnswersArray.forEach(answer => {
      // Estimated time taken = total time - score (remaining time)
      const estimatedTime = settings.timePerQuestion - (answer.score || 0);
      totalTimeEstimated += estimatedTime > 0 ? estimatedTime : settings.timePerQuestion / 2;
    });
    
    return (totalTimeEstimated / correctAnswersArray.length).toFixed(1);
  };

  const sortedResults = [...results].sort((a, b) => b.score - a.score);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1a1a2e]">
      <CursorEffect />

      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f3ed0,#8b5cf6)] opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#1a1a2e_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,#4f3ed0,transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_0%_300px,#8b5cf6,transparent)]" />
        <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 z-10">
        <Button
          onClick={() => navigate("/multiplayer")}
          variant="ghost"
          className="absolute top-4 left-4 text-white hover:bg-white/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Multiplayer
        </Button>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full max-w-2xl"
        >
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center mb-8"
          >
            <motion.div
              animate={{
                y: [0, -10, 0],
                rotate: [0, -5, 0, 5, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                repeatType: "mirror",
              }}
            >
              <QuizLogo size={60} color="white" className="mr-2" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-white">
                Multiplayer Results
              </h1>
              <div className="flex items-center gap-1 text-white/70">
                <Users className="h-3.5 w-3.5 text-purple-300" />
                <p>See how you stack up against your friends!</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)] overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-bl from-violet-500/30 via-transparent to-transparent w-40 h-40 rounded-bl-full"></div>

              <CardHeader className="pb-4 relative z-10">
                <CardTitle className="text-2xl text-white flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                  Final Standings
                </CardTitle>
                <CardDescription className="text-white/70">
                  Congratulations to the winners!
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 relative z-10">
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <RefreshCw className="animate-spin h-6 w-6 text-white" />
                    <span className="ml-2 text-white">Loading Results...</span>
                  </div>
                ) : (
                  <>
                    {/* Player Rankings */}
                    <div className="space-y-3">
                      <h3 className="text-white font-medium text-lg mb-2">Player Rankings</h3>
                      {sortedResults.map((result, index) => {
                        // Determine if this player is 1st, 2nd, or 3rd
                        const rankClass = index === 0 
                          ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-yellow-500/30" 
                          : index === 1 
                            ? "bg-gradient-to-r from-slate-300/20 to-slate-400/20 border-slate-400/30"
                            : index === 2 
                              ? "bg-gradient-to-r from-amber-700/20 to-yellow-700/20 border-amber-700/30"
                              : "bg-black/10";
                        
                        const correctAnswers = result.correctAnswers || result.correct_answers || 0;
                        const totalQuestions = result.totalQuestions || result.total_questions || 
                                              (result.incorrectAnswers || result.incorrect_answers ? 
                                               correctAnswers + (result.incorrectAnswers || result.incorrect_answers || 0) : 10);
                        
                        return (
                          <div
                            key={index}
                            className={`flex items-center justify-between rounded-lg p-4 border ${rankClass}`}
                          >
                            <div className="flex items-center">
                              <div className="w-8 h-8 flex items-center justify-center mr-3 text-xl">
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                              </div>
                              <div className="w-12 h-12 flex items-center justify-center text-2xl rounded-full bg-white/10 mr-3">
                                {result.avatar}
                              </div>
                              <div>
                                <span className="text-white font-medium block">{result.name}</span>
                                <div className="flex items-center mt-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mr-1" />
                                  <span className="text-xs text-white/70 mr-2">{correctAnswers}/{totalQuestions} correct</span>
                                  
                                  <Trophy className="w-3.5 h-3.5 text-amber-400 mr-1" />
                                  <span className="text-xs text-white/70">{result.score} pts</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-2xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-indigo-300">
                              {result.score}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Quiz Statistics */}
                    <div>
                      <h3 className="text-white font-medium text-lg mb-3">Quiz Statistics</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <div className="flex items-center text-violet-300 mb-1">
                            <Users className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium">Players</span>
                          </div>
                          <p className="text-2xl font-bold text-white">{results.length}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <div className="flex items-center text-amber-300 mb-1">
                            <Trophy className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium">Top Score</span>
                          </div>
                          <p className="text-2xl font-bold text-white">{sortedResults[0]?.score || 0}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <div className="flex items-center text-emerald-300 mb-1">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium">Total Questions</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {sortedResults[0]?.totalQuestions || sortedResults[0]?.total_questions || 10}
                          </p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <div className="flex items-center text-purple-300 mb-1">
                            <Clock className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium">Time per Question</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {settings.timePerQuestion}s
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>

              <div className="p-4 relative z-10">
                <Button
                  onClick={handleReturnToLobby}
                  className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-medium py-3 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/25"
                >
                  Return to Multiplayer Menu
                </Button>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default MultiplayerResults;
