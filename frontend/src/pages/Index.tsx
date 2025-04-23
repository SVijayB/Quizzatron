import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { 
  Sparkles, Brain, Zap, FileText, Users, BookOpen, 
  Star, Trophy, Settings, Gamepad2, Info, Timer, Crown 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CursorEffect from "@/components/CursorEffect";
import LoadingSpinner from "@/components/LoadingSpinner";
import CategorySuggestions from "@/components/CategorySuggestions";
import QuizLogo from "@/components/QuizLogo";
import { fetchCategories, fetchQuizByCategory } from "@/services/categoryService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryData, setCategoryData] = useState<{[key: string]: number | string}>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCategorySelected, setIsCategorySelected] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [formData, setFormData] = useState({
    topic: "",
    model: "gemini",
    difficulty: "medium",
    numQuestions: 10,
    image: false,
  });

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/categories/get');
        if (!response.ok) {
          throw new Error('Failed to fetch categories');
        }
        
        const data: {[key: string]: number | string} = await response.json();
        setCategoryData(data);
        
        // Include ALL categories now, not filtering out trivia-qa ones
        const categoryList = Object.keys(data);
        setCategories(categoryList);
        
        console.log("Loaded categories data:", data);
        console.log("Complete category list:", categoryList);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast({
          title: "Error",
          description: "Failed to fetch categories. Please try again.",
          variant: "destructive",
        });
      }
    };
    
    loadCategories();
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      setFormData(prev => ({ ...prev, topic: file.name }));
      setIsCategorySelected(false);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file",
        variant: "destructive",
      });
      setSelectedFile(null);
      setFormData(prev => ({ ...prev, topic: "" }));
    }
  };

  const handleTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedFile) {
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    setFormData(prev => ({ ...prev, topic: e.target.value }));
    setShowSuggestions(true);
    setIsCategorySelected(false);
  };

  const handleCategorySelect = (category: string) => {
    setFormData(prev => ({ ...prev, topic: category }));
    setShowSuggestions(false);
    setIsCategorySelected(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let data;
      
      if (isCategorySelected) {
        data = await fetchQuizByCategory(
          formData.topic,
          formData.difficulty,
          formData.numQuestions,
          formData.image
        );
      } else {
        const requestFormData = new FormData();
        
        // Match backend's expected form fields
        requestFormData.append('model', formData.model);
        requestFormData.append('topic', formData.topic);
        requestFormData.append('difficulty', formData.difficulty);
        requestFormData.append('num_questions', formData.numQuestions.toString());
        requestFormData.append('image', formData.image ? 'true' : 'false');
        
        if (selectedFile) {
          requestFormData.append('pdf', selectedFile);
          
          const response = await fetch('http://127.0.0.1:5000/api/quiz/generate_pdf', {
            method: 'POST',
            body: requestFormData
          });

          if (!response.ok) {
            throw new Error(`Failed to generate quiz: ${response.status} ${response.statusText}`);
          }

          const responseText = await response.text();
          console.log("Server response:", responseText);
          
          try {
            const parsedData = JSON.parse(responseText);
            
            // Handle array response with status code [data, statusCode]
            if (Array.isArray(parsedData) && parsedData.length === 2 && typeof parsedData[1] === 'number') {
              data = parsedData[0]; // Extract just the quiz data part
            } else {
              data = parsedData;
            }
          } catch (parseError) {
            console.error("Error parsing JSON response:", parseError);
            throw new Error("Invalid response format from server");
          }
        } else {
          // Regular topic-based quiz generation
          const response = await fetch('http://127.0.0.1:5000/api/quiz/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: formData.model,
              topic: formData.topic,
              difficulty: formData.difficulty,
              num_questions: formData.numQuestions,
              image: formData.image
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to generate quiz: ${response.status} ${response.statusText}`);
          }

          const responseText = await response.text();
          console.log("Server response:", responseText);
          
          try {
            const parsedData = JSON.parse(responseText);
            
            // Handle array response with status code [data, statusCode]
            if (Array.isArray(parsedData) && parsedData.length === 2 && typeof parsedData[1] === 'number') {
              data = parsedData[0]; // Extract just the quiz data part
            } else {
              data = parsedData;
            }
          } catch (parseError) {
            console.error("Error parsing JSON response:", parseError);
            throw new Error("Invalid response format from server");
          }
        }
      }

      if (!data || typeof data !== 'object') {
        throw new Error("Invalid quiz data received");
      }

      localStorage.setItem("quizData", JSON.stringify(data));
      navigate("/quiz");
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast({
        title: "Error",
        description: "Failed to generate quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMultiplayerClick = () => {
    navigate("/multiplayer");
  };

  // Define the features that will be animated and highlighted
  const features = [
    { 
      icon: <BookOpen className="w-6 h-6" />, 
      title: "Wide Range of Topics", 
      description: "Create quizzes on virtually any subject or upload your own PDF materials." 
    },
    { 
      icon: <Trophy className="w-6 h-6" />, 
      title: "Competitive Multiplayer", 
      description: "Challenge friends in real-time multiplayer quiz competitions." 
    },
    { 
      icon: <Settings className="w-6 h-6" />, 
      title: "Customizable Difficulty", 
      description: "Adjust settings to match your knowledge level and preferences." 
    },
    { 
      icon: <Star className="w-6 h-6" />, 
      title: "AI-Powered Questions", 
      description: "Enjoy high-quality questions generated using advanced AI models." 
    }
  ];

  // Animation variants for Framer Motion
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.4 }
    }
  };

  const floatingIconVariants = {
    animate: {
      y: [0, -8, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        repeatType: "mirror" as const,
      }
    }
  };

  // Dialog animation variants
  const dialogContentVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.2,
        ease: "easeIn"
      }
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1a1a2e]">
      {loading && <LoadingSpinner />}
      <CursorEffect />
      
      {/* Background elements */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f3ed0,#8b5cf6)] opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#1a1a2e_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,#4f3ed0,transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_0%_300px,#8b5cf6,transparent)]" />
        <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
        
        {/* Animated floating game elements - matching the multiplayer page style */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating quiz-related icons */}
          <motion.div 
            custom={1}
            variants={floatingIconVariants}
            animate={{
              y: [0, -15, 0],
              x: [0, 5, 0],
              rotate: [0, 5, 0],
              transition: {
                duration: 4,
                repeat: Infinity,
                repeatType: "mirror",
              }
            }}
            className="absolute left-[15%] top-[20%] text-white/20 text-4xl"
          >
            <Trophy className="w-10 h-10" />
          </motion.div>
          <motion.div 
            custom={2}
            animate={{
              y: [0, -15, 0],
              x: [0, -5, 0],
              rotate: [0, -5, 0],
              transition: {
                duration: 5,
                repeat: Infinity,
                repeatType: "mirror",
              }
            }}
            className="absolute right-[20%] top-[15%] text-white/20 text-4xl"
          >
            <Gamepad2 className="w-12 h-12" />
          </motion.div>
          <motion.div 
            custom={3}
            animate={{
              y: [0, -15, 0],
              x: [0, 5, 0],
              rotate: [0, 5, 0],
              transition: {
                duration: 6,
                repeat: Infinity,
                repeatType: "mirror",
              }
            }}
            className="absolute left-[10%] bottom-[20%] text-white/20 text-4xl"
          >
            <Zap className="w-8 h-8" />
          </motion.div>
          <motion.div 
            custom={4}
            animate={{
              y: [0, -15, 0],
              x: [0, -5, 0],
              rotate: [0, -5, 0],
              transition: {
                duration: 5.5,
                repeat: Infinity,
                repeatType: "mirror",
              }
            }}
            className="absolute right-[15%] bottom-[25%] text-white/20 text-4xl"
          >
            <Timer className="w-9 h-9" />
          </motion.div>
          <motion.div 
            custom={5}
            animate={{
              y: [0, -15, 0],
              x: [0, 5, 0],
              rotate: [0, 5, 0],
              transition: {
                duration: 4.5,
                repeat: Infinity,
                repeatType: "mirror",
              }
            }}
            className="absolute left-[25%] top-[50%] text-white/20 text-4xl"
          >
            <Crown className="w-7 h-7" />
          </motion.div>
          <motion.div 
            custom={6}
            animate={{
              y: [0, -15, 0],
              x: [0, -5, 0],
              rotate: [0, -5, 0],
              transition: {
                duration: 3.5,
                repeat: Infinity,
                repeatType: "mirror",
              }
            }}
            className="absolute right-[25%] top-[40%] text-white/20 text-4xl"
          >
            <Star className="w-6 h-6" />
          </motion.div>
        </div>
        
        {/* Animated floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(12)].map((_, i) => (
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
                y: [0, -80, 0],
                x: [0, Math.random() * 40 - 20, 0],
                opacity: [0.1, 0.3, 0.1]
              }}
              transition={{
                duration: Math.random() * 8 + 12,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>

      {/* Info button in top right corner */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogTrigger asChild>
          <button 
            className="fixed top-4 right-4 z-50 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full p-2.5 transition-all duration-200 text-white shadow-lg hover:shadow-violet-500/30"
            aria-label="Information about Quizzatron"
          >
            <Info className="w-5 h-5" />
          </button>
        </DialogTrigger>
        
        <DialogContent className="bg-[#1a1a2e]/95 backdrop-blur-md border-[#4f3ed0]/40 shadow-[0px_0px_20px_rgba(139,92,246,0.3)] text-white sm:max-w-[550px] overflow-hidden">
          <AnimatePresence mode="wait">
            {showInfoDialog && (
              <motion.div
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={dialogContentVariants}
                className="w-full"
              >
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
                    <QuizLogo size={32} color="white" />
                    About Quizzatron
                  </DialogTitle>
                  <DialogDescription className="text-center text-gray-300">
                    An AI-powered quiz generator for all your learning needs
                  </DialogDescription>
                </DialogHeader>
                
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4 px-4">
                    {features.map((feature, index) => (
                      <motion.div 
                        key={index}
                        className="rounded-lg p-4 backdrop-blur-sm border border-[#8b5cf6]/30 bg-[#4f3ed0]/20 hover:bg-[#4f3ed0]/30 hover:border-[#8b5cf6]/60 hover:scale-105 hover:shadow-md hover:shadow-[#8b5cf6]/20 transition-all duration-300"
                        whileHover={{ scale: 1.05 }}
                      >
                        <div className="flex flex-col items-center gap-2 text-center">
                          <div className="p-3 rounded-full mb-2 bg-white/5 group-hover:bg-[#8b5cf6]/30">
                            {feature.icon}
                          </div>
                          <h3 className="font-semibold text-white">{feature.title}</h3>
                          <p className="text-sm text-gray-300">{feature.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-6 z-10">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-5xl flex flex-col md:flex-row items-center gap-6"
        >
          {/* Left Side Content */}
          <div className="w-full md:w-3/5 space-y-6">
            {/* Logo & Heading Section */}
            <motion.div variants={itemVariants} className="space-y-3 text-center md:text-left">
              <div className="flex items-center md:justify-start justify-center">
                <motion.div variants={floatingIconVariants} animate="animate">
                  <QuizLogo 
                    size={60} 
                    color="white" 
                    className="mr-1" 
                  />
                </motion.div>
                <h1 className="text-5xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                  Quizzatron
                  <span className="text-violet-400">.</span>
                </h1>
              </div>
              <motion.p 
                className="text-md text-white/80 flex items-center md:justify-start justify-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Sparkles className="w-4 h-4 text-violet-400" />
                Test your knowledge with AI-powered quizzes!
              </motion.p>
            </motion.div>

            {/* Multiplayer button */}
            <motion.div 
              variants={itemVariants}
              className="relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-400 to-violet-500 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
              <Button
                onClick={handleMultiplayerClick}
                className="relative w-full h-12 text-base font-medium bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white transition-all duration-200 hover:scale-[1.02] border-0"
                disabled={loading}
              >
                <Gamepad2 className="w-5 h-5 mr-2" />
                Play Multiplayer Quiz
                <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>

            <motion.form 
              variants={itemVariants}
              onSubmit={handleSubmit} 
              className="space-y-6"
            >
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-400 to-indigo-400 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
                <div className="relative">
                  <Input
                    type="text"
                    placeholder={selectedFile ? selectedFile.name : "Type your quiz topic"}
                    className="relative w-full h-12 px-4 text-base bg-white/10 text-white placeholder:text-white/60 backdrop-blur-sm border-white/20 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-all duration-200 focus:ring-2 focus:ring-violet-400/30 focus:bg-white/15 focus:border-violet-400/50"
                    value={formData.topic}
                    onChange={handleTopicChange}
                    disabled={!!selectedFile}
                    required
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  />
                  <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-auto px-3 py-1.5 bg-[#503FCF] hover:bg-[#3C2E9F] text-white rounded-md shadow-lg transition-all duration-200 border border-[#3C2E9F] text-sm"
                      title="Upload PDF"
                    >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    <span className="font-medium">Upload PDF</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".pdf"
                    className="hidden"
                  />
                  
                  <CategorySuggestions 
                    categories={categories}
                    searchQuery={formData.topic}
                    visible={showSuggestions && !selectedFile}
                    onSelectCategory={handleCategorySelect}
                    categoryData={categoryData}
                  />
                </div>
              </div>

              <motion.div 
                variants={containerVariants}
                className="grid grid-cols-2 gap-4 bg-white/5 backdrop-blur-sm p-4 rounded-xl shadow-md border border-white/10"
              >
                <motion.div variants={itemVariants} className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" />
                    Model
                  </label>
                  <Select
                    value={formData.model}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, model: value }))
                    }
                    disabled={isCategorySelected}
                  >
                    <SelectTrigger className={`w-full h-9 bg-gray-800 border-gray-700 text-gray-200 text-sm ${
                      isCategorySelected ? "opacity-50 cursor-not-allowed" : ""
                    }`}>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Difficulty
                  </label>
                  <Select
                    value={formData.difficulty}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, difficulty: value }))
                    }
                  >
                    <SelectTrigger className="w-full h-9 bg-gray-800 border-gray-700 text-gray-200 text-sm">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300">
                    Number of Questions
                  </label>
                  <Slider
                    value={[formData.numQuestions]}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, numQuestions: value[0] }))
                    }
                    max={20}
                    min={1}
                    step={1}
                    className="py-3"
                  />
                  <span className="text-xs text-gray-400">
                    {formData.numQuestions} questions
                  </span>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-1.5 flex items-center justify-between">
                  <label className={`text-xs font-medium ${isCategorySelected ? "text-gray-500" : "text-gray-300"}`}>
                    Include Images
                  </label>
                  <Switch
                    checked={formData.image}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, image: checked }))
                    }
                    disabled={isCategorySelected}
                    className={isCategorySelected ? "opacity-50 cursor-not-allowed" : ""}
                  />
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white transition-all duration-200 hover:scale-[1.02] border-0 shadow-md shadow-violet-500/20"
                  disabled={loading}
                >
                  {loading ? (
                    "Generating Quiz..."
                  ) : (
                    <>
                      Generate Quiz
                      <Sparkles className="w-4 h-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </motion.div>
            </motion.form>
          </div>
          
          {/* Right Side - SVG Illustration */}
          <motion.div 
            className="w-full md:w-2/5 flex justify-center items-center mt-6 md:mt-0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <img 
              src="/undraw_quiz_zvhe.svg" 
              alt="Quiz illustration" 
              className="w-4/5 md:w-3/4 max-w-sm filter drop-shadow-lg"
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
