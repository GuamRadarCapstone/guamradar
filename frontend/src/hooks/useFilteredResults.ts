import { useMemo } from "react";
import type { Place, EventItem } from "../types/data";
import { haversineKm } from "../lib/math";
import { mockOpenNow } from "../lib/ui";

type Category = "ALL" | "ATTRACTION" | "RESTAURANT" | "HOTEL";
type UserLoc = { lat: number; lng: number } | null;

export type ResultItem =
  | { kind: "PLACE"; data: Place }
  | { kind: "EVENT"; data: EventItem };

export function useFilteredResults(
  places: Place[],
  events: EventItem[],
  opts: {
    selectedVillageId: string | null;
    category: Category;
    search: string;
    openNow: boolean;
    nearMe: boolean;
    userLoc: UserLoc;
  },
) {
  const { selectedVillageId, category, openNow, nearMe, userLoc } = opts;
  const searchLower = opts.search.trim().toLowerCase();

  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      if (selectedVillageId && p.villageId !== selectedVillageId) return false;
      if (category !== "ALL" && p.type !== category) return false;
      if (searchLower) {
        const haystack = `${p.name} ${p.tags.join(" ")} ${p.description ?? ""}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      if (openNow && !mockOpenNow(p)) return false;
      if (nearMe) {
        if (!userLoc) return false;
        if (haversineKm(userLoc.lat, userLoc.lng, p.lat, p.lng) > 5) return false;
      }
      return true;
    });
  }, [places, selectedVillageId, category, searchLower, openNow, nearMe, userLoc]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedVillageId && e.villageId !== selectedVillageId) return false;
      if (category !== "ALL") return false;
      if (searchLower) {
        const haystack = `${e.title} ${e.description ?? ""}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      if (nearMe) {
        if (!userLoc) return false;
        if (haversineKm(userLoc.lat, userLoc.lng, e.lat, e.lng) > 5) return false;
      }
      return true;
    });
  }, [events, selectedVillageId, category, searchLower, nearMe, userLoc]);

  const results = useMemo((): ResultItem[] => {
    const combined: ResultItem[] = [
      ...filteredPlaces.map((p) => ({ kind: "PLACE" as const, data: p })),
      ...filteredEvents.map((e) => ({ kind: "EVENT" as const, data: e })),
    ];

    combined.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "PLACE" ? -1 : 1;
      if (userLoc) {
        const da = haversineKm(userLoc.lat, userLoc.lng, a.data.lat, a.data.lng);
        const db = haversineKm(userLoc.lat, userLoc.lng, b.data.lat, b.data.lng);
        return da - db;
      }
      const an = a.kind === "PLACE" ? a.data.name : a.data.title;
      const bn = b.kind === "PLACE" ? b.data.name : b.data.title;
      return an.localeCompare(bn);
    });

    return combined;
  }, [filteredPlaces, filteredEvents, userLoc]);

  return { filteredPlaces, filteredEvents, results };
}
