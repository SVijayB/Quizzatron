import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Timer, Users, Crown, Check, X, RefreshCw } from "lucide-react";
import CursorEffect from "@/components/CursorEffect";
import { QuizQuestion } from "@/components/quiz/QuizQuestion";
import { QuizOptions } from "@/components/quiz/QuizOptions";
import { QuizBackground } from "@/components/quiz/QuizBackground";
import { getGameState, submitAnswer } from "@/services/multiplayerService";
import { MultiplayerQuizQuestion, MultiplayerPlayer } from "@/services/multiplayerService";
import EmojiAvatar from "@/components/EmojiAvatar";

// Constants
const QUESTION_TIMEOUT = 10; // Seconds per question
const INITIAL_DELAY = 2; // Seconds to wait before starting the timer
const SCOREBOARD_DISPLAY_TIME = 5; // Seconds to display scoreboard between questions
const POLLING_INTERVAL = 800; // Milliseconds between server polls

// Game states
const GAME_STATES = {
  LOADING: "loading",
  QUESTION: "question",
  WAITING: "waiting",
  SCOREBOARD: "scoreboard",
  GAME_OVER: "gameOver"
};

const MultiplayerQuiz = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  
  // Game data
  const [quizData, setQuizData] = useState<MultiplayerQuizQuestion[]>([]);
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [playerName, setPlayerName] = useState("");
  
  // UI states
  const [gameState, setGameState] = useState(GAME_STATES.LOADING);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMEOUT);
  const [timerStarted, setTimerStarted] = useState(false);
  const [scoreboardTimer, setScoreboardTimer] = useState(SCOREBOARD_DISPLAY_TIME);
  
  // Load player info from localStorage
  useEffect(() => {
    const storedPlayerName = localStorage.getItem("playerName");
    const storedLobbyCode = localStorage.getItem("lobbyCode");

    if (!storedPlayerName || !storedLobbyCode || storedLobbyCode !== lobbyCode) {
      navigate("/multiplayer");
      return;
    }

    setPlayerName(storedPlayerName);
    fetchGameState();
    
    // Set up polling interval
    const pollingInterval = setInterval(fetchGameState, POLLING_INTERVAL);
    
    return () => clearInterval(pollingInterval);
  }, [lobbyCode, navigate]);

  // Safety timer for waiting screen - force progression after 15 seconds
  useEffect(() => {
    // Only start the safety timer if we're in waiting state
    if (gameState !== GAME_STATES.WAITING) return;
    
    console.log("Starting 15-second safety timer for waiting screen");
    const safetyTimer = setTimeout(() => {
      console.log("⚠️ Safety timer elapsed - forcing progression to scoreboard");
      setGameState(GAME_STATES.SCOREBOARD);
    }, 15000); // 15 seconds
    
    return () => clearTimeout(safetyTimer);
  }, [gameState]);

  // Timer effect - counts down during questions
  useEffect(() => {
    if (gameState !== GAME_STATES.QUESTION || !timerStarted || isRevealed) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRevealed(true);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameState, timerStarted, isRevealed]);
  
  // Initial delay before starting the timer
  useEffect(() => {
    if (gameState !== GAME_STATES.QUESTION || timerStarted || isRevealed) return;
    
    const delay = setTimeout(() => {
      setTimerStarted(true);
    }, INITIAL_DELAY * 1000);
    
    return () => clearTimeout(delay);
  }, [gameState, timerStarted, isRevealed]);
  
  // Scoreboard timer effect
  useEffect(() => {
    if (gameState !== GAME_STATES.SCOREBOARD) return;
    
    const timer = setInterval(() => {
      setScoreboardTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          advanceToNextQuestion();
          return SCOREBOARD_DISPLAY_TIME;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameState]);
  
  // Game over effect - navigate to results
  useEffect(() => {
    if (gameState !== GAME_STATES.GAME_OVER) return;
    
    const getFinalResults = async () => {
      try {
        const data = await getGameState(lobbyCode || '');
        localStorage.setItem("multiplayerResults", JSON.stringify(data.players));
        
        setTimeout(() => {
          navigate(`/multiplayer/results/${lobbyCode}`);
        }, 800);
      } catch (error) {
        console.error("Error fetching final results:", error);
        navigate(`/multiplayer/results/${lobbyCode}`);
      }
    };
    
    getFinalResults();
  }, [gameState, lobbyCode, navigate]);

  // Fetch game state from server
  const fetchGameState = async () => {
    try {
      const data = await getGameState(lobbyCode || '');
      
      // Initialize quiz data if not already done
      if (quizData.length === 0 && data.processedQuestions && data.processedQuestions.length > 0) {
        console.log(`Loaded ${data.processedQuestions.length} questions`);
        setQuizData(data.processedQuestions);
        
        // Immediately transition to question state when questions are first loaded
        if (gameState === GAME_STATES.LOADING) {
          console.log("Transitioning from LOADING to QUESTION state");
          setGameState(GAME_STATES.QUESTION);
          return;
        }
      }
      
      setPlayers(data.players);
      
      // Check for game over from server
      if (data.game_over) {
        setGameState(GAME_STATES.GAME_OVER);
        return;
      }
      
      // If we're in the loading state and we already have questions, transition to question state
      if (gameState === GAME_STATES.LOADING && quizData.length > 0) {
        console.log("Already have questions, transitioning to QUESTION state");
        setGameState(GAME_STATES.QUESTION);
        return;
      }
      
      // If we're waiting for other players
      if (gameState === GAME_STATES.WAITING) {
        // Check if all players have answered the current question
        const allPlayersAnswered = haveAllPlayersAnswered(data.players, currentQuestion);
        
        if (allPlayersAnswered) {
          // All players have answered, show scoreboard
          console.log("All players answered, showing scoreboard");
          setGameState(GAME_STATES.SCOREBOARD);
          return;
        }
      }
    } catch (error) {
      console.error("Error fetching game state:", error);
    }
  };
  
  // Check if all players have answered the current question
  const haveAllPlayersAnswered = (playerList: MultiplayerPlayer[], questionIndex: number) => {
    console.log(`Checking if all players answered question ${questionIndex}:`);
    
    // Log each player's answer status for this question
    playerList.forEach(p => {
      const hasAnswered = (p.currentQuestion > questionIndex) || 
                          (p.answers && p.answers.length > questionIndex);
      console.log(`- ${p.name}: current question=${p.currentQuestion}, answers=${p.answers?.length || 0}, has answered=${hasAnswered}`);
    });
    
    const allAnswered = playerList.every(player => 
      (player.currentQuestion > questionIndex) || 
      (player.answers && player.answers.length > questionIndex)
    );
    
    if (allAnswered) {
      console.log(`✅ All players have answered question ${questionIndex}!`);
    } else {
      console.log(`❌ Still waiting for some players to answer question ${questionIndex}`);
    }
    
    return allAnswered;
  };
  
  // Handle timeout (no answer selected)
  const handleTimeOut = async () => {
    if (!quizData[currentQuestion]) return;
    
    try {
      // Submit no answer to the server
      await submitAnswer(
        lobbyCode || '',
        playerName,
        currentQuestion,
        "Unanswered",
        QUESTION_TIMEOUT,
        false,
        0
      );
      
      // Wait 1 second before showing waiting screen
      setTimeout(() => {
        setGameState(GAME_STATES.WAITING);
      }, 1000);
    } catch (error) {
      console.error("Error submitting timeout:", error);
      toast({
        title: "Error",
        description: "Failed to submit your answer. The game will continue.",
        variant: "destructive",
      });
    }
  };
  
  // Handle player selecting an answer
  const handleAnswer = async (option: string) => {
    if (isRevealed) return;
    
    setSelectedAnswer(option);
    setIsRevealed(true);
    
    const question = quizData[currentQuestion];
    if (!question) return;
    
    const isCorrect = option === question.correct_answer;
    const score = isCorrect ? timeLeft : 0;
    
    try {
      // Submit answer to the server
      await submitAnswer(
        lobbyCode || '',
        playerName,
        currentQuestion,
        option,
        QUESTION_TIMEOUT - timeLeft,
        isCorrect,
        score
      );
      
      // Wait 1 second before showing waiting screen
      setTimeout(() => {
        setGameState(GAME_STATES.WAITING);
      }, 1000);
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast({
        title: "Error",
        description: "Failed to submit your answer. The game will continue.",
        variant: "destructive",
      });
    }
  };
  
  // Move to the next question or end the game
  const advanceToNextQuestion = () => {
    if (currentQuestion >= quizData.length - 1) {
      // Last question completed, end the game
      setGameState(GAME_STATES.GAME_OVER);
    } else {
      // Move to the next question
      setCurrentQuestion(prev => prev + 1);
      setTimeLeft(QUESTION_TIMEOUT);
      setIsRevealed(false);
      setTimerStarted(false);
      setSelectedAnswer(null);
      setGameState(GAME_STATES.QUESTION);
    }
  };
  
  // Sort players by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  // Get the current question
  const question = quizData[currentQuestion];
  
  // Loading state
  if (gameState === GAME_STATES.LOADING) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg text-white text-center">
          <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Loading Quiz...</h2>
          <p>Please wait while we prepare the questions.</p>
        </div>
      </div>
    );
  }
  
  // Error state - no question available
  if (!question && gameState !== GAME_STATES.GAME_OVER) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Quiz Error</h2>
          <p>Unable to load the current question. Please try again.</p>
          <Button 
            onClick={() => navigate('/multiplayer')}
            className="mt-4 px-4 py-2 bg-violet-500 rounded-lg hover:bg-violet-600 transition-colors"
          >
            Return to Multiplayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-[#121225] text-white overflow-hidden">
      <CursorEffect />
      <QuizBackground />
      
      {/* Timer - only shown during question */}
      {gameState === GAME_STATES.QUESTION && (
        <div className="absolute top-6 right-6 z-20 flex items-center bg-black/40 backdrop-blur-md px-5 py-3 rounded-xl shadow-[0_0_20px_rgba(255,200,0,0.2)] border border-amber-500/30 transition-all duration-300">
          <Timer className="w-7 h-7 mr-3 text-amber-400" />
          <span className={`text-3xl font-bold ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </span>
        </div>
      )}
      
      {/* Player scores sidebar */}
      <div className="absolute top-6 left-6 z-20 w-64 bg-black/40 backdrop-blur-md p-4 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.2)] border border-violet-500/30">
        <h3 className="text-base font-semibold text-white mb-3 flex items-center">
          <Users className="w-5 h-5 mr-2 text-violet-400" />
          Player Scores
        </h3>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {sortedPlayers.map((player) => (
            <div 
              key={player.id} 
              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${player.name === playerName ? 'bg-gradient-to-r from-violet-500/20 to-transparent border border-violet-500/30' : 'bg-white/5 hover:bg-white/10'}`}
            >
              <EmojiAvatar 
                initialEmoji={player.avatar}
                size={40}
                isInteractive={false}
                className="min-w-[40px]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium truncate">{player.name}</p>
                  <p className="text-lg font-bold text-amber-400">{player.score}</p>
                </div>
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-emerald-400 h-full"
                    style={{
                      width: `${(() => {
                        // Calculate total possible points (10 points per question)
                        const totalPossiblePoints = quizData.length * 10;
                        // Calculate percentage of total possible points
                        const scorePercentage = totalPossiblePoints > 0 
                          ? Math.min(100, (player.score / totalPossiblePoints) * 100) 
                          : 0;
                        return scorePercentage;
                      })()}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {gameState === GAME_STATES.SCOREBOARD && (
          /* Scoreboard Display Between Questions */
          <motion.div 
            key="scoreboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
          >
            <div className="w-full max-w-2xl bg-black/40 backdrop-blur-lg rounded-xl shadow-lg border border-violet-500/20 p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2 text-white">Scoreboard</h2>
                <p className="text-violet-300">Question {currentQuestion + 1} of {quizData.length} completed</p>
                <p className="text-amber-300 font-semibold mt-2">Next question in {scoreboardTimer}...</p>
              </div>

              <div className="space-y-3">
                {sortedPlayers.map((player, index) => (
                  <motion.div 
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`flex items-center p-3 rounded-lg ${index === 0 ? 'bg-gradient-to-r from-amber-500/20 to-transparent border border-amber-500/30' : 'bg-white/5'}`}
                  >
                    <div className="w-8 text-center font-semibold text-lg">
                      {index === 0 ? <Crown className="h-6 w-6 text-amber-400 mx-auto" /> : `#${index + 1}`}
                    </div>
                    
                    <div className="mx-3">
                      <EmojiAvatar 
                        initialEmoji={player.avatar} 
                        size={40} 
                        isInteractive={false}
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <p className={`font-medium ${player.name === playerName ? 'text-violet-300' : 'text-white'}`}>
                          {player.name} {player.name === playerName && '(You)'}
                        </p>
                        <p className="font-bold text-amber-400">{player.score}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <span className="flex items-center text-emerald-400">
                          <Check className="w-3.5 h-3.5 mr-1" />
                          {player.correctAnswers}
                        </span>
                        <span className="text-gray-400">/</span>
                        <span className="flex items-center text-red-400">
                          <X className="w-3.5 h-3.5 mr-1" />
                          {player.currentQuestion - player.correctAnswers}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
        
        {gameState === GAME_STATES.WAITING && (
          /* Waiting for other players */
          <motion.div 
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
          >
            <div className="bg-black/40 backdrop-blur-lg rounded-xl shadow-lg border border-violet-500/20 p-8 text-center">
              <RefreshCw className="w-10 h-10 mx-auto mb-4 text-violet-400 animate-spin" />
              <h2 className="text-xl font-bold mb-2 text-white">
                Waiting for other players...
              </h2>
              <p className="text-violet-300 max-w-md">
                You've answered question {currentQuestion + 1}. 
                Waiting for all players to answer before moving to the next round.
              </p>
            </div>
          </motion.div>
        )}
        
        {gameState === GAME_STATES.QUESTION && question && (
          /* Regular Question Display */
          <motion.div 
            key={`question-${currentQuestion}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
          >
            <div className="w-full max-w-3xl space-y-8">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-sm font-medium bg-white/10 px-3 py-1 rounded-full">
                    Question {currentQuestion + 1} of {quizData.length}
                  </span>
                </div>
              </div>
              
              <QuizQuestion 
                question={question.question} 
                image={question.image}
              />
              
              <QuizOptions 
                options={question.options} 
                selectedAnswer={selectedAnswer}
                isRevealed={isRevealed}
                correctAnswer={question.correct_answer}
                onSelectAnswer={handleAnswer}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultiplayerQuiz;