import { AlertTriangle, Heart, Linkedin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Panel,
  Skeleton,
} from "@/components/ui";
import { apiUrl } from "@/services/config";
import { errorMessage } from "@/services/http";
import { getDevInfo } from "@/services/quizApi";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("");
}

/** The server serves team photos from its own `/static`, so make them absolute. */
function imageSrc(path: string): string {
  return path.startsWith("http") ? path : apiUrl(path);
}

/**
 * "Meet the team". The list now comes from `GET /api/dev-info` rather than a
 * hardcoded copy that could drift from the server's.
 */
const DevInfo = () => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["dev-info"],
    queryFn: ({ signal }) => getDevInfo(signal),
    staleTime: Infinity,
  });

  const team = data?.team ?? [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="primary"
          size="icon"
          aria-label="Meet the team"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-sticky"
        >
          <Heart aria-hidden="true" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Meet the team</DialogTitle>
          <DialogDescription>
            The people responsible for Quizzatron.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        {isError ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded border-2 border-ink-line bg-hot p-3 text-sm font-semibold text-ink"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="break-words">
              {errorMessage(error, "Could not load the team list.")}
            </span>
          </p>
        ) : null}

        {team.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {team.map((dev) => (
              <li key={dev.name}>
                <Panel as="article" tone="sunken" padded="sm" className="h-full">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={imageSrc(dev.image)} alt="" />
                      <AvatarFallback>{initials(dev.name)}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-display text-base uppercase tracking-display">
                        {dev.name}
                      </h3>
                      <p className="mt-1 break-words text-sm text-bone-dim">
                        {dev.role}
                      </p>

                      {dev.linkedin ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          asChild
                          className="mt-3 min-h-touch"
                        >
                          <a
                            href={dev.linkedin}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            <Linkedin aria-hidden="true" />
                            <span>
                              LinkedIn
                              <span className="sr-only">{` — ${dev.name}`}</span>
                            </span>
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default DevInfo;
