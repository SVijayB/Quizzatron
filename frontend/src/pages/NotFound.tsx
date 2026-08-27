import { Home as HomeIcon, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import QuizLogo from "@/components/QuizLogo";
import { Button, Panel } from "@/components/ui";

/**
 * 404. Previously 27 lines of `bg-gray-100` white-on-light inside a dark app,
 * with a raw `<a href="/">` that forced a full page reload.
 */
export default function NotFound() {
  const location = useLocation();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-10 sm:px-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <QuizLogo size={48} className="text-acid" />
        <h1 className="font-display text-5xl uppercase leading-none tracking-tightest sm:text-7xl">
          404
        </h1>
        <p className="text-sm text-bone-dim">
          Nothing lives at{" "}
          <span className="break-all font-mono text-bone">{location.pathname}</span>.
        </p>
      </div>

      <Panel as="section" padded="md" className="flex flex-col gap-3">
        <Button asChild size="lg" block>
          <Link to="/">
            <HomeIcon aria-hidden="true" />
            Build a quiz
          </Link>
        </Button>
        <Button asChild size="lg" block variant="secondary">
          <Link to="/multiplayer">
            <Users aria-hidden="true" />
            Multiplayer
          </Link>
        </Button>
      </Panel>
    </div>
  );
}
