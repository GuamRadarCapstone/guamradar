import { useState } from "react";
import type { Village } from "../types/data";
import { findVillageForPoint } from "../lib/geo";

type UserLoc = { lat: number; lng: number };

export function useUserLocation(
  villages: Village[],
  onVillageFound: (id: string) => void,
) {
  const [userLoc, setUserLoc] = useState<UserLoc | null>(null);
  const [userAcc, setUserAcc] = useState<number | null>(null);

  function locateMe() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null;

        setUserLoc({ lat, lng });
        setUserAcc(acc);

        if (villages.length && (acc === null || acc <= 1500)) {
          const v = findVillageForPoint(villages, lat, lng);
          if (v) onVillageFound(v.id);
        }
      },
      () => alert("Could not access location."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  return { userLoc, userAcc, locateMe };
}
