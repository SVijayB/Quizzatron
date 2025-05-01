import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Trophy, Timer, Sparkles, Award, Users } from "lucide-react";

interface QuizQuestion {
  index?: number;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  image?: string;
}

interface QuizResult {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  score: number;
  timeRemaining: number;
}

interface PlayerScore {
  name: string;
  avatar: string;
  score: number;
  answeredQuestions: number;
}

// Constants
const QUESTION_TIMEOUT = 10; // 10 seconds per question
const COUNTDOWN_START = 3; // 3 second countdown before quiz starts

const Quiz = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Main quiz state
  const [quizData, setQuizData] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMEOUT);
  const [countdownTime, setCountdownTime] = useState(COUNTDOWN_START);
  const [isQuizStarted, setIsQuizStarted] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  
  // Animation states
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState<"correct" | "incorrect">("correct");
  
  // Multiplayer state
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [playerAvatar, setPlayerAvatar] = useState("");
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  
  // Background animation states
  const [backgroundAnimation, setBackgroundAnimation] = useState("");

  // Add loading state
  const [isFinishing, setIsFinishing] = useState(false);

  // Initialize quiz data
  useEffect(() => {
    try {
      // Check if multiplayer
      const multiplayerData = localStorage.getItem("multiplayerQuizData");
      const localQuizData = localStorage.getItem("quizData");
      
      if (multiplayerData) {
        const parsedData = JSON.parse(multiplayerData);
        setQuizData(processQuizData(parsedData.questions || parsedData));
        setIsMultiplayer(true);
        setPlayerName(localStorage.getItem("playerName") || "Player");
        setPlayerAvatar(localStorage.getItem("playerAvatar") || "🐶");
        
        // Initialize player scores if available
        if (parsedData.players) {
          setPlayerScores(parsedData.players.map((player: any) => ({
            name: player.name,
            avatar: player.avatar || "👤",
            score: 0,
            answeredQuestions: 0
          })));
        }
      } else if (localQuizData) {
        const parsedData = JSON.parse(localQuizData);
        setQuizData(processQuizData(parsedData));
      } else {
        // No quiz data found
        toast({
          title: "Error",
          description: "No quiz data found. Returning to home page.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      
      // Start countdown
      startCountdown();
    } catch (error) {
      console.error("Error initializing quiz:", error);
      toast({
        title: "Error",
        description: "Failed to load quiz data. Returning to home page.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [navigate, toast]);
  
  // Process quiz data into a consistent format
  const processQuizData = (data: any): QuizQuestion[] => {
    let questions: any[] = [];
    
    if (Array.isArray(data)) {
      questions = data;
    } else if (data.questions && Array.isArray(data.questions)) {
      questions = data.questions;
    } else if (data.results && Array.isArray(data.results)) {
      questions = data.results;
    } else {
      throw new Error("Invalid quiz data format");
    }
    
    return questions.map((q, index) => ({
      index: index,
      question: q.question || `Question ${index + 1}`,
      options: Array.isArray(q.options) ? q.options : [],
      correct_answer: q.correct_answer || "",
      difficulty: q.difficulty || "medium",
      image: q.image || undefined
    }));
  };
  
  // Start countdown before quiz begins
  const startCountdown = useCallback(() => {
    const timer = setInterval(() => {
      setCountdownTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsQuizStarted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Timer effect - runs during active quiz
  useEffect(() => {
    if (!isQuizStarted || isRevealed) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(timer);
          handleTimeOut();
          return 0;
        }
        return prev - 0.1;
      });
    }, 100); // Update every 100ms for smoother timer animation
    
    return () => clearInterval(timer);
  }, [isQuizStarted, isRevealed]);
  
  // Handle timeout (no answer selected)
  const handleTimeOut = () => {
    if (!quizData[currentQuestion]) return;
    
    setIsRevealed(true);
    setShowFeedback(true);
    setFeedbackType("incorrect");
    setFeedbackMessage("Time's up!");
    
    // Update results
    const currentQ = quizData[currentQuestion];
    updateResults(currentQ, null, 0);
    
    // Move to next question after delay
    setTimeout(() => {
      if (currentQuestion < quizData.length - 1) {
        moveToNextQuestion();
      } else {
        finishQuiz();
      }
    }, 1500);
  };
  
  // Handle answer selection
  const handleAnswerSelect = (option: string) => {
    if (isRevealed) return;
    
    const currentQ = quizData[currentQuestion];
    setSelectedAnswer(option);
    setIsRevealed(true);
    
    const isCorrect = option === currentQ.correct_answer;
    const pointsEarned = Math.ceil(isCorrect ? timeLeft : 0);
    
    // Visual feedback
    setShowFeedback(true);
    setFeedbackType(isCorrect ? "correct" : "incorrect");
    setFeedbackMessage(isCorrect ? `+${pointsEarned} points!` : "Incorrect!");
    
    // Update results
    updateResults(currentQ, option, pointsEarned);
    
    // Celebration effect for correct answer
    if (isCorrect) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      setBackgroundAnimation("correct-answer");
    } else {
      setBackgroundAnimation("incorrect-answer");
    }
    
    // Move to next question after delay
    setTimeout(() => {
      if (currentQuestion < quizData.length - 1) {
        moveToNextQuestion();
      } else {
        finishQuiz(option); // Pass the selected option directly
      }
    }, 1500);
  };
  
  // Update results with the current answer
  const updateResults = (question: QuizQuestion, answer: string | null, points: number) => {
    const correctOptionText = question.options.find(
      opt => opt.charAt(0) === question.correct_answer
    )?.slice(3) || "";
    
    const selectedOptionText = answer ? 
      question.options.find(opt => opt.charAt(0) === answer)?.slice(3) || "" : 
      "Unanswered";
    
    const newResult: QuizResult = {
      question: question.question,
      userAnswer: selectedOptionText,
      correctAnswer: correctOptionText,
      isCorrect: answer === question.correct_answer,
      score: points,
      timeRemaining: timeLeft
    };
    
    setQuizResults(prev => [...prev, newResult]);
    setTotalScore(prev => prev + points);
    
    // Update multiplayer scores if applicable
    if (isMultiplayer) {
      setPlayerScores(prev => 
        prev.map(player => 
          player.name === playerName 
            ? { ...player, score: player.score + points, answeredQuestions: player.answeredQuestions + 1 }
            : player
        )
      );
      
      // TODO: Send score update to server for multiplayer
      // broadcastScoreUpdate(playerName, points);
    }
  };
  
  // Move to next question
  const moveToNextQuestion = () => {
    setIsTransitioning(true);
    setShowFeedback(false);
    setBackgroundAnimation("");
    
    setTimeout(() => {
      setCurrentQuestion(prev => prev + 1);
      setTimeLeft(QUESTION_TIMEOUT);
      setIsRevealed(false);
      setSelectedAnswer(null);
      setIsTransitioning(false);
    }, 500);
  };
  
  // Finish quiz and navigate to results
  const finishQuiz = (finalAnswer?: string) => {
    // Show the finishing state
    setIsFinishing(true);
    
    // Use the passed answer or the state value
    const lastSelectedAnswer = finalAnswer || selectedAnswer;
    
    // Create a copy of the current results
    let finalResults = [...quizResults];
    let finalScore = totalScore;
    
    // Check if we need to add the last question
    if (quizResults.length < quizData.length) {
      console.log(`Ensuring all questions are included in results. Current results: ${quizResults.length}, Total questions: ${quizData.length}`);
      
      // Specifically handle the last question's result
      const lastQuestion = quizData[currentQuestion];
      const correctOptionText = lastQuestion.options.find(
        opt => opt.charAt(0) === lastQuestion.correct_answer
      )?.slice(3) || "";
      
      const selectedOptionText = lastSelectedAnswer ? 
        lastQuestion.options.find(opt => opt.charAt(0) === lastSelectedAnswer)?.slice(3) || "" : 
        "Unanswered";
      
      const isCorrect = lastSelectedAnswer === lastQuestion.correct_answer;
      const points = isCorrect ? Math.ceil(timeLeft) : 0;
      
      // Create a result for the last question
      const lastQuestionResult: QuizResult = {
        question: lastQuestion.question,
        userAnswer: selectedOptionText,
        correctAnswer: correctOptionText,
        isCorrect: isCorrect,
        score: points,
        timeRemaining: timeLeft
      };
      
      // Add the missing question to our final results
      finalResults = [...finalResults, lastQuestionResult];
      
      // Update the total score if needed
      if (isCorrect) {
        finalScore += points;
      }
    }
    
    // Log the final results to verify
    console.log(`Final results length: ${finalResults.length}`);
    console.log("Last result:", finalResults[finalResults.length - 1]);
    
    // Save final results to localStorage
    localStorage.setItem("quizResults", JSON.stringify(finalResults));
    localStorage.setItem("totalScore", finalScore.toString());
    
    // For multiplayer, save player scores too
    if (isMultiplayer) {
      // Update player score one last time if needed
      if (quizResults.length < quizData.length && lastSelectedAnswer === quizData[currentQuestion].correct_answer) {
        const additionalPoints = Math.ceil(timeLeft);
        const updatedScores = playerScores.map(player => 
          player.name === playerName 
            ? { 
                ...player, 
                score: player.score + additionalPoints, 
                answeredQuestions: player.answeredQuestions + 1 
              }
            : player
        );
        setPlayerScores(updatedScores);
        localStorage.setItem("playerScores", JSON.stringify(updatedScores));
      } else {
        localStorage.setItem("playerScores", JSON.stringify(playerScores));
      }
    }
    
    // Navigate to results page after a short delay to ensure everything is saved
    setTimeout(() => {
      navigate(isMultiplayer ? "/multiplayer/results" : "/results");
    }, 1500);
  };
  
  // Render countdown screen
  if (!isQuizStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-800">
        {/* Background elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f3ed0,#8b5cf6)] opacity-30" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#1a1a2e_100%)]" />
          
          {/* Animated floating particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-white/10 backdrop-blur-md"
                style={{
                  width: Math.random() * 15 + 5,
                  height: Math.random() * 15 + 5,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -40, 0],
                  x: [0, Math.random() * 20 - 10, 0],
                  opacity: [0.1, 0.3, 0.1]
                }}
                transition={{
                  duration: Math.random() * 5 + 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        </div>
        
        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-lg mx-auto px-4 text-center">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-10">
              Get Ready for Your Quiz!
            </h2>
            
            <div className="relative mb-14">
              {/* Countdown circle */}
              <div className="w-36 h-36 md:w-48 md:h-48 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center mx-auto relative border border-white/20 shadow-lg">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={countdownTime}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-6xl md:text-7xl font-bold text-white"
                  >
                    {countdownTime}
                  </motion.div>
                </AnimatePresence>
                
                {/* Animated ring - slowed down */}
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
                
                {/* Second animated ring (offset timing) - slowed down */}
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
              
              {/* Pulse effect - slowed down */}
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
            </div>
            
            <motion.p 
              className="mt-4 text-white/80 text-lg md:text-xl font-medium tracking-wide"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {isMultiplayer ? "Multiplayer Quiz Starting..." : "Quiz Starting Soon..."}
            </motion.p>
            
            <motion.div
              className="mt-8 bg-white/10 backdrop-blur-md rounded-lg px-6 py-3 inline-flex items-center border border-white/10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Trophy className="w-5 h-5 text-amber-300 mr-2" />
              <span className="text-white/90">Good luck!</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }
  
  // Handle no quiz data or invalid state
  if (quizData.length === 0 || !quizData[currentQuestion]) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-800 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Quiz Error</h2>
          <p>Unable to load the quiz. Please try again.</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }
  
  // Current question data
  const question = quizData[currentQuestion];
  const questionProgress = ((currentQuestion + 1) / quizData.length) * 100;
  const timeProgress = (timeLeft / QUESTION_TIMEOUT) * 100;

  return (
    <AnimatePresence mode="wait">
      <div 
        className="min-h-screen relative overflow-hidden bg-[#1a1a2e]"
      >
        {/* Background elements - similar to homepage */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f3ed0,#8b5cf6)] opacity-50" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#1a1a2e_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,#4f3ed0,transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_0%_300px,#8b5cf6,transparent)]" />
          <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
          
          {/* Feedback color overlay - only appears when answering */}
          {backgroundAnimation && (
            <div className={`absolute inset-0 transition-opacity duration-500 ${
              backgroundAnimation === "correct-answer" 
                ? "bg-green-500/10" 
                : "bg-red-500/10"
            }`} />
          )}
          
          {/* Animated floating particles - slowed down and smoother */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-white/10 backdrop-blur-md"
                style={{
                  width: Math.random() * 15 + 5,
                  height: Math.random() * 15 + 5,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -40, 0],
                  x: [0, Math.random() * 20 - 10, 0],
                  opacity: [0.1, 0.2, 0.1]
                }}
                transition={{
                  duration: Math.random() * 15 + 25, // Much slower animation
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          
          {/* Floating quiz-related icons - slowed down */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div 
              animate={{
                y: [0, -10, 0],
                x: [0, 3, 0],
                rotate: [0, 3, 0],
                transition: {
                  duration: 6, // Slower movement
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
                  duration: 7.5, // Slower movement
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
                  duration: 8, // Slower movement
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
                  duration: 7, // Slower movement
                  repeat: Infinity,
                  repeatType: "mirror",
                }
              }}
              className="absolute right-[15%] bottom-[25%] text-white/10 text-4xl"
            >
              <Award className="w-9 h-9" />
            </motion.div>
          </div>
        </div>
        
        {/* Top bar with progress and score/time */}
        <motion.div 
          className="relative z-10 pt-4 px-4 lg:px-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4">
              {/* Question progress */}
              <div className="flex items-center text-white mb-2 md:mb-0">
                <span className="bg-white/10 backdrop-blur-sm px-3 py-1 rounded-lg text-sm">
                  Question {currentQuestion + 1} of {quizData.length}
                </span>
              </div>
              
              {/* Score display - larger and more prominent */}
              <div className="flex items-center space-x-4">
                <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg flex items-center">
                  <Timer className="w-5 h-5 text-amber-300 mr-2" />
                  <span className="text-white text-base font-medium">{Math.ceil(timeLeft)}s</span>
                </div>
                
                <div className="bg-gradient-to-r from-violet-600/70 to-indigo-600/70 backdrop-blur-sm px-5 py-2.5 rounded-lg flex items-center shadow-lg border border-white/10">
                  <Trophy className="w-5 h-5 text-amber-300 mr-2" />
                  <span className="text-white text-lg font-bold">{totalScore} pts</span>
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
                    timeLeft > QUESTION_TIMEOUT * 0.6
                      ? "bg-emerald-500" 
                      : timeLeft > QUESTION_TIMEOUT * 0.3 
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${timeProgress}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Multiplayer scoreboard (if multiplayer mode) */}
        {isMultiplayer && (
          <motion.div 
            className="relative z-10 px-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="max-w-6xl mx-auto mb-4">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3">
                <h3 className="text-xs font-medium text-white/70 mb-2 flex items-center">
                  <Users className="w-3 h-3 mr-1" /> Players
                </h3>
                <div className="flex flex-wrap gap-2">
                  {playerScores.map((player, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center space-x-2 px-2 py-1 rounded-lg ${
                        player.name === playerName ? "bg-violet-700/50 ring-1 ring-violet-400/30" : "bg-white/5"
                      }`}
                    >
                      <div className="w-6 h-6 flex items-center justify-center text-sm">
                        {player.avatar}
                      </div>
                      <span className="text-xs text-white">{player.name}</span>
                      <span className="text-xs font-medium text-amber-300">{player.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Main question card - now properly centered and sized */}
        <div className="flex items-center justify-center min-h-[calc(100vh-180px)] px-4 py-4 md:py-8">
          <motion.div
            key={`question-${currentQuestion}`}
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
                dangerouslySetInnerHTML={{ __html: question.question }}
              />

              {/* Optional image - only show when image exists and is not undefined/empty */}
              {question.image && question.image !== "undefined" && (
                <div className="mb-8 flex justify-center">
                  <img 
                    src={question.image} 
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
                {question.options.map((option, index) => {
                  const optionValue = option.charAt(0);
                  const optionText = option.slice(3); // Remove "A. " prefix
                  const isSelected = selectedAnswer === optionValue;
                  const isCorrect = question.correct_answer === optionValue;
                  const optionLabel = String.fromCharCode(65 + index); // A, B, C, D
                  
                  return (
                    <motion.button
                      key={index}
                      onClick={() => handleAnswerSelect(optionValue)}
                      disabled={isRevealed}
                      className={`
                        relative flex items-center text-left p-5 rounded-xl 
                        transition-all duration-200 
                        ${isRevealed && isCorrect 
                          ? "bg-green-600/90 text-white ring-2 ring-green-400/70" 
                          : isRevealed && isSelected 
                            ? "bg-red-600/80 text-white" 
                            : isSelected 
                              ? "bg-violet-600 text-white" 
                              : "bg-white/10 text-white hover:bg-white/20"
                        }
                        border border-white/5 hover:border-white/20
                      `}
                      whileHover={!isRevealed ? { 
                        scale: 1.03, 
                        boxShadow: "0 10px 25px -5px rgba(124, 58, 237, 0.5)",
                        borderColor: "rgba(255, 255, 255, 0.2)"
                      } : {}}
                      whileTap={!isRevealed ? { scale: 0.98 } : {}}
                    >
                      <div className={`
                        w-10 h-10 min-w-10 flex items-center justify-center rounded-full mr-4
                        ${isRevealed && isCorrect 
                          ? "bg-green-500" 
                          : isRevealed && isSelected 
                            ? "bg-red-500" 
                            : "bg-white/10"
                        }
                      `}>
                        <span className="text-md font-medium">
                          {optionLabel}
                        </span>
                      </div>
                      <span className="flex-1 text-lg" dangerouslySetInnerHTML={{ __html: optionText }} />
                      
                      {isRevealed && isCorrect && (
                        <Sparkles className="w-6 h-6 ml-3 text-green-200" />
                      )}
                      
                      {/* Enhanced shine effect on hover */}
                      {!isRevealed && (
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
                    <Award className="w-5 h-5 mr-2" />
                  ) : (
                    <Timer className="w-5 h-5 mr-2" />
                  )}
                  {feedbackMessage}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Finishing overlay */}
        <AnimatePresence>
          {isFinishing && (
            <motion.div
              className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <div className="w-16 h-16 border-4 border-t-violet-500 border-r-violet-500 border-b-violet-200 border-l-violet-200 rounded-full animate-spin mb-4 mx-auto"></div>
                <h2 className="text-2xl font-bold text-white mb-2">Generating Final Results</h2>
                <p className="text-white/70">Calculating your score...</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};

export default Quiz;
