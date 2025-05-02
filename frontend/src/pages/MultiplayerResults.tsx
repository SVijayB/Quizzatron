import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { 
  Trophy, ArrowLeft, CheckCircle2, Crown, 
  User, Users, Clock, BarChart, Timer, Zap, Gamepad2, Heart, Share2
} from "lucide-react";
import confetti from "canvas-confetti";
import QuizLogo from "@/components/QuizLogo";
import CursorEffect from "@/components/CursorEffect";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import "../styles/MultiplayerResults.css";

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

// Firework component for animated effects
const FireworkEffect = () => {
  const fireworkContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!fireworkContainerRef.current) return;
    
    // Function to create a firework
    const createFirework = () => {
      if (!fireworkContainerRef.current) return;
      
      const container = fireworkContainerRef.current;
      const colors = ['red', 'blue', 'green', 'gold', 'purple'];
      const firework = document.createElement('div');
      
      firework.className = `firework ${colors[Math.floor(Math.random() * colors.length)]}`;
      firework.style.left = `${Math.random() * 100}%`;
      firework.style.top = `${Math.random() * 60 + 20}%`;
      
      container.appendChild(firework);
      
      // Remove the firework element after animation completes
      setTimeout(() => {
        if (container.contains(firework)) {
          container.removeChild(firework);
        }
      }, 2000);
    };
    
    // Create fireworks at random intervals
    const fireworkInterval = setInterval(() => {
      createFirework();
    }, 1000);
    
    return () => {
      clearInterval(fireworkInterval);
    };
  }, []);
  
  return <div className="firework-container" ref={fireworkContainerRef}></div>;
};

