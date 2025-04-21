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
import { Sparkles, Brain, Zap, FileText, Users } from "lucide-react";
import CursorEffect from "@/components/CursorEffect";
import LoadingSpinner from "@/components/LoadingSpinner";
import CategorySuggestions from "@/components/CategorySuggestions";
import QuizLogo from "@/components/QuizLogo";
import { fetchCategories, fetchQuizByCategory } from "@/services/categoryService";

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
        requestFormData.append('difficulty', formData.difficulty);
        requestFormData.append('num_questions', formData.numQuestions.toString());
        requestFormData.append('image', formData.image.toString());
        
        // Handle either PDF upload or text topic
        if (selectedFile) {
          requestFormData.append('pdf', selectedFile);
        } else {
          requestFormData.append('topic', formData.topic);
        }

        console.log("Sending form data:", {
          model: formData.model,
          difficulty: formData.difficulty,
          numQuestions: formData.numQuestions,
          image: formData.image,
          topic: selectedFile ? "PDF file" : formData.topic
        });

        // Use the local API endpoint until the deployed one is fixed
        const apiUrl = "http://127.0.0.1:5000/api/quiz/generate";
        console.log("Using API endpoint:", apiUrl);

        const response = await fetch(apiUrl, {
          method: "POST",
          body: requestFormData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Server error response:", errorText);
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

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1a1a2e]">
      {loading && <LoadingSpinner />}
      <CursorEffect />
      
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f3ed0,#8b5cf6)] opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#1a1a2e_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,#4f3ed0,transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_0%_300px,#8b5cf6,transparent)]" />
        <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 z-10">
        <div className="w-full max-w-3xl space-y-8 text-center">
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <QuizLogo 
                size={80} 
                color="white" 
                className="mr-1 animate-pulse" 
              />
              <h1 className="text-7xl font-bold tracking-tight text-white animate-fade-down bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                Quizzatron
                <span className="text-violet-400">.</span>
              </h1>
            </div>
            <p className="text-xl text-white/80 animate-fade-up flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              let's quiz!
            </p>
          </div>

          {/* Multiplayer button - positioned above the regular quiz form */}
          <div className="relative group animate-fade-up">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-pink-500 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
            <Button
              onClick={handleMultiplayerClick}
              className="relative w-full h-14 text-lg font-medium bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-600 hover:to-amber-600 text-white transition-all duration-200 hover:scale-[1.02] border-0"
              disabled={loading}
            >
              <Users className="w-5 h-5 mr-2" />
              Play Multiplayer Quiz
              <Sparkles className="w-5 h-5 ml-2" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 animate-fade-up">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-400 to-indigo-400 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
              <div className="relative">
                <Input
                  type="text"
                  placeholder={selectedFile ? selectedFile.name : "Type your quiz topic"}
                  className="relative w-full h-14 px-6 text-lg bg-white/10 text-white placeholder:text-white/60 backdrop-blur-sm border-white/20 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-all duration-200 focus:ring-2 focus:ring-violet-400/30 focus:bg-white/15 focus:border-violet-400/50"
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center h-9 w-auto px-3 py-2 bg-[#503FCF] hover:bg-[#3C2E9F] text-white rounded-lg shadow-lg transition-all duration-200 border border-[#3C2E9F]"
                    title="Upload PDF"
                  >
                  <FileText className="w-4 h-4 mr-1.5" />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/10">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Model
                </label>
                <Select
                  value={formData.model}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, model: value }))
                  }
                  disabled={isCategorySelected}
                >
                  <SelectTrigger className={`w-full bg-gray-800 border-gray-700 text-gray-200 ${
                    isCategorySelected ? "opacity-50 cursor-not-allowed" : ""
                  }`}>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Difficulty
                </label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, difficulty: value }))
                  }
                >
                  <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-gray-200">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
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
                  className="py-4"
                />
                <span className="text-sm text-gray-400">
                  {formData.numQuestions} questions
                </span>
              </div>

              <div className="space-y-2 flex items-center justify-between">
                <label className={`text-sm font-medium ${isCategorySelected ? "text-gray-500" : "text-gray-300"}`}>
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
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-14 text-lg font-medium bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white transition-all duration-200 hover:scale-[1.02] animate-fade-up border-0"
              disabled={loading}
            >
              {loading ? (
                "Generating Quiz..."
              ) : (
                <>
                  Generate Quiz
                  <Sparkles className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Index;
