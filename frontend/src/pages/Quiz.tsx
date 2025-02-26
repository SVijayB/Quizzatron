import { useState, useEffect, useCallback } from "react";
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

const QUESTION_TIMEOUT = 10; // seconds

const Quiz = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [quizData, setQuizData] = useState<QuizQuestion[]>([]);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMEOUT);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [totalScore, setTotalScore] = useState(0);

  useEffect(() => {
    const data = localStorage.getItem("quizData");
    if (!data) {
      navigate("/");
      return;
    }
    setQuizData(JSON.parse(data));
  }, [navigate]);

  const proceedToNext = useCallback(() => {
    if (currentQuestion === quizData.length - 1) {
      const results = answers.map((answer, index) => {
        const question = quizData[index];
        const score = scores[index] || 0;
        if (!answer) {
          return {
            question: question.question,
            userAnswer: "Unanswered",
            correctAnswer: question.options.find(opt => opt.charAt(0) === question.correct_answer)?.slice(3) || "",
            isCorrect: false,
            score: 0
          };
        }
        const selectedOption = question.options.find(opt => opt.charAt(0) === answer) || "";
        const correctOption = question.options.find(opt => opt.charAt(0) === question.correct_answer) || "";
        return {
          question: question.question,
          userAnswer: selectedOption.slice(3),
          correctAnswer: correctOption.slice(3),
          isCorrect: answer === question.correct_answer,
          score
        };
      });
      localStorage.setItem("quizResults", JSON.stringify(results));
      localStorage.setItem("totalScore", totalScore.toString());
      navigate("/results");
    } else {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentQuestion(prev => prev + 1);
        setSelectedAnswer(null);
        setIsRevealed(false);
        setTimeLeft(QUESTION_TIMEOUT);
        setIsTransitioning(false);
      }, 500);
    }
  }, [currentQuestion, quizData.length, answers, navigate, scores, totalScore]);

  useEffect(() => {
    if (!selectedAnswer && !isRevealed) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsRevealed(true);
            setTimeout(proceedToNext, 1000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [selectedAnswer, isRevealed, proceedToNext]);

  const handleAnswer = (option: string) => {
    if (selectedAnswer || isRevealed) return;
    
    setSelectedAnswer(option);
    setIsRevealed(true);
    const isCorrect = option === quizData[currentQuestion].correct_answer;
    
    if (isCorrect) {
      const score = timeLeft;
      setScores(prev => {
        const newScores = [...prev];
        newScores[currentQuestion] = score;
        return newScores;
      });
      setTotalScore(prev => prev + timeLeft);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    setAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestion] = option;
      return newAnswers;
    });

    setTimeout(proceedToNext, 1000);
  };

  if (!quizData.length) return null;

  const question = quizData[currentQuestion];
  const correctAnswer = question.correct_answer;

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
            timeLeft={timeLeft}
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
            correctAnswer={correctAnswer}
            onSelectAnswer={handleAnswer}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default Quiz;
