import { useEffect, useState } from "react";
import type { Village } from "../types/data";
import { geoJsonToVillages } from "../lib/geo";

export function useVillages() {
  const [villages, setVillages] = useState<Village[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/guam_villages.geojson`)
      .then((r) => r.json())
      .then((geo) => setVillages(geoJsonToVillages(geo)))
      .catch((e) => {
        console.error("Failed to load villages geojson:", e);
        setVillages([]);
      });
  }, []);

  return villages;
}
