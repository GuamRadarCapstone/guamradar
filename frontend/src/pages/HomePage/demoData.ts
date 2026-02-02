export type PlaceType = "ATTRACTION" | "RESTAURANT" | "HOTEL";
export type EventStatus = "VERIFIED" | "PENDING";

export type Village = {
  id: string;
  name: string;
  polygon: [number, number][];
};

export type Place = {
  id: string;
  villageId: string;
  type: PlaceType;
  name: string;
  lat: number;
  lng: number;
  hours: string;
  price: "$" | "$$" | "$$$";
  tags: string[];
  source: string;
  description?: string;
};

export type EventItem = {
  id: string;
  status: EventStatus;
  villageId: string;
  title: string;
  lat: number;
  lng: number;
  when?: string;
  source: string;
  description?: string;
};

export type LiveHotspot = {
  id: string;
  lat: number;
  lng: number;
  count: number;
  label: string;
};

export const VILLAGES: Village[] = [
  {
    id: "tumon",
    name: "Tumon",
    polygon: [
      [13.5195, 144.8020],
      [13.5195, 144.8155],
      [13.5058, 144.8155],
      [13.5058, 144.8020],
    ],
  },
  {
    id: "hagåtña",
    name: "Hagåtña",
    polygon: [
      [13.4866, 144.7420],
      [13.4866, 144.7560],
      [13.4720, 144.7560],
      [13.4720, 144.7420],
    ],
  },
];

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
    name: "Denny’s (Tumon) — Example",
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

