import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const CursorEffect = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const updateCursor = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      
      // Check if hovering over a button or clickable element
      const target = e.target as HTMLElement;
      const isClickable = 
        target.tagName === "BUTTON" || 
        target.closest("button") !== null ||
        window.getComputedStyle(target).cursor === "pointer";
      
      setIsHovering(isClickable);
    };

    window.addEventListener("mousemove", updateCursor);
    return () => window.removeEventListener("mousemove", updateCursor);
  }, []);

  return (
    <motion.div
      className="fixed pointer-events-none z-50"
      style={{
        x: position.x - 5,
        y: position.y - 5,
      }}
      animate={{
        scale: isHovering ? 1.2 : 1,
      }}
      transition={{ type: "spring", stiffness: 800, damping: 20 }}
    >
      <div className="relative w-3 h-3">
        <div className={`absolute inset-0 rounded-full ${isHovering ? 'bg-purple-400' : 'bg-purple-500'} opacity-40`} />
      </div>
    </motion.div>
  );
};

export default CursorEffect;
