export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Generate a GeoJSON polygon ring approximating a circle */
export function circlePolygon(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  steps = 64,
): [number, number][] {
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (km / 6371) * (180 / Math.PI) * Math.cos(angle);
    const dLng =
      ((km / 6371) * (180 / Math.PI) * Math.sin(angle)) /
      Math.cos((centerLat * Math.PI) / 180);
    coords.push([centerLng + dLng, centerLat + dLat]);
  }
  return coords;
}
