import { useEffect, useRef, useState } from "react";

import { socketClient, type SocketStatus } from "@/services/socket";
import type { ServerEventName, ServerEvents } from "@/types/api";

/**
 * Subscribe to one server event for the lifetime of a component.
 *
 * The handler is held in a ref, so passing an inline arrow does not tear the
 * subscription down and rebuild it on every render.
 */
export function useSocketEvent<E extends ServerEventName>(
  event: E,
  handler: (payload: ServerEvents[E]) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(
    () => socketClient.on(event, (payload) => handlerRef.current(payload)),
    [event],
  );
}

/** The live connection status, for the "reconnecting…" affordance. */
export function useSocketStatus(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>(socketClient.status);
  useEffect(() => socketClient.onStatus(setStatus), []);
  return status;
}
