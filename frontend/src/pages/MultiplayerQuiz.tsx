import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { Timer } from "lucide-react";
import CursorEffect from "@/components/CursorEffect";
import { QuizQuestion } from "@/components/quiz/QuizQuestion";
import { QuizOptions } from "@/components/quiz/QuizOptions";
import { QuizBackground } from "@/components/quiz/QuizBackground";
import { getGameState, submitAnswer } from "@/services/multiplayerService";
import { MultiplayerQuizQuestion, MultiplayerPlayer } from "@/services/multiplayerService";

const QUESTION_TIMEOUT = 10;
const INITIAL_DELAY = 2;

const MultiplayerQuiz = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const [quizData, setQuizData] = useState<MultiplayerQuizQuestion[]>([]);
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMEOUT);
  const [timerStarted, setTimerStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPolling, setIsPolling] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Load player info from localStorage
  useEffect(() => {
    const storedPlayerName = localStorage.getItem("playerName");
    const storedLobbyCode = localStorage.getItem("lobbyCode");

    if (!storedPlayerName || !storedLobbyCode || storedLobbyCode !== lobbyCode) {
      navigate("/multiplayer");
      return;
    }

    setPlayerName(storedPlayerName);

    // Initial fetch of game state
    fetchGameState();

    // Set up polling interval
    const pollingInterval = setInterval(fetchGameState, 3000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [lobbyCode, navigate]);

  // Initial delay effect
  useEffect(() => {
    if (!timerStarted && !isRevealed && quizData.length > 0) {
      const delay = setTimeout(() => {
        setTimerStarted(true);
      }, INITIAL_DELAY * 1000);
      
      return () => clearTimeout(delay);
    }
  }, [timerStarted, isRevealed, quizData.length]);

  // Timer effect - only starts after initial delay
  useEffect(() => {
    if (timerStarted && !isRevealed && quizData.length > 0) {
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
    }
  }, [timerStarted, isRevealed, quizData.length]);

  // Enhanced game over detection
  useEffect(() => {
    if (isGameOver) {
      console.log("Game is over, navigating to results...");
      
      // Fetch the final state once more before navigating to ensure latest scores
      const getFinalResults = async () => {
        try {
          const data = await getGameState(lobbyCode || '');
          // Store the final results to ensure we have the most up-to-date scores
          localStorage.setItem("multiplayerResults", JSON.stringify(data.players));
          console.log("Final results saved, navigating to results page");
          
          // Navigate to results with a short delay to ensure data is saved
          setTimeout(() => {
            navigate(`/multiplayer/results/${lobbyCode}`);
          }, 800);
        } catch (error) {
          console.error("Error fetching final results:", error);
          // Still navigate even if there's an error
          navigate(`/multiplayer/results/${lobbyCode}`);
        }
      };
      
      getFinalResults();
    }
  }, [isGameOver, lobbyCode, navigate]);

  // Modified to ensure we check for game end even if the polling fails
  const fetchGameState = async () => {
    if (!isPolling) return;

    try {
      setIsLoading(true);
      const data = await getGameState(lobbyCode || '');
      
      // Initialize quiz data if not already done
      if (quizData.length === 0 && data.processedQuestions && data.processedQuestions.length > 0) {
        console.log("Loaded questions:", data.processedQuestions);
        setQuizData(data.processedQuestions);
      }
      
      setPlayers(data.players);
      
      // Check if the game is over
      if (data.game_over) {
        console.log("Server reports game is over, saving results and preparing to navigate");
        setIsGameOver(true);
        setIsPolling(false);
        // Save results in localStorage for access in the results page
        localStorage.setItem("multiplayerResults", JSON.stringify(data.players));
      }
    } catch (error) {
      console.error("Error fetching game state:", error);
      toast({
        title: "Error Loading Game",
        description: "There was a problem loading the game data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeOut = async () => {
    if (!quizData[currentQuestion]) return;
    
    try {
      // Submit answer (timeout means no answer)
      await submitAnswer(
        lobbyCode || '',
        playerName,
        currentQuestion,
        "Unanswered",
        QUESTION_TIMEOUT,
        false,
        0
      );
      
      // Move to the next question after a delay
      setTimeout(() => {
        moveToNextQuestion();
      }, 2000);
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast({
        title: "Error",
        description: "Failed to submit your answer. The game will continue.",
        variant: "destructive",
      });
    }
  };

  const handleAnswer = async (option: string) => {
    if (isRevealed) return;
    
    setSelectedAnswer(option);
    setIsRevealed(true);
    
    const question = quizData[currentQuestion];
    if (!question) return;
    
    const isCorrect = option === question.correct_answer;
    const score = isCorrect ? timeLeft : 0;
    
    try {
      // Submit answer to the server using the service
      await submitAnswer(
        lobbyCode || '',
        playerName,
        currentQuestion,
        option,
        QUESTION_TIMEOUT - timeLeft,
        isCorrect,
        score
      );
      
      // Move to the next question after a delay
      setTimeout(() => {
        moveToNextQuestion();
      }, 2000);
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast({
        title: "Error",
        description: "Failed to submit your answer. The game will continue.",
        variant: "destructive",
      });
      setTimeout(() => {
        moveToNextQuestion();
      }, 2000);
    }
  };

  const moveToNextQuestion = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      if (currentQuestion >= quizData.length - 1) {
        // End of quiz
        setIsPolling(false);
        setIsGameOver(true);
      } else {
        setCurrentQuestion(prev => prev + 1);
        setTimeLeft(QUESTION_TIMEOUT);
        setIsRevealed(false);
        setTimerStarted(false);
        setSelectedAnswer(null);
      }
      setIsTransitioning(false);
    }, 500);
  };

  // Generate a color for avatar fallback based on player name
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", 
      "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"
    ];
    
    // Simple hash function to get consistent color based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  if (isLoading && quizData.length === 0) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Loading Quiz...</h2>
          <p>Please wait while we prepare the questions.</p>
        </div>
      </div>
    );
  }

  const question = quizData[currentQuestion];
  
  // Handle invalid question state
  if (!question) {
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
      
      {/* Timer */}
      <div className="absolute top-4 right-4 z-20 flex items-center bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg">
        <Timer className="w-5 h-5 mr-2 text-amber-400" />
        <span className={`text-lg font-bold ${timeLeft <= 3 ? 'text-red-400' : 'text-white'}`}>
          {timeLeft}s
        </span>
      </div>
      
      {/* Player scores sidebar */}
      <div className="absolute top-4 left-4 z-20 w-48 bg-black/30 backdrop-blur-sm p-3 rounded-lg shadow-lg">
        <h3 className="text-sm font-semibold text-white/80 mb-2">Players</h3>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {players.map((player) => (
            <div 
              key={player.id} 
              className={`flex items-center gap-2 p-2 rounded-md ${player.name === playerName ? 'bg-white/10' : ''}`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={player.avatar} alt={player.name} />
                <AvatarFallback className={`${getAvatarColor(player.name)} text-white text-xs`}>
                  {player.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium truncate">{player.name}</p>
                  <p className="text-xs font-bold text-amber-400">{player.score}</p>
                </div>
                <div className="w-full bg-white/10 h-1 mt-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-green-500 h-full"
                    style={{
                      width: `${player.answers && player.answers.length > 0 ? Math.min(100, (player.answers.length / quizData.length) * 100) : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
          <motion.div 
            key={`question-${currentQuestion}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-3xl space-y-8"
          >
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
          </motion.div>
        </div>
      </AnimatePresence>
    </div>
  );
};

export default MultiplayerQuiz;