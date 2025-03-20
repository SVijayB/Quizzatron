
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import { QuizQuestion } from "@/components/quiz/QuizQuestion";
import { QuizOptions } from "@/components/quiz/QuizOptions";
import { QuizBackground } from "@/components/quiz/QuizBackground";

interface QuizQuestion {
  index?: number;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  image?: string;
}

const QUESTION_TIMEOUT = 10;
const INITIAL_DELAY = 2; // 2 second delay before timer starts

const Quiz = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quizData, setQuizData] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMEOUT);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const [results, setResults] = useState<Array<{
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    score: number;
  }>>([]);

  // Load quiz data and initialize results
  useEffect(() => {
    try {
      const data = localStorage.getItem("quizData");
      if (!data) {
        navigate("/");
        return;
      }
      
      const parsedData = JSON.parse(data);
      console.log("Parsed quiz data:", parsedData);
      
      // Handle different response formats
      let questions: QuizQuestion[] = [];
      
      if (Array.isArray(parsedData)) {
        // Direct array of questions
        questions = parsedData;
      } else if (parsedData.questions && Array.isArray(parsedData.questions)) {
        // Object with questions array
        questions = parsedData.questions;
      } else if (parsedData.results && Array.isArray(parsedData.results)) {
        // OpenTDB format
        questions = parsedData.results;
      } else {
        throw new Error("Invalid quiz data format");
      }
      
      if (questions.length === 0) {
        throw new Error("No questions found in quiz data");
      }
      
      console.log("Processing questions:", questions);
      
      // Validate each question has required fields
      const validatedQuestions = questions.map((q, index) => {
        // Ensure each question has minimal required properties
        const validatedQuestion: QuizQuestion = {
          index: index,
          question: q.question || `Question ${index + 1}`,
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: q.correct_answer || "",
          difficulty: q.difficulty || "medium",
          image: q.image || undefined
        };
        
        // Log any potentially problematic questions
        if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
          console.warn(`Question ${index} has invalid options:`, q.options);
        }
        
        return validatedQuestion;
      });
      
      console.log("Validated questions:", validatedQuestions);
      setQuizData(validatedQuestions);
      
      // Initialize results array with safer access to correct answers
      const initialResults = validatedQuestions.map((question: QuizQuestion) => {
        // Handle potential undefined correct_answer
        if (!question.correct_answer || !Array.isArray(question.options) || question.options.length === 0) {
          console.error("Missing correct_answer or options in question:", question);
          return {
            question: question.question || "Unknown question",
            userAnswer: "Unanswered",
            correctAnswer: "Unknown",
            isCorrect: false,
            score: 0
          };
        }
        
        const correctOptionIndex = question.options.findIndex(
          (opt) => opt.charAt(0) === question.correct_answer
        );
        
        const correctOption = correctOptionIndex >= 0 ? 
          question.options[correctOptionIndex].slice(3) : 
          "Unknown";
        
        return {
          question: question.question,
          userAnswer: "Unanswered",
          correctAnswer: correctOption,
          isCorrect: false,
          score: 0
        };
      });
      
      setResults(initialResults);
    } catch (error) {
      console.error("Error parsing quiz data:", error);
      toast({
        title: "Error",
        description: "Failed to load quiz data. Returning to home page.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [navigate, toast]);

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

  const handleTimeOut = () => {
    const currentQuestionData = quizData[currentQuestion];
    
    if (!currentQuestionData) {
      console.error("No question data found for index:", currentQuestion);
      return;
    }
    
    const correctOption = Array.isArray(currentQuestionData.options) ? 
      currentQuestionData.options.find(
        (opt) => opt.charAt(0) === currentQuestionData.correct_answer
      ) : undefined;

    // Update results first
    const newResults = [...results];
    if (newResults[currentQuestion]) {
      newResults[currentQuestion] = {
        question: currentQuestionData.question,
        userAnswer: "Unanswered",
        correctAnswer: correctOption ? correctOption.slice(3) : "",
        isCorrect: false,
        score: 0
      };
      setResults(newResults);
    }

    // If it's the last question, save and finish
    if (currentQuestion === quizData.length - 1) {
      localStorage.setItem("quizResults", JSON.stringify(newResults));
      localStorage.setItem("totalScore", totalScore.toString());
      setTimeout(() => navigate("/results"), 1000);
    } else {
      setTimeout(moveToNextQuestion, 1000);
    }
  };

  const handleAnswer = (option: string) => {
    if (isRevealed) return;

    const currentQuestionData = quizData[currentQuestion];
    
    if (!currentQuestionData) {
      console.error("No question data found for index:", currentQuestion);
      return;
    }
    
    const isCorrect = option === currentQuestionData.correct_answer;
    // Give full points if answered before timer starts
    const score = isCorrect ? (timerStarted ? timeLeft : QUESTION_TIMEOUT) : 0;
    
    const selectedOption = Array.isArray(currentQuestionData.options) ? 
      currentQuestionData.options.find(
        (opt) => opt.charAt(0) === option
      ) : undefined;
      
    const correctOption = Array.isArray(currentQuestionData.options) ?
      currentQuestionData.options.find(
        (opt) => opt.charAt(0) === currentQuestionData.correct_answer
      ) : undefined;

    // Update results first
    const newResults = [...results];
    if (newResults[currentQuestion]) {
      newResults[currentQuestion] = {
        question: currentQuestionData.question,
        userAnswer: selectedOption ? selectedOption.slice(3) : "Unanswered",
        correctAnswer: correctOption ? correctOption.slice(3) : "",
        isCorrect: isCorrect,
        score: score
      };
      setResults(newResults);
      setTotalScore(prev => prev + score);
    }
    
    setIsRevealed(true);

    if (isCorrect) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    // If it's the last question, save and finish
    if (currentQuestion === quizData.length - 1) {
      localStorage.setItem("quizResults", JSON.stringify(newResults));
      localStorage.setItem("totalScore", (totalScore + score).toString());
      setTimeout(() => navigate("/results"), 1000);
    } else {
      setTimeout(moveToNextQuestion, 1000);
    }
  };

  const moveToNextQuestion = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentQuestion(prev => prev + 1);
      setTimeLeft(QUESTION_TIMEOUT);
      setIsRevealed(false);
      setTimerStarted(false);  // Reset timer started state for next question
      setIsTransitioning(false);
    }, 500);
  };

  if (quizData.length === 0) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Loading Quiz...</h2>
          <p>If this message persists, there might be an issue with the quiz data.</p>
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
          <button 
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-violet-500 rounded-lg hover:bg-violet-600 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }
  
  const selectedAnswer = results[currentQuestion]?.userAnswer === "Unanswered" 
    ? null 
    : Array.isArray(question.options) 
      ? question.options.find(opt => 
          opt.slice(3) === results[currentQuestion]?.userAnswer
        )?.charAt(0) || null
      : null;

  return (
    <AnimatePresence mode="wait">
      <div className="min-h-screen bg-[#1a1a2e] relative overflow-hidden">
        <QuizBackground />
        <motion.div 
          className="relative z-10 w-full max-w-6xl mx-auto pt-8 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <QuizProgress
            currentQuestion={currentQuestion}
            totalQuestions={quizData.length}
            timeLeft={timerStarted ? timeLeft : QUESTION_TIMEOUT}
            totalTime={QUESTION_TIMEOUT}
            totalScore={totalScore}
          />

          <QuizQuestion
            question={question.question}
            image={question.image}
          />

          <QuizOptions
            options={question.options || []}
            selectedAnswer={selectedAnswer}
            isRevealed={isRevealed}
            correctAnswer={question.correct_answer}
            onSelectAnswer={handleAnswer}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default Quiz;
