// Types now live in src/types/data.ts — re-exported here for any legacy imports
export type { PlaceType, EventStatus, Village, Place, EventItem, LiveHotspot } from "../../types/data";

import type { Place, EventItem, LiveHotspot } from "../../types/data";

export const PLACES: Place[] = [
  {
    id: "p_tumon_beach",
    villageId: "tumon",
    type: "ATTRACTION",
    name: "Tumon Bay Beach",
    lat: 13.5168,
    lng: 144.8067,
    hours: "Open daily",
    price: "$",
    tags: ["beach", "swim", "sunset", "free"],
    source: "Curated Seed Data",
    description: "WIP demo data — swap to /api/pois later.",
  },
  {
    id: "p_den_tumon",
    villageId: "tumon",
    type: "RESTAURANT",
    name: "Denny's (Tumon) — Example",
    lat: 13.5147,
    lng: 144.8092,
    hours: "24/7 (example)",
    price: "$$",
    tags: ["late-night", "family", "american"],
    source: "Admin Verified",
    description: "Example listing for prototype.",
  },
];

export const EVENTS: EventItem[] = [
  {
    id: "e_chamorro_night_market",
    status: "VERIFIED",
    villageId: "hagåtña",
    title: "Chamorro Night Market (Demo)",
    lat: 13.4750,
    lng: 144.7511,
    when: "Wed • 6pm–9pm (example)",
    source: "Admin Verified",
    description: "Demo event: food, crafts, cultural performances.",
  },
];

export const LIVE: LiveHotspot[] = [
  { id: "live_tumon", lat: 13.5152, lng: 144.8090, count: 42, label: "Tumon hot spot" },
];
