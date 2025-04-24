import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { apiService } from "@/services/apiService";
import { socketService } from "@/services/socketService";
import { toast } from "@/components/ui/use-toast";
import confetti from "canvas-confetti";
import QuizQuestion from "@/components/QuizQuestion";
import { Check, X, Trophy, Timer, Users, Award, Sparkles } from "lucide-react";
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
  // State for feedback animation
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [feedbackType, setFeedbackType] = useState<"correct" | "incorrect">("correct");
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  
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
    setShowFeedback(false);
    setFeedbackMessage("");
  };

  // Calculate score based on the remaining time and multiplayer settings
  const calculateScore = (correct: boolean, timeLeft: number) => {
    if (!correct) return 0;
    
    // Calculate points based on the time per question setting
    // Higher time settings should result in higher potential scores
    // This ensures fair scoring across different time settings
    const timeRatio = timeLeft / gameSettings.timePerQuestion;
    const basePoints = Math.round(timeLeft);
    
    // Apply multiplier based on difficulty
    let difficultyMultiplier = 1;
    if (gameSettings.difficulty === "hard") {
      difficultyMultiplier = 1.5;
    } else if (gameSettings.difficulty === "easy") {
      difficultyMultiplier = 0.8;
    }
    
    // Calculate final score
    const finalScore = Math.round(basePoints * difficultyMultiplier);
    return finalScore;
  };

  // Calculate the maximum possible score
  const calculateMaxScore = () => {
    return gameSettings.timePerQuestion * allQuestions.length;
  };

  // Calculate progress percentage for score bar
  const calculateScorePercentage = (playerScore: number) => {
    const maxScore = calculateMaxScore();
    return maxScore > 0 ? (playerScore / maxScore) * 100 : 0;
  };

  // Handle answer selection with enhanced visual effects
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
    
    // Show feedback animation
    setShowAnswerAnimation(true);
    setShowFeedback(true);
    setFeedbackType(correct ? "correct" : "incorrect");
    setFeedbackMessage(correct ? `+${questionScore} points!` : "Incorrect!");
    
    // Play celebration effect for correct answer
    if (correct) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
    
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
    
    console.log("Setting up socket event listeners in MultiplayerQuiz");
    
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
        const newIndex = data.question_index || data.index || 0;
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
          localStorage.setItem("multiplayerResults", JSON.stringify(data.players || []));
        } 
        // Otherwise save what we have locally
        else {
          localStorage.setItem(`quiz_results_${lobbyCode}`, JSON.stringify({
            players: players,
            lobbyCode: lobbyCode,
            totalQuestions: allQuestions.length
          }));
          localStorage.setItem("multiplayerResults", JSON.stringify(players || []));
        }
      } catch (e) {
        console.error("Failed to save results to local storage:", e);
      }
      
      // Immediately trigger navigation without changing state to avoid render errors
      navigate(`/multiplayer/results/${lobbyCode}`, { replace: true });
    };

    const errorHandler = (data: any) => {
      console.error("Socket error:", data);
      
      // Ignore specific error messages related to game start
      if (data.message && (
          data.message.includes("Game has already started") || 
          data.message.includes("Failed to start game") ||
          data.message.includes("400"))) {
        console.log("Ignoring expected error during game initialization:", data.message);
        return;
      }
      
      // Show toast only for other errors
      toast({
        variant: "destructive",
        title: "Error",
        description: data.message || "There was an error with the game server"
      });
    };
    
    // Register all socket event listeners
    console.log("Registering socket event handlers");
    const cleanupPlayerAnswered = socketService.on("player_answered", playerAnsweredHandler);
    const cleanupAllAnswersIn = socketService.on("all_answers_in", allAnswersInHandler);
    const cleanupNewQuestion = socketService.on("new_question", newQuestionHandler);
    const cleanupGameOver = socketService.on("game_over", gameOverHandler);
    const cleanupError = socketService.on("error", errorHandler);
    
    // Initialize quiz
    fetchQuizData();
    
    // Make sure we clean up all event handlers on unmount
    return () => {
      console.log("Cleaning up socket event handlers in MultiplayerQuiz");
      cleanupPlayerAnswered();
      cleanupAllAnswersIn();
      cleanupNewQuestion();
      cleanupGameOver();
      cleanupError();
    };
  }, [lobbyCode, playerName, playerId, navigate, isHost]);

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
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-400"></div>
            <p className="text-white mt-4 text-xl font-medium">Loading quiz...</p>
          </div>
        );
        
      case QuizState.QUESTION:
        if (!allQuestions[currentQuestionIndex]) return null;
        
        const currentQuestion = allQuestions[currentQuestionIndex];
        const questionProgress = ((currentQuestionIndex + 1) / allQuestions.length) * 100;
        const timeProgress = (countdown / gameSettings.timePerQuestion) * 100;
        
        return (
          <div className="relative min-h-screen w-full">
            {/* Animated floating quiz-related icons */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div 
                animate={{
                  y: [0, -10, 0],
                  x: [0, 3, 0],
                  rotate: [0, 3, 0],
                  transition: {
                    duration: 6,
                    repeat: Infinity,
                    repeatType: "mirror",
                  }
                }}
                className="absolute left-[15%] top-[20%] text-white/10 text-4xl"
              >
                <Trophy className="w-10 h-10" />
              </motion.div>
              <motion.div 
                animate={{
                  y: [0, -8, 0],
                  x: [0, -3, 0],
                  rotate: [0, -3, 0],
                  transition: {
                    duration: 7.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                  }
                }}
                className="absolute right-[20%] top-[15%] text-white/10 text-4xl"
              >
                <Timer className="w-12 h-12" />
              </motion.div>
              <motion.div 
                animate={{
                  y: [0, -9, 0],
                  x: [0, 3, 0],
                  rotate: [0, 3, 0],
                  transition: {
                    duration: 8,
                    repeat: Infinity,
                    repeatType: "mirror",
                  }
                }}
                className="absolute left-[10%] bottom-[20%] text-white/10 text-4xl"
              >
                <Sparkles className="w-8 h-8" />
              </motion.div>
              <motion.div 
                animate={{
                  y: [0, -7, 0],
                  x: [0, -3, 0],
                  rotate: [0, -3, 0],
                  transition: {
                    duration: 7,
                    repeat: Infinity,
                    repeatType: "mirror",
                  }
                }}
                className="absolute right-[15%] bottom-[25%] text-white/10 text-4xl"
              >
                <Award className="w-9 h-9" />
              </motion.div>
            </div>

            {/* Top bar with progress and timer only */}
            <div className="relative z-10 pt-4 px-4 lg:px-8">
              <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-2">
                  {/* Question progress */}
                  <div className="flex items-center text-white">
                    <span className="bg-white/10 backdrop-blur-sm px-3 py-1 rounded-lg text-sm">
                      Question {currentQuestionIndex + 1} of {allQuestions.length}
                    </span>
                  </div>
                  
                  {/* Timer */}
                  <div className="flex items-center space-x-4">
                    <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg flex items-center">
                      <Timer className="w-5 h-5 text-amber-300 mr-2" />
                      <span className="text-white text-base font-medium">{Math.ceil(countdown)}s</span>
                    </div>
                  </div>
                </div>
                
                {/* Progress bars */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                  <div className="bg-white/5 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                      style={{ width: `${questionProgress}%` }}
                    />
                  </div>
                  
                  <div className="bg-white/5 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-100 ${
                        countdown > gameSettings.timePerQuestion * 0.6
                          ? "bg-emerald-500" 
                          : countdown > gameSettings.timePerQuestion * 0.3 
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${timeProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Main question card */}
            <div className="flex items-center justify-center min-h-[calc(100vh-220px)] px-4 py-4 md:py-8 relative">
              {/* Player scoreboard moved to center of the quiz card on the left */}
              <motion.div 
                className="absolute top-[45%] left-4 -translate-y-1/2 z-10 w-48"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3">
                  <h3 className="text-xs font-medium text-white/70 mb-2 flex items-center">
                    <Users className="w-3 h-3 mr-1" /> Players
                  </h3>
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                    {players
                      .sort((a, b) => b.score - a.score)
                      .map((player, idx) => {
                        const scorePercentage = calculateScorePercentage(player.score);
                        return (
                          <div 
                            key={idx} 
                            className={`flex flex-col px-2 py-1.5 rounded-lg ${
                              player.name === playerName ? "bg-violet-700/50 ring-1 ring-violet-400/30" : "bg-white/5"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center">
                                <div className="w-5 h-5 flex items-center justify-center text-sm">
                                  {player.avatar}
                                </div>
                                <span className="text-xs text-white ml-1.5">
                                  {player.name}
                                  {player.currentQuestion > currentQuestionIndex && (
                                    <span className="ml-1.5 text-xs text-green-400">✓</span>
                                  )}
                                </span>
                              </div>
                              <span className="text-xs font-medium text-amber-300">{player.score}</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-700 ${
                                  player.name === playerName 
                                    ? "bg-gradient-to-r from-indigo-500 to-violet-500" 
                                    : "bg-gradient-to-r from-emerald-500 to-teal-500"
                                }`}
                                style={{ width: `${scorePercentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </motion.div>

              <motion.div
                key={`question-${currentQuestionIndex}`}
                className="relative z-10 w-full max-w-5xl mx-auto" 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 md:p-10 shadow-xl border border-white/10">
                  {/* Question text */}
                  <h2 
                    className="text-2xl md:text-3xl text-white mb-8 leading-relaxed text-center font-medium"
                    dangerouslySetInnerHTML={{ __html: currentQuestion.question }}
                  />

                  {/* Optional image - only show when image exists and is not undefined/empty */}
                  {currentQuestion.image && currentQuestion.image !== "undefined" && (
                    <div className="mb-8 flex justify-center">
                      <img 
                        src={currentQuestion.image} 
                        alt="Question" 
                        className="max-h-60 rounded-lg shadow-md"
                        onError={(e) => {
                          // Hide image container if image fails to load
                          (e.target as HTMLElement).parentElement?.classList.add('hidden');
                        }}
                      />
                    </div>
                  )}

                  {/* Answer options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {currentQuestion.options.map((option, index) => {
                      const optionValue = option.charAt(0);
                      const optionText = option.slice(3); // Remove "A. " prefix
                      const isSelected = userAnswer === optionValue;
                      const isCorrect = currentQuestion.correct_answer === optionValue;
                      const optionLabel = String.fromCharCode(65 + index); // A, B, C, D
                      
                      return (
                        <motion.button
                          key={index}
                          onClick={() => handleAnswer(optionValue)}
                          disabled={answered}
                          className={`
                            relative flex items-center text-left p-5 rounded-xl 
                            transition-all duration-200 
                            ${answered && isCorrect 
                              ? "bg-green-600/90 text-white ring-2 ring-green-400/70" 
                              : answered && isSelected 
                                ? "bg-red-600/80 text-white" 
                                : isSelected 
                                  ? "bg-violet-600 text-white" 
                                  : "bg-white/10 text-white hover:bg-white/20"
                            }
                            border border-white/5 hover:border-white/20
                          `}
                          whileHover={!answered ? { 
                            scale: 1.03, 
                            boxShadow: "0 10px 25px -5px rgba(124, 58, 237, 0.5)",
                            borderColor: "rgba(255, 255, 255, 0.2)"
                          } : {}}
                          whileTap={!answered ? { scale: 0.98 } : {}}
                        >
                          <div className={`
                            w-8 h-8 min-w-8 flex items-center justify-center rounded-full mr-3
                            ${answered && isCorrect 
                              ? "bg-green-500" 
                              : answered && isSelected 
                                ? "bg-red-500" 
                                : "bg-white/10"
                            }
                          `}>
                            <span className="text-md font-medium">
                              {optionLabel}
                            </span>
                          </div>
                          <span className="flex-1 text-lg" dangerouslySetInnerHTML={{ __html: optionText }} />
                          
                          {answered && isCorrect && (
                            <Sparkles className="w-5 h-5 ml-3 text-green-200" />
                          )}
                          
                          {/* Enhanced shine effect on hover */}
                          {!answered && (
                            <div className="absolute inset-0 rounded-xl overflow-hidden">
                              <div className="absolute inset-0 opacity-0 hover:opacity-20 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full hover:translate-x-full transition-all duration-1000 ease-in-out"></div>
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Feedback overlay */}
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className={`px-6 py-3 rounded-xl backdrop-blur-sm shadow-lg ${
                      feedbackType === "correct" 
                        ? "bg-green-500/30 text-white border border-green-400/50" 
                        : "bg-red-500/30 text-white border border-red-400/50"
                    }`}
                    initial={{ scale: 0.8, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.8, y: 20 }}
                  >
                    <div className="flex items-center text-xl font-bold">
                      {feedbackType === "correct" ? (
                        <>
                          <Award className="w-5 h-5 mr-2" />
                          {feedbackMessage}
                        </>
                      ) : (
                        <>
                          <Timer className="w-5 h-5 mr-2" />
                          {feedbackMessage}
                        </>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Waiting overlay - rearranged with scoreboard in center */}
            <AnimatePresence>
              {quizState === QuizState.WAITING && (
                <motion.div
                  className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Answer result at the top */}
                  <div className="mb-4 text-center">
                    {isCorrect ? (
                      <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="mb-2 inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 border border-green-400/30"
                      >
                        <Check className="h-8 w-8 text-green-400" />
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="mb-2 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 border border-red-400/30"
                      >
                        <X className="h-8 w-8 text-red-400" />
                      </motion.div>
                    )}
                    
                    <h2 className="text-xl font-bold text-white mb-2">
                      {isCorrect ? "Correct!" : "Incorrect!"}
                    </h2>
                    
                    {isCorrect && (
                      <div className="flex flex-col items-center">
                        <div className="bg-gradient-to-r from-violet-500/40 to-indigo-500/40 backdrop-blur-md rounded-lg px-3 py-1.5 inline-block border border-violet-400/30">
                          <span className="text-lg font-bold text-white">{score}</span>
                          <span className="text-indigo-200 text-xs ml-1">points</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Countdown REMOVED from here */}
                  
                  {/* Live Scoreboard MOVED to center */}
                  <div className="w-full max-w-md mb-4">
                    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-3 border border-white/10 shadow-xl">
                      <div className="flex items-center text-white mb-2">
                        <Trophy className="h-5 w-5 text-amber-400 mr-2" />
                        <h3 className="text-xl font-semibold">Live Scoreboard</h3>
                      </div>
                      
                      <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                        {players
                          .sort((a, b) => b.score - a.score)
                          .map((player, index) => {
                            const scorePercentage = calculateScorePercentage(player.score);
                            return (
                              <div 
                                key={player.id} 
                                className={`flex items-center p-2 rounded-lg ${
                                  player.name === playerName ? "bg-indigo-500/30" : "bg-white/10"
                                } transition-all duration-300`}
                              >
                                <div className={`w-5 h-5 flex items-center justify-center mr-1.5 
                                  ${index === 0 ? "text-yellow-400 text-sm" : 
                                    index === 1 ? "text-gray-300 text-sm" : 
                                    index === 2 ? "text-amber-700 text-sm" : "text-gray-400 text-sm"}`}>
                                  {index + 1}
                                </div>
                                <div className="w-7 h-7 flex items-center justify-center text-base rounded-full bg-white/10 mr-2">
                                  {player.avatar}
                                </div>
                                <div className="flex-grow mr-2">
                                  <div className="flex items-center">
                                    <span className="font-medium text-white text-xs">
                                      {player.name}
                                    </span>
                                    {player.name === playerName && (
                                      <span className="ml-1 text-[10px] bg-indigo-500/30 px-1 py-0.5 rounded-full text-white">You</span>
                                    )}
                                    {player.currentQuestion > currentQuestionIndex && (
                                      <span className="ml-1 text-[10px] font-medium text-green-400">✓</span>
                                    )}
                                  </div>
                                  <div className="flex items-center">
                                    <div className="flex-grow h-1.5 bg-white/10 rounded-full overflow-hidden mr-1.5">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-700 ${
                                          player.name === playerName 
                                            ? "bg-gradient-to-r from-indigo-500 to-violet-500" 
                                            : "bg-gradient-to-r from-emerald-500 to-teal-500"
                                        }`}
                                        style={{ width: `${scorePercentage}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] opacity-70 text-white whitespace-nowrap">
                                      {player.currentQuestion}/{allQuestions.length}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-sm font-bold text-indigo-300">
                                  {player.score}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  {/* Waiting message or countdown MOVED to bottom */}
                  <div>
                    {waitingCountdown !== null ? (
                      <motion.div
                        key={waitingCountdown}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="relative flex flex-col items-center"
                      >
                        <div className="w-20 h-20 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center mx-auto relative border border-white/20 shadow-lg">
                          <motion.div
                            key={waitingCountdown}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.5, opacity: 0 }}
                            transition={{ duration: 0.8 }}
                            className="text-3xl font-bold text-white"
                          >
                            {waitingCountdown}
                          </motion.div>
                          
                          {/* Animated rings */}
                          <motion.div 
                            className="absolute inset-0 rounded-full border-2 border-violet-400"
                            animate={{
                              scale: [1, 1.1],
                              opacity: [0.7, 0],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeOut",
                              repeatDelay: 0.2
                            }}
                          />
                        </div>
                        
                        <p className="text-white/80 text-sm font-medium tracking-wide text-center mt-2">
                          Next question in...
                        </p>
                      </motion.div>
                    ) : (
                      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex flex-col items-center">
                        <div className="w-8 h-8 border-2 border-t-violet-500 border-r-violet-500 border-b-violet-200 border-l-violet-200 rounded-full animate-spin mb-2"></div>
                        <h3 className="text-sm font-semibold text-white">Waiting for others...</h3>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
        
      case QuizState.WAITING:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-6">
            {/* Upper section with result feedback */}
            <div className="mb-8 text-center">
              {isCorrect ? (
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mb-6 inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500/20 border border-green-400/30"
                >
                  <Check className="h-12 w-12 text-green-400" />
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mb-6 inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-500/20 border border-red-400/30"
                >
                  <X className="h-12 w-12 text-red-400" />
                </motion.div>
              )}
              
              <h2 className="text-3xl font-bold text-white mb-3">
                {isCorrect ? "Correct!" : "Incorrect!"}
              </h2>
              
              {isCorrect && (
                <div className="flex flex-col items-center mt-2">
                  <div className="bg-gradient-to-r from-violet-500/40 to-indigo-500/40 backdrop-blur-md rounded-lg px-6 py-3 inline-block border border-violet-400/30">
                    <span className="text-2xl font-bold text-white">{score}</span>
                    <span className="text-indigo-200 text-sm ml-1">points</span>
                  </div>
                  <p className="text-gray-300 text-sm mt-2">
                    {Math.floor(gameSettings.timePerQuestion - timeTaken)}s bonus time
                  </p>
                </div>
              )}
            </div>

            {/* Center countdown with pulsing effect - Fixed alignment */}
            {waitingCountdown !== null && (
              <motion.div
                key={waitingCountdown}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="relative mb-8 flex flex-col items-center"
              >
                <div className="w-40 h-40 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center mx-auto relative border border-white/20 shadow-lg">
                  <motion.div
                    key={waitingCountdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-7xl font-bold text-white"
                  >
                    {waitingCountdown}
                  </motion.div>
                  
                  {/* Animated rings */}
                  <motion.div 
                    className="absolute inset-0 rounded-full border-4 border-violet-400"
                    animate={{
                      scale: [1, 1.1],
                      opacity: [0.7, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                      repeatDelay: 0.2
                    }}
                  />
                  
                  <motion.div 
                    className="absolute inset-0 rounded-full border-4 border-indigo-400"
                    animate={{
                      scale: [1, 1.2],
                      opacity: [0.5, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: 0.75,
                      repeatDelay: 0.2
                    }}
                  />
                </div>
                
                {/* Pulse effect */}
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full bg-violet-500/20 blur-xl"
                  animate={{
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                
                <p className="text-white/80 text-xl font-medium tracking-wide text-center mt-6">
                  Next question in...
                </p>
              </motion.div>
            )}
            
            {/* Waiting for other players message */}
            {waitingCountdown === null && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-t-violet-500 border-r-violet-500 border-b-violet-200 border-l-violet-200 rounded-full animate-spin mb-4"></div>
                <h3 className="text-xl font-semibold text-white mb-2">Waiting for other players...</h3>
                <p className="text-white/70 text-sm text-center">
                  Some players are still answering this question.
                </p>
              </div>
            )}
            
            {/* Player Scoreboard - Made larger */}
            <motion.div 
              className="w-full max-w-xl mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="bg-black/30 backdrop-blur-sm rounded-xl p-5 border border-white/10 shadow-xl">
                <div className="flex items-center justify-between text-white mb-4">
                  <div className="flex items-center">
                    <Trophy className="h-6 w-6 text-amber-400 mr-2" />
                    <h3 className="text-2xl font-semibold">Live Scoreboard</h3>
                  </div>
                </div>
                
                <div className="space-y-4 max-h-[320px] overflow-y-auto">
                  {players
                    .sort((a, b) => b.score - a.score)
                    .map((player, index) => {
                      const scorePercentage = calculateScorePercentage(player.score);
                      return (
                        <div 
                          key={player.id} 
                          className={`flex items-center p-4 rounded-lg ${
                            player.name === playerName ? "bg-indigo-500/30" : "bg-white/10"
                          } transition-all duration-300`}
                        >
                          <div className={`w-7 h-7 flex items-center justify-center mr-3 
                            ${index === 0 ? "text-yellow-400 text-xl" : 
                              index === 1 ? "text-gray-300" : 
                              index === 2 ? "text-amber-700" : "text-gray-400"}`}>
                            {index + 1}
                          </div>
                          <div className="w-12 h-12 flex items-center justify-center text-2xl rounded-full bg-white/10 mr-4">
                            {player.avatar}
                          </div>
                          <div className="flex-grow mr-4">
                            <div className="flex items-center mb-1">
                              <span className="font-medium text-white text-lg">
                                {player.name}
                              </span>
                              {player.name === playerName && (
                                <span className="ml-2 bg-indigo-500/30 text-xs px-2 py-0.5 rounded-full text-white">You</span>
                              )}
                            </div>
                            <div className="flex items-center">
                              <div className="flex-grow h-2.5 bg-white/10 rounded-full overflow-hidden mr-3">
                                <div 
                                  className={`h-full rounded-full transition-all duration-700 ${
                                    player.name === playerName 
                                      ? "bg-gradient-to-r from-indigo-500 to-violet-500" 
                                      : "bg-gradient-to-r from-emerald-500 to-teal-500"
                                  }`}
                                  style={{ width: `${scorePercentage}%` }}
                                />
                              </div>
                              <div className="flex items-center whitespace-nowrap">
                                <span className="text-xs opacity-70 text-white">
                                  {player.currentQuestion}/{allQuestions.length}
                                </span>
                                {player.currentQuestion > currentQuestionIndex && (
                                  <span className="ml-2 text-xs font-medium text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">Ready</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="text-2xl font-bold text-indigo-300">
                            {player.score}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.div>
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
