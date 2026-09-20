import type { RoadData } from "@/world/Roads";

export interface Path {
  points: Array<[number, number]>;
  cum: number[];
  total: number;
  width: number;
}

export function buildPaths(roads: RoadData[], minLength = 30): Path[] {
  const paths: Path[] = [];
  for (const road of roads) {
    if (road.points.length < 2) continue;
    const cum = [0];
    let total = 0;
    for (let i = 1; i < road.points.length; i++) {
      total += Math.hypot(
        road.points[i]![0] - road.points[i - 1]![0],
        road.points[i]![1] - road.points[i - 1]![1],
      );
      cum.push(total);
    }
    if (total > minLength) paths.push({ points: road.points, cum, total, width: road.width });
  }
  return paths;
}

export function samplePath(path: Path, distance: number): { x: number; z: number; yaw: number } {
  const d = Math.max(0, Math.min(path.total, distance));
  let i = 1;
  while (i < path.cum.length - 1 && path.cum[i]! < d) i++;
  const a = path.points[i - 1]!;
  const b = path.points[i]!;
  const segStart = path.cum[i - 1]!;
  const segLen = path.cum[i]! - segStart || 1;
  const t = (d - segStart) / segLen;
  return {
    x: a[0] + (b[0] - a[0]) * t,
    z: a[1] + (b[1] - a[1]) * t,
    yaw: Math.atan2(b[0] - a[0], b[1] - a[1]),
  };
}
