// en-AU, always with a zone label. In October Sydney is on AEDT while
// Brisbane stays on AEST, so an unlabelled time is ambiguous even at home.

export type FormattedKickoff = { day: string; time: string; zone: string };

export function formatKickoff(iso: string, timeZone: string): FormattedKickoff {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(new Date(iso));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    day: `${get("weekday")} ${get("day")} ${get("month")}`,
    time: `${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`,
    zone: get("timeZoneName"),
  };
}

/** Key for grouping fixtures under a date heading, in venue time. */
export function venueDateKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
}
