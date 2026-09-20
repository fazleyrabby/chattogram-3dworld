import type { RoadData } from "@/world/Roads";

interface Edge {
  to: number;
  length: number;
}

/**
 * A routable graph built from the major-road polylines. Vertices are merged by
 * rounding local coordinates to 1 m so ways that share OSM nodes connect.
 * Routing is Dijkstra over the resulting graph — enough for "walk/drive to a
 * destination" guidance. Crossings that share no node stay disconnected; callers
 * fall back to a straight line when no path exists.
 */
export class RoadGraph {
  private readonly nodes: Array<[number, number]> = [];
  private readonly adj: Edge[][] = [];
  private readonly index = new Map<string, number>();

  constructor(roads: RoadData[]) {
    for (const road of roads) {
      let previous = -1;
      for (const [x, z] of road.points) {
        const id = this.nodeId(x, z);
        if (previous >= 0 && previous !== id) {
          const length = Math.hypot(x - this.nodes[previous]![0], z - this.nodes[previous]![1]);
          this.adj[previous]!.push({ to: id, length });
          this.adj[id]!.push({ to: previous, length });
        }
        previous = id;
      }
    }
  }

  private nodeId(x: number, z: number): number {
    const key = `${Math.round(x)},${Math.round(z)}`;
    const existing = this.index.get(key);
    if (existing !== undefined) return existing;
    const id = this.nodes.length;
    this.nodes.push([x, z]);
    this.adj.push([]);
    this.index.set(key, id);
    return id;
  }

  nearestNode(x: number, z: number): number {
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i]!;
      const dx = node[0] - x;
      const dz = node[1] - z;
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  /** Returns a path of [x, z] points from (fx,fz) to (tx,tz), or null. */
  route(fx: number, fz: number, tx: number, tz: number): Array<[number, number]> | null {
    if (this.nodes.length === 0) return null;
    const start = this.nearestNode(fx, fz);
    const goal = this.nearestNode(tx, tz);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [[fx, fz], [tx, tz]];

    const dist = new Float64Array(this.nodes.length).fill(Infinity);
    const prev = new Int32Array(this.nodes.length).fill(-1);
    const visited = new Uint8Array(this.nodes.length);
    dist[start] = 0;

    const heap = new MinHeap();
    heap.push(start, 0);

    while (heap.size > 0) {
      const current = heap.pop();
      if (current === goal) break;
      if (visited[current]) continue;
      visited[current] = 1;

      for (const edge of this.adj[current]!) {
        if (visited[edge.to]) continue;
        const next = dist[current]! + edge.length;
        if (next < dist[edge.to]!) {
          dist[edge.to] = next;
          prev[edge.to] = current;
          heap.push(edge.to, next);
        }
      }
    }

    if (prev[goal] === -1 && start !== goal) return null;

    const path: Array<[number, number]> = [];
    let node = goal;
    while (node !== -1) {
      path.push(this.nodes[node]!);
      if (node === start) break;
      node = prev[node]!;
    }
    path.reverse();
    return [[fx, fz], ...path, [tx, tz]];
  }
}

/** Binary min-heap keyed by priority. */
class MinHeap {
  private readonly items: number[] = [];
  private readonly priorities: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.priorities.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priorities[parent]! <= this.priorities[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0]!;
    const lastItem = this.items.pop()!;
    const lastPriority = this.priorities.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.priorities[0] = lastPriority;
      let i = 0;
      const n = this.items.length;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < n && this.priorities[left]! < this.priorities[smallest]!) smallest = left;
        if (right < n && this.priorities[right]! < this.priorities[smallest]!) smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b]!, this.priorities[a]!];
  }
}
