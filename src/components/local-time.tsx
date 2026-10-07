"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getViewerZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerZone = () => null;

/**
 * "Your time" line for viewers outside the venue's zone. The server renders
 * nothing (it can't know the viewer's zone), and the slot has a fixed height,
 * so filling it in after hydration doesn't shift the layout.
 */
export function LocalTime({ iso, venueTimeZone }: { iso: string; venueTimeZone: string }) {
  const viewerZone = useSyncExternalStore(subscribe, getViewerZone, getServerZone);

  let text = "";
  if (viewerZone) {
    const fmt = (timeZone: string) =>
      new Intl.DateTimeFormat("en-AU", {
        timeZone,
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(iso));
    const local = fmt(viewerZone);
    if (local !== fmt(venueTimeZone)) text = `Your time: ${local}`;
  }

  return (
    <span className="block h-5 text-xs text-ink-3" aria-live="off">
      {text}
    </span>
  );
}
