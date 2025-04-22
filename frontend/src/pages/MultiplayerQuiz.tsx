import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { apiService } from "@/services/apiService";
import { socketService } from "@/services/socketService";
import QuizQuestion from "@/components/QuizQuestion";
import QuizScoreboard from "@/components/QuizScoreboard";
import "./Quiz.css";

const MultiplayerQuiz = () => {
  const navigate = useNavigate();
  const { lobbyCode: urlLobbyCode } = useParams<{ lobbyCode: string }>();
  const lobbyCode = urlLobbyCode || "";
  const { playerName, playerId, gameSettings } = useMultiplayer();

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [answered, setAnswered] = useState<boolean>(false);
  const [answerAnimation, setAnswerAnimation] = useState<boolean>(false);
  const [timeTaken, setTimeTaken] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(gameSettings.timePerQuestion);
  const [timerRunning, setTimerRunning] = useState<boolean>(true);
  const [showScoreboard, setShowScoreboard] = useState<boolean>(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [questionIndex, setQuestionIndex] = useState<number>(0);

  const fetchGameState = async () => {
    try {
      console.log("Fetching game state for lobby:", lobbyCode);
      const data = await apiService.getGameState(lobbyCode);
      console.log("Game state received:", data);
      
      // Handle current question
      // Handle question data
      console.log("Received game state with questions:", data.questions, "and current_question:", data.current_question);
      
      // Check if we have questions array and a current_question index
      if (Array.isArray(data.questions) && data.questions.length > 0 && 
          typeof data.current_question === 'number' && data.current_question >= 0) {
        
        // Get the question object from the questions array using current_question index
        const questionObj = data.questions[data.current_question];
        console.log("Setting current question:", questionObj);
        
        if (questionObj) {
          setCurrentQuestion(questionObj);
          setQuestionIndex(data.current_question);
        }
      }
      
      // If processedQuestions exists (from API processing), use that directly
      if (data.processedQuestions && Array.isArray(data.processedQuestions) && 
          data.processedQuestions.length > 0 && typeof data.current_question === 'number') {
            
        const questionObj = data.processedQuestions[data.current_question];
        if (questionObj) {
          console.log("Using processed question:", questionObj);
          setCurrentQuestion(questionObj);
          setQuestionIndex(data.current_question);
        }
      }
      
      // Handle players
      if (data.players) {
        console.log("Setting players from API:", data.players);
        setPlayers(data.players);
      }
    } catch (error) {
      console.error("Error fetching game state:", error);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (timerRunning && countdown > 0) {
      intervalId = setInterval(() => {
        setCountdown((prevCountdown) => prevCountdown - 0.1);
        setTimeTaken((prevTimeTaken) => prevTimeTaken + 0.1);
      }, 100);
    } else if (countdown <= 0) {
      setTimerRunning(false);
      handleAnswer("");
    }

    return () => clearInterval(intervalId);
  }, [timerRunning, countdown]);

  const handleAnswer = (answer: string) => {
    if (answered) return;

    setAnswered(true);
    setUserAnswer(answer);
    setTimerRunning(false);

    const isCorrect = answer === currentQuestion.correct_answer;
    const baseScore = 100;
    const timeBonus = Math.max(0, 50 - timeTaken);
    const score = isCorrect ? baseScore + timeBonus : 0;

    socketService.submitAnswer(
      lobbyCode,
      playerName,
      questionIndex,
      answer,
      timeTaken,
      isCorrect,
      score
    );

    setAnswerAnimation(true);
  };

  const handleNextQuestion = () => {
    setShowScoreboard(false);
    socketService.requestNextQuestion(lobbyCode);
  };

  useEffect(() => {
    if (!playerName || !playerId || !lobbyCode) {
      navigate("/multiplayer");
      return;
    }
    
    const newQuestionHandler = (data: any) => {
      console.log("New question received:", data);
      
      // Handle the structure from the socket event
      let questionData;
      if (data.question) {
        // If the data has a question property (from socket)
        questionData = data.question;
        console.log("Question from socket:", questionData);
        if (data.index !== undefined) {
          setQuestionIndex(data.index);
        }
      } else {
        // Direct question object
        questionData = data;
        console.log("Direct question data:", questionData);
      }
      
      // Ensure we have options as an array
      if (questionData && !Array.isArray(questionData.options)) {
        // Try to extract options from the first elements of the question that match option pattern
        const optionsPattern = /^[A-D]\)\s/;
        const options = questionData.options ? 
          [questionData.options] : 
          Object.values(questionData).filter(val => 
            typeof val === 'string' && optionsPattern.test(val)
          );
        
        console.log("Extracted options:", options);
        
        // If we found options, use them
        if (options.length > 0) {
          questionData.options = options;
        }
      }
      
      setCurrentQuestion(questionData);
      setUserAnswer("");
      setAnswered(false);
      setAnswerAnimation(false);
      setTimeTaken(0);
      setCountdown(gameSettings.timePerQuestion);
      
      setTimerRunning(true);
    };
    
    const playerAnsweredHandler = (data: any) => {
      console.log("Player answered:", data);
      setPlayers(prevPlayers => {
        return prevPlayers.map(player => {
          if (player.name === data.player_name) {
            return {
              ...player,
              currentQuestion: data.question_index + 1,
              score: data.score,
            };
          }
          return player;
        });
      });
    };
    
    const allAnswersInHandler = (data: any) => {
      console.log("All answers in:", data);
      setShowScoreboard(true);
      setTimerRunning(false);
    };
    
    const scoreboardHandler = (data: any) => {
      console.log("Scoreboard received:", data);
      if (data.players) {
        setPlayers(data.players);
      }
    };
    
    const gameOverHandler = (data: any) => {
      console.log("Game over:", data);
      navigate(`/multiplayer/results/${lobbyCode}`);
    };
    
    const cleanupNewQuestion = socketService.on("new_question", newQuestionHandler);
    const cleanupPlayerAnswered = socketService.on("player_answered", playerAnsweredHandler);
    const cleanupAllAnswersIn = socketService.on("all_answers_in", allAnswersInHandler);
    const cleanupScoreboard = socketService.on("scoreboard", scoreboardHandler);
    const cleanupGameOver = socketService.on("game_over", gameOverHandler);
    
    fetchGameState();
    
    return () => {
      cleanupNewQuestion();
      cleanupPlayerAnswered();
      cleanupAllAnswersIn();
      cleanupScoreboard();
      cleanupGameOver();
      
      socketService.removeAllListeners("new_question");
      socketService.removeAllListeners("player_answered");
      socketService.removeAllListeners("all_answers_in");
      socketService.removeAllListeners("scoreboard");
      socketService.removeAllListeners("game_over");
    };
  }, [lobbyCode, playerName, playerId, navigate, gameSettings.timePerQuestion]);

  return (
    <div className="quiz-background">
      <div className="quiz-gradient-overlay" />
      <div className="quiz-radial-overlay-1" />
      <div className="quiz-radial-overlay-2" />
      <div className="quiz-radial-overlay-3" />

      {showScoreboard && currentQuestion ? (
        <QuizScoreboard
          players={players}
          correctAnswer={currentQuestion.correct_answer}
          userAnswer={userAnswer}
          onNextQuestion={handleNextQuestion}
        />
      ) : (
        currentQuestion && (
          <motion.div
            className="quiz-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <QuizQuestion
              question={currentQuestion}
              userAnswer={userAnswer}
              answered={answered}
              answerAnimation={answerAnimation}
              countdown={countdown}
              handleAnswer={handleAnswer}
            />
          </motion.div>
        )
      )}
    </div>
  );
};

export default MultiplayerQuiz;
