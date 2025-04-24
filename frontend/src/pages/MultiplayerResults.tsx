import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Trophy, ArrowLeft, HomeIcon, RefreshCw, Repeat, Share2, UserCheck } from "lucide-react";
import QuizLogo from "@/components/QuizLogo";
import EmojiAvatar from "@/components/EmojiAvatar";
import CursorEffect from "@/components/CursorEffect";
import { apiService } from "@/services/apiService";
import { useMultiplayer } from "@/contexts/MultiplayerContext";

interface MultiplayerResult {
  player_id: string;
  name: string;
  avatar: string;
  score: number;
  correct_answers: number;
  incorrect_answers: number;
  rank: number;
}

interface ResultsData {
  results: MultiplayerResult[];
  settings: {
    numQuestions: number;
    timePerQuestion: number;
    difficulty: string;
    topic: string | null;
    categories?: string[];
    allowSkipping?: boolean;
    model?: string;
  };
  quiz_id: string;
}

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
  const [quizId, setQuizId] = useState<string>("");
  const { playerId } = useMultiplayer();

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const storedResults = localStorage.getItem("multiplayerResults");
        if (storedResults) {
          const parsedResults = JSON.parse(storedResults);
          setResults(parsedResults);
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

  const handleReturnToLobby = () => {
    setGameSettings({
      numQuestions: 10,
      timePerQuestion: 15,
      difficulty: "medium",
      topic: null
    });
    setPlayers([]);
    navigate("/multiplayer");
  };

  const sortedResults = [...results].sort((a, b) => b.score - a.score);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1a1a2e]">
      <CursorEffect />

      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f3ed0,#8b5cf6)] opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#1a1a2e_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,#4f3ed0,transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_0%_300px,#8b5cf6,transparent)]" />
        <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 z-10">
        <Button
          onClick={() => navigate("/multiplayer")}
          variant="ghost"
          className="absolute top-4 left-4 text-white hover:bg-white/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Multiplayer
        </Button>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full max-w-2xl"
        >
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center mb-8"
          >
            <motion.div
              animate={{
                y: [0, -10, 0],
                rotate: [0, -5, 0, 5, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                repeatType: "mirror",
              }}
            >
              <QuizLogo size={60} color="white" className="mr-2" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-white">
                Multiplayer Results
              </h1>
              <div className="flex items-center gap-1 text-white/70">
                <Users className="h-3.5 w-3.5 text-purple-300" />
                <p>See how you stack up against your friends!</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)] overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-bl from-violet-500/30 via-transparent to-transparent w-40 h-40 rounded-bl-full"></div>

              <CardHeader className="pb-4 relative z-10">
                <CardTitle className="text-2xl text-white flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                  Final Standings
                </CardTitle>
                <CardDescription className="text-white/70">
                  Congratulations to our top players!
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 relative z-10">
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <RefreshCw className="animate-spin h-6 w-6 text-white" />
                    <span className="ml-2 text-white">Loading Results...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedResults.map((result, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-black/10 rounded-lg p-3"
                      >
                        <div className="flex items-center">
                          <span className="text-lg font-semibold text-white mr-3">
                            {index + 1}.
                          </span>
                          <span className="text-white text-xl mr-3">{result.avatar}</span>
                          <span className="text-white font-medium">{result.name}</span>
                        </div>
                        <div className="text-white font-bold text-lg">
                          {result.score} Points
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>

              <div className="p-4 relative z-10">
                <Button
                  onClick={handleReturnToLobby}
                  className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-medium py-3 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/25"
                >
                  Return to Multiplayer Menu
                </Button>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default MultiplayerResults;
