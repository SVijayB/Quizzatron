
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const CursorEffect = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    const updateCursor = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setIsPointer((e.target as HTMLElement).tagName === "BUTTON" || (e.target as HTMLElement).closest("button") !== null);
    };

    window.addEventListener("mousemove", updateCursor);
    return () => window.removeEventListener("mousemove", updateCursor);
  }, []);

  return (
    <motion.div
      className="fixed pointer-events-none z-50 mix-blend-difference"
      style={{
        x: position.x - 16,
        y: position.y - 16,
      }}
      animate={{
        scale: isPointer ? 1.5 : 1,
      }}
      transition={{ type: "spring", stiffness: 800, damping: 20 }}
    >
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 bg-white rounded-full opacity-20" />
        <div className="absolute inset-0 bg-white rounded-full transform scale-25" />
      </div>
    </motion.div>
  );
};

export default CursorEffect;