// Sparkle component for podium
const Sparkles = ({ color }: { color: 'gold' | 'silver' | 'bronze' }) => {
  return (
    <>
      <div className={`sparkle sparkle1 ${color}`}></div>
      <div className={`sparkle sparkle2 ${color}`}></div>
      <div className={`sparkle sparkle3 ${color}`}></div>
      <div className={`sparkle sparkle4 ${color}`}></div>
      <div className={`sparkle sparkle5 ${color}`}></div>
    </>
  );
};

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
  const { setGameSettings, setPlayers } = useMultiplayer();
  const [showConfetti, setShowConfetti] = useState(false);

  // Floating icon variants for animation
  const floatingIconVariants = {
    animate: (custom: number) => ({
      y: [0, -15, 0],
      x: custom % 2 === 0 ? [0, 5, 0] : [0, -5, 0],
      rotate: custom % 3 === 0 ? [0, 5, 0] : [0, -5, 0],
      transition: {
        duration: 3 + (custom % 3),
        repeat: Infinity,
        repeatType: "mirror" as const,
      }
    })
  };

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
          
          setTimeout(() => {
            setShowConfetti(true);
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

  // Trigger confetti animation when results are shown
  useEffect(() => {
    if (showConfetti) {
      const duration = 5000;
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

      return () => clearInterval(interval);
    }
  }, [showConfetti]);

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

  const sortedResults = [...results].sort((a, b) => b.score - a.score);
  
  // Get top 3 players for podium
  const topThreePlayers = sortedResults.slice(0, 3);
  // Get remaining players for list
  const otherPlayers = sortedResults.slice(3);

  return (
    <div className="results-page">
      {/* Updated background to match the lobby background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#2a2a42_0%,#1a1a2e_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(90,71,192,0.5)_0%,rgba(50,29,115,0.7)_100%)] opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(58,31,128,0.2)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,#4f3ed0,transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_0%_300px,#8b5cf6,transparent)]" />
        <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
        
        {/* Floating icons to match lobby */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            custom={1}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute left-[15%] top-[20%] text-white/20 text-4xl"
          >
            <Trophy className="w-10 h-10" />
          </motion.div>
          <motion.div 
            custom={2}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute right-[20%] top-[15%] text-white/20 text-4xl"
          >
            <Gamepad2 className="w-12 h-12" />
          </motion.div>
          <motion.div 
            custom={3}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute left-[10%] bottom-[20%] text-white/20 text-4xl"
          >
            <Zap className="w-8 h-8" />
          </motion.div>
          <motion.div 
            custom={4}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute right-[15%] bottom-[25%] text-white/20 text-4xl"
          >
            <Timer className="w-9 h-9" />
          </motion.div>
          <motion.div 
            custom={5}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute left-[25%] top-[50%] text-white/20 text-4xl"
          >
            <Crown className="w-7 h-7" />
          </motion.div>
          <motion.div 
            custom={6}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute right-[25%] top-[40%] text-white/20 text-4xl"
          >
            <Heart className="w-6 h-6" />
          </motion.div>
        </div>
      </div>
      
      <CursorEffect />
      
      {showConfetti && <FireworkEffect />}
      
      <div className="results-content">
        <Button
          onClick={handleReturnToLobby}
          variant="ghost"
          className="back-button"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Multiplayer
        </Button>
        
        <motion.div
          className="results-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            animate={{
              y: [0, -8, 0],
              rotate: [0, -3, 0, 3, 0],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              repeatType: "mirror",
            }}
          >
            <QuizLogo size={60} color="white" className="mr-4" />
          </motion.div>
          
          <div>
            <h1 className="results-title">Multiplayer Results</h1>
            <p className="results-subtitle">
              <Users className="w-4 h-4 mr-1" />
              See how you stack up against your friends!
            </p>
          </div>
        </motion.div>
        
        {isLoading ? (
          <div className="results-loading">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="loading-icon"
            >
              <Trophy className="w-8 h-8" />
            </motion.div>
            <p>Loading Results...</p>
          </div>
        ) : (
          <motion.div
            className="results-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div 
              className="results-card"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="results-card-header">
                <Trophy className="w-6 h-6 text-yellow-300 mr-2" />
                <h2 className="text-2xl font-bold">Final Standings</h2>
              </div>
              
              <div className="results-card-content">
                {/* Podium section for top 3 players */}
                {topThreePlayers.length > 0 && (
                  <div className="podium-container">
                    {/* Arrange players in the correct podium order: 2nd, 1st, 3rd */}
                    <div className="podium-layout">
                      {/* Second Place */}
                      {topThreePlayers.length > 1 && (
                        <motion.div 
                          className="podium-place podium-second"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4, duration: 0.6 }}
                        >
                          <div className="podium-avatar-container">
                            <Sparkles color="silver" />
                            <div className="podium-medal">🥈</div>
                            <div className="podium-avatar">
                              {topThreePlayers[1].avatar}
                            </div>
                          </div>
                          <motion.div 
                            className="podium-block second-place-block"
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                          >
                            <p className="podium-name">{topThreePlayers[1].name}</p>
                            <p className="podium-score">{topThreePlayers[1].score} pts</p>
                          </motion.div>
                        </motion.div>
                      )}
                      
                      {/* First Place */}
                      <motion.div 
                        className="podium-place podium-first"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                      >
                        <div className="podium-avatar-container">
                          <Sparkles color="gold" />
                          <div className="podium-crown">
                            <Crown className="w-6 h-6 text-yellow-300" />
                          </div>
                          <div className="podium-medal">🥇</div>
                          <div className="podium-avatar winner">
                            {topThreePlayers[0].avatar}
                          </div>
                        </div>
                        <motion.div 
                          className="podium-block first-place-block"
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          transition={{ delay: 0.2, duration: 0.8 }}
                        >
                          <p className="podium-name">{topThreePlayers[0].name}</p>
                          <p className="podium-score">{topThreePlayers[0].score} pts</p>
                        </motion.div>
                      </motion.div>
                      
                      {/* Third Place */}
                      {topThreePlayers.length > 2 && (
                        <motion.div 
                          className="podium-place podium-third"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6, duration: 0.6 }}
                        >
                          <div className="podium-avatar-container">
                            <Sparkles color="bronze" />
                            <div className="podium-medal">🥉</div>
                            <div className="podium-avatar">
                              {topThreePlayers[2].avatar}
                            </div>
                          </div>
                          <motion.div 
                            className="podium-block third-place-block"
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            transition={{ delay: 0.6, duration: 0.4 }}
                          >
                            <p className="podium-name">{topThreePlayers[2].name}</p>
                            <p className="podium-score">{topThreePlayers[2].score} pts</p>
                          </motion.div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Other players list */}
                {otherPlayers.length > 0 && (
                  <div className="other-players">
                    <h3 className="other-players-title">Other Rankings</h3>
                    <div className="other-players-list">
                      {otherPlayers.map((player, index) => {
                        const correctAnswers = player.correctAnswers || player.correct_answers || 0;
                        const totalQuestions = player.totalQuestions || player.total_questions || 10;
                        
                        return (
                          <motion.div
                            key={player.id || index}
                            className="player-rank-item"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.8 + index * 0.1 }}
                          >
                            <div className="player-rank">
                              {index + 4}
                            </div>
                            <div className="player-avatar">
                              {player.avatar}
                            </div>
                            <div className="player-info">
                              <p className="player-name">{player.name}</p>
                              <div className="player-stats">
                                <span className="player-correct">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {correctAnswers}/{totalQuestions}
                                </span>
                                <span className="player-points">
                                  <Trophy className="w-3 h-3 mr-1" />
                                  {player.score} pts
                                </span>
                              </div>
                            </div>
                            <div className="player-score">
                              {player.score}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Stats cards */}
                <motion.div 
                  className="stats-container"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                >
                  <h3 className="stats-title">Quiz Statistics</h3>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="stat-label">Players</div>
                      <div className="stat-value">{results.length}</div>
                    </div>
                    
                    <div className="stat-card">
                      <div className="stat-icon">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div className="stat-label">Top Score</div>
                      <div className="stat-value">
                        {sortedResults[0]?.score || 0}
                      </div>
                    </div>
                    
                    <div className="stat-card">
                      <div className="stat-icon">
                        <BarChart className="w-5 h-5" />
                      </div>
                      <div className="stat-label">Total Questions</div>
                      <div className="stat-value">
                        {sortedResults[0]?.totalQuestions || 
                         sortedResults[0]?.total_questions || 10}
                      </div>
                    </div>
                    
                    <div className="stat-card">
                      <div className="stat-icon">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="stat-label">Time per Question</div>
                      <div className="stat-value">
                        {settings.timePerQuestion}s
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
              
              <motion.div 
                className="results-footer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 }}
              >
                <Button
                  onClick={handleReturnToLobby}
                  className="return-button"
                >
                  Return to Multiplayer Menu
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MultiplayerResults;
