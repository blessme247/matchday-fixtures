import type { Venue } from "./types";

/**
 * The feed gives a venue name and a city/country, but no time zone, and some
 * locations are wrong. Known venues are pinned here by feed id; corrections
 * are marked. Anything unknown falls back to the country, and the sync report
 * flags it so it can be added.
 */
const KNOWN: Record<string, Omit<Venue, "name">> = {
  // Australia
  "16575": { city: "Sydney", country: "Australia", timeZone: "Australia/Sydney" },
  "16728": { city: "Sydney", country: "Australia", timeZone: "Australia/Sydney" },
  "153690": { city: "Newcastle", country: "Australia", timeZone: "Australia/Sydney" },
  "16714": { city: "Canberra", country: "Australia", timeZone: "Australia/Sydney" },
  "16743": { city: "Melbourne", country: "Australia", timeZone: "Australia/Melbourne" },
  "16317": { city: "Brisbane", country: "Australia", timeZone: "Australia/Brisbane" },
  "308475": { city: "Townsville", country: "Australia", timeZone: "Australia/Brisbane" },
  "16814": { city: "Adelaide", country: "Australia", timeZone: "Australia/Adelaide" },
  "26038": { city: "Perth", country: "Australia", timeZone: "Australia/Perth" },
  "289673": { city: "Perth", country: "Australia", timeZone: "Australia/Perth" },
  "308775": { city: "Perth", country: "Australia", timeZone: "Australia/Perth" },
  // New Zealand
  "16155": { city: "Auckland", country: "New Zealand", timeZone: "Pacific/Auckland" },
  // Correction: listed as "Albany, United States of America". It's Albany, Auckland.
  "16691": { city: "Auckland", country: "New Zealand", timeZone: "Pacific/Auckland" },
  "16495": { city: "Pukekohe", country: "New Zealand", timeZone: "Pacific/Auckland" },
  "16791": { city: "Hamilton", country: "New Zealand", timeZone: "Pacific/Auckland" },
  "16472": { city: "Rotorua", country: "New Zealand", timeZone: "Pacific/Auckland" },
  "16552": { city: "Napier", country: "New Zealand", timeZone: "Pacific/Auckland" },
  "16744": { city: "Wellington", country: "New Zealand", timeZone: "Pacific/Auckland" },
  "153837": { city: "Christchurch", country: "New Zealand", timeZone: "Pacific/Auckland" },
  "308777": { city: "Christchurch", country: "New Zealand", timeZone: "Pacific/Auckland" },
  "121705": { city: "Dunedin", country: "New Zealand", timeZone: "Pacific/Auckland" },
  // Fiji. Correction: Four R Stadium has no location in the feed; it hosts
  // Fijian Drua home games.
  "98009": { city: "Lautoka", country: "Fiji", timeZone: "Pacific/Fiji" },
  "16460": { city: "Suva", country: "Fiji", timeZone: "Pacific/Fiji" },
  "308776": { city: "", country: "Fiji", timeZone: "Pacific/Fiji" },
  // Elsewhere
  "16201": { city: "Osaka", country: "Japan", timeZone: "Asia/Tokyo" },
  // Correction: listed as "San Salvador, El Salvador". It's San Salvador de Jujuy.
  "289527": { city: "San Salvador de Jujuy", country: "Argentina", timeZone: "America/Argentina/Jujuy" },
  "156786": { city: "Mendoza", country: "Argentina", timeZone: "America/Argentina/Mendoza" },
};

const COUNTRY_ZONES: Record<string, string> = {
  Australia: "Australia/Sydney",
  "New Zealand": "Pacific/Auckland",
  Fiji: "Pacific/Fiji",
  Samoa: "Pacific/Apia",
  Tonga: "Pacific/Tongatapu",
  Japan: "Asia/Tokyo",
  Argentina: "America/Argentina/Buenos_Aires",
  "South Africa": "Africa/Johannesburg",
  England: "Europe/London",
  Wales: "Europe/London",
  Scotland: "Europe/London",
  Ireland: "Europe/Dublin",
  France: "Europe/Paris",
  Italy: "Europe/Rome",
  Georgia: "Asia/Tbilisi",
};

export type FeedVenue = {
  id?: string;
  fullName?: string;
  address?: { city?: string; state?: string; country?: string };
};

export function resolveVenue(v: FeedVenue | undefined): { venue: Venue; known: boolean } {
  const name = v?.fullName ?? "Venue to be confirmed";
  const pinned = v?.id ? KNOWN[v.id] : undefined;
  if (pinned) return { venue: { name, ...pinned }, known: true };

  const country = v?.address?.country ?? v?.address?.state ?? "";
  return {
    venue: {
      name,
      city: v?.address?.city ?? "",
      country,
      timeZone: COUNTRY_ZONES[country] ?? "UTC",
    },
    known: false,
  };
}
