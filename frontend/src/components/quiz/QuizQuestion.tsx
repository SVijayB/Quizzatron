
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface QuizQuestionProps {
  question: string;
  image?: string;
}

export function QuizQuestion({ question, image }: QuizQuestionProps) {
  return (
    <motion.div 
      className="text-center mb-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {(!image || image === "False") && (
        <div className="relative mb-8">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl" />
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-violet-400 to-indigo-400 rounded-xl shadow-lg flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </motion.div>
        </div>
      )}

      <h2 className="text-4xl font-bold text-white mb-8 px-4 py-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
        {question}
      </h2>

      {image && image !== "False" && (
        <motion.img
          src={image}
          alt="Question"
          className="mx-auto max-h-64 object-cover rounded-lg mb-8 shadow-[0_0_30px_rgba(139,92,246,0.2)]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        />
      )}
    </motion.div>
  );
}
