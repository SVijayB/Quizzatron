
export function QuizBackground() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f3ed0,#8b5cf6)] opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#1a1a2e_100%)]" />
      <div className="absolute inset-0 bg-grid-white/[0.02]" />
    </div>
  );
}
