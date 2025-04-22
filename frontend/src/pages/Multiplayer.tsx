import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, ArrowRight, Users, Plus, ExternalLink } from "lucide-react";
import CursorEffect from "@/components/CursorEffect";
import QuizLogo from "@/components/QuizLogo";
import EmojiAvatar from "@/components/EmojiAvatar";

// Remove the old avatar generation function
const emojis = ['😀', '😎', '🚀', '💡', '🎉', '🧠', '🎮', '🌟', '🤖', '🥳', '🤔', '🔥', '💯', '🎯', '🏆', '🍕'];

const Multiplayer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"menu" | "create" | "join">("menu");
  const [playerName, setPlayerName] = useState("");
  const [lobbyCode, setLobbyCode] = useState("");
  const [isCreatingLobby, setIsCreatingLobby] = useState(false);
  const [isJoiningLobby, setIsJoiningLobby] = useState(false);
  const [avatarEmoji, setAvatarEmoji] = useState<string>(emojis[0]);

  // Initialize with a random emoji when component mounts
  useEffect(() => {
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    setAvatarEmoji(randomEmoji);
    
    // Save the random emoji to localStorage immediately so it's available
    // even if the user doesn't change it manually
    localStorage.setItem("playerEmoji", randomEmoji);
    
    // Try to restore player name from localStorage
    const storedPlayerName = localStorage.getItem("playerName");
    if (storedPlayerName) {
      setPlayerName(storedPlayerName);
    }

    // Clear any previous lobby data
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
          avatar: avatarEmoji, // Use emoji as avatar
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create lobby");
      }

      const data = await response.json();
      
      // Save player info to localStorage
      localStorage.setItem("playerName", playerName);
      localStorage.setItem("lobbyCode", data.lobby_code);
      localStorage.setItem("isHost", "true");
      localStorage.setItem("playerEmoji", avatarEmoji); // Save emoji to localStorage
      
      // Navigate to the lobby
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
          avatar: avatarEmoji, // Use emoji as avatar
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
      
      // Save player info to localStorage
      localStorage.setItem("playerName", playerName);
      localStorage.setItem("lobbyCode", lobbyCode);
      localStorage.setItem("isHost", "false");
      localStorage.setItem("playerEmoji", avatarEmoji); // Save emoji to localStorage
      
      // Navigate to the lobby
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
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 z-10">
        <Button
          onClick={() => navigate("/")}
          variant="ghost"
          className="absolute top-4 left-4 text-white hover:bg-white/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="flex items-center justify-center mb-8">
            <QuizLogo 
              size={60} 
              color="white" 
              className="mr-2" 
            />
            <div>
              <h1 className="text-4xl font-bold text-white">
                Multiplayer
              </h1>
              <p className="text-white/70">Challenge your friends in real-time</p>
            </div>
          </div>

          {activeView === "menu" && (
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-white">Select an Option</CardTitle>
                <CardDescription className="text-white/70">
                  Create a new lobby or join an existing one
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => setActiveView("create")}
                  className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create a Lobby
                </Button>
                <Button
                  onClick={() => setActiveView("join")}
                  variant="outline"
                  className="w-full bg-white/10 hover:bg-white/15 text-white border-white/20"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Join a Lobby
                </Button>
              </CardContent>
            </Card>
          )}

          {(activeView === "create" || activeView === "join") && (
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-white">
                  {activeView === "create" ? "Create a Lobby" : "Join a Lobby"}
                </CardTitle>
                <CardDescription className="text-white/70">
                  {activeView === "create" 
                    ? "Create a new room and invite your friends" 
                    : "Enter a lobby code to join an existing game"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <EmojiAvatar 
                    initialEmoji={avatarEmoji}
                    onEmojiChange={setAvatarEmoji}
                    size={80}
                    isInteractive={true}
                    className="min-w-[80px]"
                  />
                  <div className="flex-1">
                    <Label htmlFor="playerName" className="text-white mb-1 block">
                      Your Name
                    </Label>
                    <Input
                      id="playerName"
                      placeholder="Enter your name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                    <p className="text-xs text-white/50 mt-1">
                      Click the emoji to change your avatar
                    </p>
                  </div>
                </div>

                {activeView === "join" && (
                  <div>
                    <Label htmlFor="lobbyCode" className="text-white mb-1 block">
                      Lobby Code
                    </Label>
                    <Input
                      id="lobbyCode"
                      placeholder="Enter lobby code"
                      value={lobbyCode}
                      onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => setActiveView("menu")}
                    variant="ghost"
                    className="flex-1 text-white hover:bg-white/10"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  
                  {activeView === "create" ? (
                    <Button
                      onClick={createLobby}
                      disabled={isCreatingLobby || !playerName.trim()}
                      className="flex-1 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white"
                    >
                      {isCreatingLobby ? "Creating..." : "Create Lobby"}
                      {!isCreatingLobby && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  ) : (
                    <Button
                      onClick={joinLobby}
                      disabled={isJoiningLobby || !playerName.trim() || !lobbyCode.trim()}
                      className="flex-1 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white"
                    >
                      {isJoiningLobby ? "Joining..." : "Join Lobby"}
                      {!isJoiningLobby && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Multiplayer;