export type PlaceType = "ATTRACTION" | "RESTAURANT" | "HOTEL";
export type EventStatus = "VERIFIED" | "PENDING";

export type Village = {
  id: string;
  name: string;
  /** Outer ring in GeoJSON order: [lng, lat][] */
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
