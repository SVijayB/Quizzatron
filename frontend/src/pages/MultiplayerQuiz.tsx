import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { apiService } from "@/services/apiService";
import { socketService } from "@/services/socketService";
import { toast } from "@/components/ui/use-toast"; // Fix: Change from useToast to toast import
import QuizQuestion from "@/components/QuizQuestion";
import { Check, X } from "lucide-react";
import "./Quiz.css";

// Types for questions and players
interface Question {
  question: string;
  options: string[];
  correct_answer: string;
  image?: string;
  difficulty?: string;
  index?: number;
}

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  avatar: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  currentQuestion: number;
}

// Enum for quiz states
enum QuizState {
  LOADING = "loading",
  QUESTION = "question",
  WAITING = "waiting",
  RESULTS = "results"
}

const MultiplayerQuiz = () => {
  const navigate = useNavigate();
  const { lobbyCode: urlLobbyCode } = useParams<{ lobbyCode: string }>();
  const lobbyCode = urlLobbyCode || "";
  const { playerName, playerId, gameSettings, isHost } = useMultiplayer();

  // State for quiz data
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [quizState, setQuizState] = useState<QuizState>(QuizState.LOADING);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Refs for tracking state in event listeners
  const questionsRef = useRef<Question[]>([]);
  const currentQuestionIndexRef = useRef<number>(0);
  const quizStateRef = useRef<QuizState>(QuizState.LOADING);

  // Update refs when state changes
  useEffect(() => {
    quizStateRef.current = quizState;
  }, [quizState]);

  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  // State for current question interaction
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [answered, setAnswered] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [timeTaken, setTimeTaken] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(gameSettings.timePerQuestion);
  const [timerRunning, setTimerRunning] = useState<boolean>(true);
  const [showAnswerAnimation, setShowAnswerAnimation] = useState<boolean>(false);
  // State for waiting screen countdown
  const [waitingCountdown, setWaitingCountdown] = useState<number | null>(null);
  
  // Effect for timer
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (timerRunning && countdown > 0 && quizState === QuizState.QUESTION) {
      intervalId = setInterval(() => {
        setCountdown((prev) => prev - 0.1);
        setTimeTaken((prev) => prev + 0.1);
      }, 100);
    } else if (countdown <= 0 && quizState === QuizState.QUESTION) {
      // Time's up, handle as empty answer
      handleAnswer("");
    }

    return () => clearInterval(intervalId);
  }, [timerRunning, countdown, quizState]);

  // Effect for waiting countdown timer
  useEffect(() => {
    if (waitingCountdown === null || quizState !== QuizState.WAITING) return;
    
    // If countdown reaches 0, move to next question
    if (waitingCountdown <= 0) {
      console.log("Countdown finished, moving to next question automatically");
      
      // If we're the host, request the next question from the server
      // This will trigger the newQuestionHandler for all clients
      if (isHost) {
        console.log("Host requesting next question from server");
        socketService.requestNextQuestion(lobbyCode);
      } else {
        console.log("Non-host player waiting for next question from server");
      }
      
      setWaitingCountdown(null);
      return;
    }
    
    // Decrement countdown every second
    const timerId = setTimeout(() => {
      setWaitingCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    
    return () => clearTimeout(timerId);
  }, [waitingCountdown, quizState, isHost, lobbyCode]);

  // Fetch all quiz data at the beginning
  const fetchQuizData = async () => {
    try {
      console.log("Fetching quiz data for lobby:", lobbyCode);
      const gameState = await apiService.getGameState(lobbyCode);
      console.log("Game state received:", gameState);
      
      if (!gameState) {
        console.error("Failed to fetch game state");
        return;
      }
      
      // Extract all questions from the game state
      let questions: Question[] = [];
      if (Array.isArray(gameState.questions) && gameState.questions.length > 0) {
        if (gameState.questions[0] && Array.isArray(gameState.questions[0])) {
          // Handle case where questions are in the first element of an array
          questions = gameState.questions[0];
        } else {
          questions = gameState.questions;
        }
      } else if (Array.isArray(gameState.processedQuestions) && gameState.processedQuestions.length > 0) {
        questions = gameState.processedQuestions;
      }
      
      // Process questions to ensure consistent format
      const processedQuestions = questions.map((q: any, index) => {
        // Process options if they're stored as numeric properties (0, 1, 2, 3)
        const options = Array.isArray(q.options) 
          ? q.options 
          : [q[0], q[1], q[2], q[3]].filter(Boolean);
        
        return {
          question: q.question,
          options,
          correct_answer: q.correct_answer,
          image: q.image,
          difficulty: q.difficulty,
          index
        };
      });
      
      console.log("Processed all questions:", processedQuestions);
      setAllQuestions(processedQuestions);
      questionsRef.current = processedQuestions;
      
      // Set players
      if (gameState.players) {
        setPlayers(gameState.players);
      }
      
      // Start the quiz
      setCurrentQuestionIndex(0);
      currentQuestionIndexRef.current = 0;
      setQuizState(QuizState.QUESTION);
      quizStateRef.current = QuizState.QUESTION;
      resetQuestionState();
      
    } catch (error) {
      console.error("Error fetching quiz data:", error);
    }
  };

  // Reset state for a new question
  const resetQuestionState = () => {
    setUserAnswer("");
    setAnswered(false);
    setIsCorrect(false);
    setTimeTaken(0);
    setScore(0);
    setCountdown(gameSettings.timePerQuestion);
    setTimerRunning(true);
    setShowAnswerAnimation(false);
  };

  // Calculate score based on the remaining time
  const calculateScore = (correct: boolean, timeLeft: number) => {
    if (!correct) return 0;
    
    // Simply return the time left in seconds as the score (rounded to the nearest integer)
    return Math.round(timeLeft);
  };

  // Handle answer selection
  const handleAnswer = (answer: string) => {
    if (answered || quizState !== QuizState.QUESTION) return;
    
    setAnswered(true);
    setUserAnswer(answer);
    setTimerRunning(false);
    
    const currentQuestion = allQuestions[currentQuestionIndex];
    if (!currentQuestion) return;
    
    // Determine if answer is correct
    let correct = false;
    const correctAnswer = currentQuestion.correct_answer;
    
    if (answer === correctAnswer) {
      // Direct string match
      correct = true;
    } else if (
      typeof correctAnswer === 'string' && 
      ["A", "B", "C", "D"].includes(correctAnswer) && 
      Array.isArray(currentQuestion.options)
    ) {
      // Handle letter answers (A, B, C, D)
      const correctIndex = correctAnswer.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
      if (correctIndex >= 0 && correctIndex < currentQuestion.options.length) {
        correct = currentQuestion.options[correctIndex] === answer;
      }
    }
    
    // Log for debugging
    console.log("Answer submitted:", {
      userAnswer: answer,
      correctAnswer,
      isCorrect: correct
    });
    
    setIsCorrect(correct);
    
    // The remaining time in seconds (rounded to integer)
    const remainingTime = Math.floor(countdown);
    
    // Calculate score - just use the remaining time as score
    const questionScore = calculateScore(correct, remainingTime);
    setScore(questionScore);
    
    // Show animation
    setShowAnswerAnimation(true);
    
    // Send score update to server
    socketService.submitAnswer(
      lobbyCode,
      playerName,
      currentQuestionIndex,
      answer,
      timeTaken,
      correct,
      questionScore
    );
    
    // Move to waiting state after a short delay to show the answer feedback
    setTimeout(() => {
      setQuizState(QuizState.WAITING);
      // Do NOT start countdown here - we'll only start it when we get the all_answers_in event
    }, 1500);
  };

  // Move to the next question
  const handleNextQuestion = () => {
    console.log(`Moving to next question. Current index: ${currentQuestionIndex}, Total questions: ${allQuestions.length}`);
    
    if (currentQuestionIndex >= allQuestions.length - 1) {
      // Quiz is complete, move to results
      setQuizState(QuizState.RESULTS);
      navigate(`/multiplayer/results/${lobbyCode}`);
      return;
    }
    
    // Move to next question
    setCurrentQuestionIndex(prev => prev + 1);
    currentQuestionIndexRef.current = currentQuestionIndex + 1;
    resetQuestionState();
    setQuizState(QuizState.QUESTION);
    quizStateRef.current = QuizState.QUESTION;
  };

  // Set up socket listeners
  useEffect(() => {
    if (!playerName || !playerId || !lobbyCode) {
      navigate("/multiplayer");
      return;
    }
    
    // Make sure we're connected to the socket
    if (!socketService.isConnected()) {
      socketService.connect();
    }
    
    // First initialize all our event handlers
    const playerAnsweredHandler = (data: any) => {
      console.log("Player answered:", data);
      
      // Update the player's score in our local state
      setPlayers(prevPlayers => {
        return prevPlayers.map(player => {
          if (player.name === data.player_name) {
            return {
              ...player,
              score: player.score + (data.score || 0), // Add to existing score
              currentQuestion: (data.question_index || 0) + 1,
              correctAnswers: player.correctAnswers + (data.is_correct ? 1 : 0)
            };
          }
          return player;
        });
      });
    };
    
    const allAnswersInHandler = () => {
      console.log("All players have answered. Current state:", quizStateRef.current);
      
      // Set a 3-second countdown for all players before next question
      setWaitingCountdown(3);
      
      // If in WAITING state and host, we'll let the countdown handle the next question request
      if (isHost) {
        console.log("Host will request next question after countdown");
      } else {
        console.log("Non-host player waiting for next question from server");
      }
    };
    
    const newQuestionHandler = (data: any) => {
      console.log("New question received:", data);
      
      // Only update if we have question data
      if (data && data.question) {
        // Get the question index from the received data
        // This is crucial - the server sends the index we should move to
        const newIndex = data.index || 0;
        console.log(`Moving to question index: ${newIndex}`);
        
        // Update the current question index
        setCurrentQuestionIndex(newIndex);
        currentQuestionIndexRef.current = newIndex;
        
        // Reset question state and move to QUESTION state
        resetQuestionState();
        setQuizState(QuizState.QUESTION);
        quizStateRef.current = QuizState.QUESTION;
      }
    };
    
    const gameOverHandler = (data: any) => {
      console.log("Game over event received:", data);
      
      // Save final results to local storage with complete player data FIRST
      try {
        // If we have full data from server, use that
        if (data && data.players) {
          localStorage.setItem(`quiz_results_${lobbyCode}`, JSON.stringify(data));
        } 
        // Otherwise save what we have locally
        else {
          localStorage.setItem(`quiz_results_${lobbyCode}`, JSON.stringify({
            players: players,
            lobbyCode: lobbyCode,
            totalQuestions: allQuestions.length
          }));
        }
      } catch (e) {
        console.error("Failed to save results to local storage:", e);
      }
      
      // Immediately trigger navigation without changing state to avoid render errors
      navigate(`/multiplayer/results/${lobbyCode}`, { replace: true });
      
      // We don't need to update state since we're navigating away
      // This prevents any unnecessary renders that might cause errors
    };

    const errorHandler = (data: any) => {
      console.error("Socket error:", data);
      // Show toast with error
      toast({
        variant: "destructive",
        title: "Error",
        description: data.message || "There was an error with the game server"
      });
    };
    
    // Register all socket event listeners
    const cleanupPlayerAnswered = socketService.on("player_answered", playerAnsweredHandler);
    const cleanupAllAnswersIn = socketService.on("all_answers_in", allAnswersInHandler);
    const cleanupNewQuestion = socketService.on("new_question", newQuestionHandler);
    const cleanupGameOver = socketService.on("game_over", gameOverHandler);
    const cleanupError = socketService.on("error", errorHandler);
    
    // Initialize quiz
    fetchQuizData();
    
    // Make sure we clean up all event handlers on unmount
    return () => {
      cleanupPlayerAnswered();
      cleanupAllAnswersIn();
      cleanupNewQuestion();
      cleanupGameOver();
      cleanupError();
    };
  }, [lobbyCode, playerName, playerId, navigate]);

  // A simple spinner component for loading states
  const Spinner = () => (
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white"></div>
  );

  // A simple progress bar component
  const ProgressBar = ({ value, color = "from-violet-500 to-indigo-500" }: { value: number, color?: string }) => (
    <div className="w-full bg-white/10 rounded-full h-2.5">
      <div 
        className={`bg-gradient-to-r ${color} h-2.5 rounded-full transition-all duration-300 ease-out`} 
        style={{ width: `${value}%` }}
      ></div>
    </div>
  );

  // Render quiz by state
  const renderContent = () => {
    switch (quizState) {
      case QuizState.LOADING:
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <Spinner />
            <p className="text-white mt-4">Loading quiz...</p>
          </div>
        );
        
      case QuizState.QUESTION:
        if (!allQuestions[currentQuestionIndex]) return null;
        
        const currentQuestion = allQuestions[currentQuestionIndex];
        
        return (
          <div className="relative w-full h-full">
            {/* Player scoreboard (top left) */}
            <div className="absolute top-4 left-4 bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-white/10 z-10">
              <div className="flex items-center text-white mb-2">
                <span className="text-sm font-semibold">Players</span>
              </div>
              <div className="max-h-[150px] overflow-y-auto">
                {players
                  .sort((a, b) => b.score - a.score)
                  .map((player) => (
                    <div 
                      key={player.id} 
                      className={`flex items-center justify-between py-1 px-2 rounded ${
                        player.name === playerName ? "bg-indigo-500/30" : ""
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="w-6 h-6 flex items-center justify-center mr-2">
                          {player.avatar}
                        </div>
                        <span className="text-sm font-medium truncate max-w-[100px]">
                          {player.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-indigo-300">
                        {player.score}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Timer (top right) */}
            <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-white/10 z-10">
              <div className="flex items-center text-white mb-2">
                <span className="text-sm font-semibold">
                  Time: {Math.max(0, Math.floor(countdown))}s
                </span>
              </div>
              <ProgressBar 
                value={(countdown / gameSettings.timePerQuestion) * 100} 
                color={countdown < 5 ? "from-red-500 to-orange-500" : "from-green-500 to-emerald-500"}
              />
            </div>
            
            {/* Quiz progress (top center) */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-white/10 z-10">
              <div className="text-center text-white">
                <span className="text-sm font-semibold">
                  Question {currentQuestionIndex + 1} of {allQuestions.length}
                </span>
              </div>
              <ProgressBar value={((currentQuestionIndex + 1) / allQuestions.length) * 100} />
            </div>
            
            {/* Question */}
            <div className="quiz-container">
              <QuizQuestion
                question={{
                  question: currentQuestion.question,
                  options: currentQuestion.options,
                  correct_answer: currentQuestion.correct_answer,
                  image: currentQuestion.image
                }}
                userAnswer={userAnswer}
                answered={answered}
                answerAnimation={showAnswerAnimation}
                countdown={countdown}
                handleAnswer={handleAnswer}
              />
            </div>
          </div>
        );
        
      case QuizState.WAITING:
        return (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="mb-6 text-center">
              {isCorrect ? (
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mb-4 inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20"
                >
                  <Check className="h-10 w-10 text-green-500" />
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mb-4 inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20"
                >
                  <X className="h-10 w-10 text-red-500" />
                </motion.div>
              )}
              
              <h2 className="text-3xl font-bold text-white mb-2">
                {isCorrect ? "Correct!" : "Incorrect!"}
              </h2>
              
              {isCorrect && (
                <div className="flex flex-col items-center mt-2">
                  <div className="bg-white/10 rounded-lg px-4 py-2 inline-block">
                    <span className="text-lg font-bold text-indigo-300">{score}</span>
                    <span className="text-white text-sm ml-1">points</span>
                  </div>
                  <p className="text-gray-300 text-sm mt-2">
                    {Math.floor(gameSettings.timePerQuestion - timeTaken)}s bonus time
                  </p>
                </div>
              )}
              
              {/* Countdown timer */}
              {waitingCountdown !== null && (
                <motion.div
                  key={waitingCountdown}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 mb-4"
                >
                  <div className="relative inline-flex items-center justify-center">
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
                    <div className="relative bg-indigo-500/30 text-white font-bold text-4xl w-16 h-16 rounded-full flex items-center justify-center">
                      {waitingCountdown}
                    </div>
                  </div>
                  <p className="text-white mt-2">Next question in...</p>
                </motion.div>
              )}
              
              {waitingCountdown === null && (
                <div className="mt-8 flex items-center justify-center">
                  <div className="animate-pulse mr-2 text-indigo-300 text-sm">Waiting for other players</div>
                  <Spinner />
                </div>
              )}
            </div>
            
            {/* Player Scoreboard */}
            <div className="w-full max-w-md bg-black/30 backdrop-blur-sm rounded-xl p-5 border border-white/10 shadow-xl">
              <div className="flex items-center text-white mb-4">
                <h3 className="text-xl font-semibold">Live Scoreboard</h3>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {players
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div 
                      key={player.id} 
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        player.name === playerName ? "bg-indigo-500/30" : "bg-white/10"
                      } transition-all duration-300`}
                    >
                      <div className="flex items-center">
                        <div className={`w-6 h-6 flex items-center justify-center mr-2 
                          ${index === 0 ? "text-yellow-400" : 
                            index === 1 ? "text-gray-300" : 
                            index === 2 ? "text-amber-700" : "text-gray-400"}`}>
                          {index + 1}
                        </div>
                        <div className="w-10 h-10 flex items-center justify-center text-xl rounded-full bg-white/10 mr-3">
                          {player.avatar}
                        </div>
                        <div>
                          <div className="flex items-center">
                            <span className="font-medium text-white">
                              {player.name}
                            </span>
                            {player.name === playerName && (
                              <span className="ml-2 bg-indigo-500/30 text-xs px-2 py-0.5 rounded-full text-white">You</span>
                            )}
                          </div>
                          <div className="flex items-center">
                            <span className="text-xs opacity-70 text-white">
                              {player.currentQuestion}/{allQuestions.length} answered
                            </span>
                            {player.currentQuestion > currentQuestionIndex && (
                              <span className="ml-2 text-xs text-green-400">Ready for next question</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xl font-bold text-indigo-300">
                        {player.score}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-white">Something went wrong!</p>
          </div>
        );
    }
  };

  return (
    <div className="quiz-background">
      <div className="quiz-gradient-overlay" />
      <div className="quiz-radial-overlay-1" />
      <div className="quiz-radial-overlay-2" />
      <div className="quiz-radial-overlay-3" />
      
      {renderContent()}
    </div>
  );
};

export default MultiplayerQuiz;
