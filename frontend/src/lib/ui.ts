import type { Place, EventItem } from "../types/data";

export function placeEmoji(type: Place["type"]) {
  if (type === "RESTAURANT") return "🍴";
  if (type === "HOTEL") return "🏨";
  return "📍";
}

export function eventEmoji(status: EventItem["status"]) {
  return status === "VERIFIED" ? "📅" : "🕓";
}

/** Deterministic "open now" based on place hours string and id hash (demo only) */
export function mockOpenNow(place: Place) {
  const h = (place.hours || "").toLowerCase();
  if (h.includes("24/7")) return true;
  if (h.includes("open daily")) return true;
  let x = 0;
  for (let i = 0; i < place.id.length; i++) x = (x * 31 + place.id.charCodeAt(i)) | 0;
  return (x & 1) === 0;
}
