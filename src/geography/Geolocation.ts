import { WORLD_CONFIG } from "@/config/WorldConfig";

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/** True if the coordinate falls inside the configured world bounds. */
export function insideWorldBounds(latitude: number, longitude: number): boolean {
  const { north, south, east, west } = WORLD_CONFIG.bounds;
  return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
}

/** One-shot current position, resolving null on denial/timeout/unavailable. */
export function getCurrentLocation(timeoutMs = 8000): Promise<DeviceLocation | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 5000 },
    );
  });
}

/** Continuous position updates. Returns a watch id, or null if unsupported. */
export function watchLocation(
  onUpdate: (location: DeviceLocation) => void,
): number | null {
  if (!("geolocation" in navigator)) return null;
  return navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    () => {
      /* ignore transient errors */
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
  );
}

export function clearLocationWatch(id: number): void {
  if ("geolocation" in navigator) navigator.geolocation.clearWatch(id);
}
