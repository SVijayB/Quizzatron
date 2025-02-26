
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
  index: number;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  image: string;
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
    const data = localStorage.getItem("quizData");
    if (!data) {
      navigate("/");
      return;
    }
    
    const parsedData = JSON.parse(data);
    setQuizData(parsedData);
    
    // Initialize results array
    const initialResults = parsedData.map((question: QuizQuestion) => {
      const correctOption = question.options.find(
        (opt) => opt.charAt(0) === question.correct_answer
      );
      return {
        question: question.question,
        userAnswer: "Unanswered",
        correctAnswer: correctOption ? correctOption.slice(3) : "",
        isCorrect: false,
        score: 0
      };
    });
    setResults(initialResults);
  }, [navigate]);

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
    const correctOption = currentQuestionData.options.find(
      (opt) => opt.charAt(0) === currentQuestionData.correct_answer
    );

    // Update results first
    const newResults = [...results];
    newResults[currentQuestion] = {
      question: currentQuestionData.question,
      userAnswer: "Unanswered",
      correctAnswer: correctOption ? correctOption.slice(3) : "",
      isCorrect: false,
      score: 0
    };
    setResults(newResults);

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
    const isCorrect = option === currentQuestionData.correct_answer;
    // Give full points if answered before timer starts
    const score = isCorrect ? (timerStarted ? timeLeft : QUESTION_TIMEOUT) : 0;
    
    const selectedOption = currentQuestionData.options.find(
      (opt) => opt.charAt(0) === option
    );
    const correctOption = currentQuestionData.options.find(
      (opt) => opt.charAt(0) === currentQuestionData.correct_answer
    );

    // Update results first
    const newResults = [...results];
    newResults[currentQuestion] = {
      question: currentQuestionData.question,
      userAnswer: selectedOption ? selectedOption.slice(3) : "Unanswered",
      correctAnswer: correctOption ? correctOption.slice(3) : "",
      isCorrect: isCorrect,
      score: score
    };
    setResults(newResults);
    setTotalScore(prev => prev + score);
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

  if (!quizData.length) return null;

  const question = quizData[currentQuestion];
  const selectedAnswer = results[currentQuestion]?.userAnswer === "Unanswered" 
    ? null 
    : question.options.find(opt => opt.slice(3) === results[currentQuestion]?.userAnswer)?.charAt(0) || null;

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
            options={question.options}
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
