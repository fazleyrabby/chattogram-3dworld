import type { NamedBuilding } from "@/world/Buildings";
import type { RoadData } from "@/world/Roads";
import type { SearchItem } from "@/navigation/Navigation";

/** Landmarks + named roads, searchable. */
export function buildSearchIndex(named: NamedBuilding[], roads: RoadData[]): SearchItem[] {
  const items: SearchItem[] = named.map((l) => ({
    name: l.name,
    kind: "landmark",
    x: l.x,
    z: l.z,
  }));

  const byName = new Map<string, Array<[number, number]>>();
  for (const road of roads) {
    if (!road.name) continue;
    const points = byName.get(road.name) ?? [];
    for (const p of road.points) points.push(p);
    byName.set(road.name, points);
  }
  for (const [name, points] of byName) items.push({ name, kind: "road", points });
  return items;
}

/**
 * Destination search (spec extension). Type to filter landmarks and roads,
 * Enter/click to set a route. Toggle with the slash key; Escape closes.
 */
export class SearchBox {
  private readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly resultsEl: HTMLDivElement;
  private readonly items: SearchItem[];
  private opened = false;

  constructor(
    parent: HTMLElement,
    items: SearchItem[],
    private readonly onSelect: (item: SearchItem) => void,
    private readonly onClear: () => void,
  ) {
    this.items = items;
    this.root = document.createElement("div");
    this.root.className = "search";
    this.root.hidden = true;
    this.root.innerHTML = `
      <input class="search__input" type="text" placeholder="Search a place or road…" autocomplete="off" spellcheck="false" />
      <div class="search__results" data-results></div>
      <button class="search__clear" type="button">Clear route</button>
    `;
    parent.appendChild(this.root);

    this.input = this.root.querySelector(".search__input") as HTMLInputElement;
    this.resultsEl = this.root.querySelector("[data-results]") as HTMLDivElement;
    (this.root.querySelector(".search__clear") as HTMLButtonElement).addEventListener("click", () => {
      this.onClear();
      this.close();
    });

    this.input.addEventListener("input", () => this.render());
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const first = this.resultsEl.querySelector<HTMLButtonElement>(".search__item");
        if (first) first.click();
      }
    });
  }

  get isOpen(): boolean {
    return this.opened;
  }

  toggle(): void {
    this.opened ? this.close() : this.open();
  }

  open(): void {
    this.opened = true;
    this.root.hidden = false;
    this.render();
    this.input.focus();
    this.input.select();
  }

  close(): void {
    this.opened = false;
    this.root.hidden = true;
    this.input.blur();
  }

  private render(): void {
    const query = this.input.value.trim().toLowerCase();
    this.resultsEl.innerHTML = "";
    if (query.length < 2) {
      this.resultsEl.innerHTML = `<div class="search__hint">Type at least 2 letters.</div>`;
      return;
    }

    const matches = this.items
      .filter((item) => item.name.toLowerCase().includes(query))
      .slice(0, 8);

    if (matches.length === 0) {
      this.resultsEl.innerHTML = `<div class="search__hint">No places found.</div>`;
      return;
    }

    for (const item of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search__item";
      button.innerHTML = `<span>${escapeHtml(item.name)}</span><span class="search__kind">${item.kind}</span>`;
      button.addEventListener("click", () => {
        this.onSelect(item);
        this.close();
      });
      this.resultsEl.appendChild(button);
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
