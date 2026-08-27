import { Check, Crown, Hourglass, WifiOff } from "lucide-react";

import {
  AvatarEmojiBadge,
  Badge,
  Panel,
  PanelHeader,
  PanelTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { MpPlayer } from "@/types/api";

interface PlayerListProps {
  players: MpPlayer[];
  selfId: string | null;
  /** Show the ready flag (lobby) rather than the score (in game). */
  showReady?: boolean;
  showScore?: boolean;
}

/**
 * The lobby roster. A disconnected player is greyed and labelled, not removed —
 * the server keeps their score for a rejoin, and v1 silently dropped them from
 * the list so nobody knew why the count had changed.
 */
export function PlayerList({
  players,
  selfId,
  showReady = true,
  showScore = false,
}: PlayerListProps) {
  const readyCount = players.filter((player) => player.ready).length;

  return (
    <Panel as="section" padded="sm">
      <PanelHeader className="mb-3">
        <PanelTitle as="h2" className="text-lg sm:text-xl">
          Players
        </PanelTitle>
        <span
          className="text-[11px] font-bold uppercase tracking-widest text-bone-dim"
          role="status"
          aria-live="polite"
        >
          {showReady
            ? `${readyCount} of ${players.length} ready`
            : `${players.length} in the lobby`}
        </span>
      </PanelHeader>

      {players.length === 0 ? (
        <p className="text-sm text-bone-dim">
          Nobody here yet. Share the code and they will appear.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li
              key={player.id}
              className={cn(
                "flex items-center gap-3 rounded border-2 px-3 py-2",
                player.id === selfId
                  ? "border-acid bg-ink-sunken"
                  : "border-ink-line bg-ink-sunken",
                !player.connected && "opacity-60",
              )}
            >
              <AvatarEmojiBadge emoji={player.avatar} size={40} />

              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-bold leading-tight">
                  {player.name}
                  {player.id === selfId ? (
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-acid">
                      (you)
                    </span>
                  ) : null}
                </span>

                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  {player.isHost ? (
                    <Badge variant="info">
                      <Crown aria-hidden="true" />
                      Host
                    </Badge>
                  ) : null}
                  {showReady ? (
                    player.ready ? (
                      <Badge variant="success">
                        <Check aria-hidden="true" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-ink-line">
                        <Hourglass aria-hidden="true" />
                        Not ready
                      </Badge>
                    )
                  ) : null}
                  {!player.connected ? (
                    <Badge variant="danger">
                      <WifiOff aria-hidden="true" />
                      Disconnected
                    </Badge>
                  ) : null}
                </span>
              </span>

              {showScore ? (
                <span className="shrink-0 font-mono text-lg font-bold text-acid tabular-nums">
                  {player.score}
                  <span className="sr-only"> points</span>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
