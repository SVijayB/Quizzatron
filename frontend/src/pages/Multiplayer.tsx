import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, ArrowRight, Users, Plus, ExternalLink, Trophy, Timer, Crown, Zap, Gamepad2, Share2, Heart, GitBranch } from "lucide-react";
import CursorEffect from "@/components/CursorEffect";
import QuizLogo from "@/components/QuizLogo";
import EmojiAvatar, { getRandomEmoji } from "@/components/EmojiAvatar";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Multiplayer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { storePlayerInfo } = useMultiplayer();
  const [activeView, setActiveView] = useState<"menu" | "create" | "join">("menu");
  const [playerName, setPlayerName] = useState("");
  const [lobbyCode, setLobbyCode] = useState("");
  const [isCreatingLobby, setIsCreatingLobby] = useState(false);
  const [isJoiningLobby, setIsJoiningLobby] = useState(false);
  const [avatarEmoji, setAvatarEmoji] = useState<string>(getRandomEmoji());
  
  const mockLeaderboard = [
    { name: "QuizMaster", score: 980, emoji: "🧠" },
    { name: "BrainGenius", score: 920, emoji: "🚀" },
    { name: "WisdomWiz", score: 850, emoji: "🦉" },
  ];
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.4 }
    }
  };
  
  const floatingIconVariants = {
    animate: (custom: number) => ({
      y: [0, -15, 0],
      x: custom % 2 === 0 ? [0, 5, 0] : [0, -5, 0],
      rotate: custom % 3 === 0 ? [0, 5, 0] : [0, -5, 0],
      transition: {
        duration: 3 + (custom % 3),
        repeat: Infinity,
        repeatType: "mirror" as const,
      }
    })
  };

  useEffect(() => {
    const randomEmoji = getRandomEmoji();
    setAvatarEmoji(randomEmoji);
    
    localStorage.setItem("playerEmoji", randomEmoji);
    
    const storedPlayerName = localStorage.getItem("playerName");
    if (storedPlayerName) {
      setPlayerName(storedPlayerName);
    }

    localStorage.removeItem("lobbyCode");
    localStorage.removeItem("isHost");
    localStorage.removeItem("multiplayerResults");
  }, []);

  const createLobby = async () => {
    if (!playerName.trim()) {
      toast({
        title: "Player Name Required",
        description: "Please enter your name before creating a lobby.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingLobby(true);

    try {
      const response = await fetch("http://127.0.0.1:5000/api/multiplayer/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          host_name: playerName,
          avatar: avatarEmoji,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create lobby");
      }

      const data = await response.json();
      console.log("Lobby created successfully:", data);
      
      storePlayerInfo(playerName, data.host_id, data.lobby_code, true, avatarEmoji);
      
      console.log("Navigating to:", `/multiplayer/lobby/${data.lobby_code}`);
      navigate(`/multiplayer/lobby/${data.lobby_code}`);
    } catch (error) {
      console.error("Error creating lobby:", error);
      toast({
        title: "Error",
        description: "Failed to create a lobby. Please try again.",
        variant: "destructive",
      });
      setIsCreatingLobby(false);
    }
  };

  const joinLobby = async () => {
    if (!playerName.trim()) {
      toast({
        title: "Player Name Required",
        description: "Please enter your name before joining a lobby.",
        variant: "destructive",
      });
      return;
    }

    if (!lobbyCode.trim()) {
      toast({
        title: "Lobby Code Required",
        description: "Please enter a valid lobby code.",
        variant: "destructive",
      });
      return;
    }

    setIsJoiningLobby(true);

    try {
      const response = await fetch("http://127.0.0.1:5000/api/multiplayer/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          player_name: playerName,
          lobby_code: lobbyCode,
          avatar: avatarEmoji,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Lobby Not Found",
            description: "The lobby code you entered doesn't exist or the game has already started.",
            variant: "destructive",
          });
          setIsJoiningLobby(false);
          return;
        }
        
        throw new Error("Failed to join lobby");
      }

      const data = await response.json();
      console.log("Successfully joined lobby:", data);
      
      storePlayerInfo(playerName, data.player_id, lobbyCode, false, avatarEmoji);
      
      console.log("Navigating to:", `/multiplayer/lobby/${lobbyCode}`);
      navigate(`/multiplayer/lobby/${lobbyCode}`);
    } catch (error) {
      console.error("Error joining lobby:", error);
      toast({
        title: "Error",
        description: "Failed to join the lobby. Please try again.",
        variant: "destructive",
      });
      setIsJoiningLobby(false);
    }
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
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            custom={1}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute left-[15%] top-[20%] text-white/20 text-4xl"
          >
            <Trophy className="w-10 h-10" />
          </motion.div>
          <motion.div 
            custom={2}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute right-[20%] top-[15%] text-white/20 text-4xl"
          >
            <Gamepad2 className="w-12 h-12" />
          </motion.div>
          <motion.div 
            custom={3}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute left-[10%] bottom-[20%] text-white/20 text-4xl"
          >
            <Zap className="w-8 h-8" />
          </motion.div>
          <motion.div 
            custom={4}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute right-[15%] bottom-[25%] text-white/20 text-4xl"
          >
            <Timer className="w-9 h-9" />
          </motion.div>
          <motion.div 
            custom={5}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute left-[25%] top-[50%] text-white/20 text-4xl"
          >
            <Crown className="w-7 h-7" />
          </motion.div>
          <motion.div 
            custom={6}
            variants={floatingIconVariants}
            animate="animate"
            className="absolute right-[25%] top-[40%] text-white/20 text-4xl"
          >
            <Heart className="w-6 h-6" />
          </motion.div>
        </div>
      </div>

      <div className="relative min-h-screen flex flex-col md:flex-row items-center justify-center p-4 z-10">
        <TooltipProvider>
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            className="absolute top-4 left-4 text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>

          <AnimatePresence mode="wait">
            <motion.div 
              key={activeView}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-md"
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
                  <QuizLogo 
                    size={60} 
                    color="white" 
                    className="mr-2" 
                  />
                </motion.div>
                <div>
                  <h1 className="text-4xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-white">
                    Multiplayer
                  </h1>
                  <div className="flex items-center gap-1 text-white/70">
                    <Users className="h-3.5 w-3.5 text-purple-300" />
                    <p>Challenge your friends in real-time</p>
                  </div>
                </div>
              </motion.div>

              {activeView === "menu" && (
                <motion.div variants={itemVariants}>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)] overflow-hidden">
                    <div className="absolute top-0 right-0 bg-gradient-to-bl from-violet-500/30 via-transparent to-transparent w-40 h-40 rounded-bl-full"></div>
                    
                    <CardHeader className="pb-4 relative z-10">
                      <CardTitle className="text-2xl text-white">Select an Option</CardTitle>
                      <CardDescription className="text-white/70">
                        Create a new lobby or join an existing one
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 relative z-10">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setActiveView("create")}
                            className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-medium py-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/25"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create a Lobby
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-indigo-900/90 border-violet-400/30 text-white">
                          Start a new game and invite your friends
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setActiveView("join")}
                            variant="outline"
                            className="w-full bg-white/10 hover:bg-white/15 text-white border-white/20 font-medium py-6 transition-all duration-300 hover:scale-[1.02] hover:border-violet-400/50"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Join a Lobby
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-indigo-900/90 border-violet-400/30 text-white">
                          Enter a code to join an existing game
                        </TooltipContent>
                      </Tooltip>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {(activeView === "create" || activeView === "join") && (
                <motion.div variants={itemVariants}>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)] overflow-visible">
                    <div className="absolute top-0 left-0 bg-gradient-to-br from-violet-500/30 via-transparent to-transparent w-20 h-20 rounded-br-full"></div>
                    <div className="absolute bottom-0 right-0 bg-gradient-to-tl from-indigo-500/20 via-transparent to-transparent w-40 h-40 rounded-tl-full"></div>
                    
                    <CardHeader className="pb-4 relative z-10">
                      <CardTitle className="text-2xl text-white flex items-center">
                        {activeView === "create" ? (
                          <>
                            <Plus className="w-5 h-5 mr-2 text-purple-300" />
                            Create a Lobby
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-5 h-5 mr-2 text-purple-300" />
                            Join a Lobby
                          </>
                        )}
                      </CardTitle>
                      <CardDescription className="text-white/70">
                        {activeView === "create" 
                          ? "Create a new room and invite your friends" 
                          : "Enter a lobby code to join an existing game"}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-6 relative z-10">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-6"
                      >
                        <div className="relative z-20">
                          <EmojiAvatar 
                            initialEmoji={avatarEmoji}
                            onChange={setAvatarEmoji}
                            size={80}
                            isInteractive={true}
                            className="hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute -inset-2 rounded-full border-2 border-white/10 blur-sm" />
                          <div className="absolute -inset-[3px] rounded-full border border-white/20" />
                        </div>
                        
                        <div className="flex-1">
                          <Label htmlFor="playerName" className="text-white mb-1 block">
                            Your Name
                          </Label>
                          <Input
                            id="playerName"
                            placeholder="Enter your name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-0"
                          />
                          <p className="text-xs text-white/50 mt-1">
                            Click the emoji to change your avatar
                          </p>
                        </div>
                      </motion.div>

                      {activeView === "join" && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                        >
                          <Label htmlFor="lobbyCode" className="text-white mb-1.5 block flex items-center">
                            <Crown className="w-3.5 h-3.5 mr-1 text-purple-300" />
                            Lobby Code
                          </Label>
                          <div className="relative">
                            <Input
                              id="lobbyCode"
                              placeholder="Enter lobby code"
                              value={lobbyCode}
                              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/30 font-mono tracking-wider"
                            />
                            {lobbyCode && (
                              <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center"
                              >
                                <div className="flex space-x-1">
                                  {Array.from({ length: Math.min(lobbyCode.length, 6) }).map((_, i) => (
                                    <div 
                                      key={i}
                                      className="w-1.5 h-1.5 rounded-full bg-purple-400"
                                    />
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </div>
                          <p className="text-xs text-white/50 mt-1.5 flex items-center">
                            <Share2 className="w-3 h-3 mr-1 text-purple-300" />
                            The host will share this code with you
                          </p>
                        </motion.div>
                      )}

                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex gap-2 pt-2"
                      >
                        <Button
                          onClick={() => setActiveView("menu")}
                          variant="ghost"
                          className="flex-1 text-white hover:bg-white/10 transition-all duration-300"
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Back
                        </Button>
                        
                        {activeView === "create" ? (
                          <Button
                            onClick={createLobby}
                            disabled={isCreatingLobby || !playerName.trim()}
                            className="flex-1 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-[1.02]"
                          >
                            {isCreatingLobby ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                              />
                            ) : (
                              <Plus className="mr-2 h-4 w-4" />
                            )}
                            {isCreatingLobby ? "Creating..." : "Create Lobby"}
                            {!isCreatingLobby && <ArrowRight className="ml-2 h-4 w-4" />}
                          </Button>
                        ) : (
                          <Button
                            onClick={joinLobby}
                            disabled={isJoiningLobby || !playerName.trim() || !lobbyCode.trim()}
                            className="flex-1 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-[1.02]"
                          >
                            {isJoiningLobby ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                              />
                            ) : (
                              <ExternalLink className="mr-2 h-4 w-4" />
                            )}
                            {isJoiningLobby ? "Joining..." : "Join Lobby"}
                            {!isJoiningLobby && <ArrowRight className="ml-2 h-4 w-4" />}
                          </Button>
                        )}
                      </motion.div>
                    </CardContent>
                    
                    <CardFooter className="flex flex-col gap-3 relative z-10 pb-6">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="w-full"
                      >
                        <div className="text-white/60 text-xs mb-1.5 uppercase tracking-wider font-medium">Features</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors duration-300">
                            <Users className="w-4 h-4 mb-1 text-purple-300" />
                            <span className="text-white text-xs">Multiplayer</span>
                          </div>
                          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors duration-300">
                            <Timer className="w-4 h-4 mb-1 text-purple-300" />
                            <span className="text-white text-xs">Real-time</span>
                          </div>
                          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors duration-300">
                            <Trophy className="w-4 h-4 mb-1 text-purple-300" />
                            <span className="text-white text-xs">Compete</span>
                          </div>
                        </div>
                      </motion.div>
                    </CardFooter>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default Multiplayer;
