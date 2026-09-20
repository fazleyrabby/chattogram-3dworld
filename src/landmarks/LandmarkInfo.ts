import type { NamedBuilding } from "@/world/Buildings";
import { localToGeo } from "@/geography/Projection";

export interface LandmarkInfoData {
  title: string;
  extract: string;
  url?: string;
  thumbnail?: string;
  source: "wikipedia" | "osm";
}

const REST = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const ACTION = "https://en.wikipedia.org/w/api.php";
const WIKIDATA = "https://www.wikidata.org/w/api.php";

/**
 * Best-effort educational enrichment for a landmark (spec §33a).
 *
 * Order: OSM `wikipedia` tag -> OSM `wikidata` tag sitelink -> nearest
 * geotagged Wikipedia article by coordinates. Falls back to the OSM
 * description. All content is CC BY-SA and attributed in the UI.
 */
export async function fetchLandmarkInfo(landmark: NamedBuilding): Promise<LandmarkInfoData | null> {
  const geo = localToGeo({ x: landmark.x, z: landmark.z });

  let title: string | null = null;

  if (landmark.wikipedia) {
    title = landmark.wikipedia.replace(/^[a-z-]{2}:/i, "");
  } else if (landmark.wikidata) {
    title = await wikidataTitle(landmark.wikidata);
  }

  if (!title) {
    const candidate = await geosearchTitle(geo.latitude, geo.longitude);
    // Only trust a nearby article if its title actually matches the place —
    // otherwise the panel would show an unrelated neighbour (e.g. a nearby
    // university instead of a small named building).
    if (candidate && namesMatch(landmark.name, candidate)) {
      title = candidate;
    }
  }

  if (title) {
    const summary = await wikipediaSummary(title);
    if (summary) return summary;
  }

  if (landmark.description) {
    return { title: landmark.name, extract: landmark.description, source: "osm" };
  }
  return null;
}

async function wikipediaSummary(title: string): Promise<LandmarkInfoData | null> {
  try {
    const response = await fetch(`${REST}${encodeURIComponent(title)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      title?: string;
      extract?: string;
      thumbnail?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    if (!data.extract) return null;
    const result: LandmarkInfoData = {
      title: data.title ?? title,
      extract: data.extract,
      source: "wikipedia",
    };
    const url = data.content_urls?.desktop?.page;
    if (url) result.url = url;
    const thumb = data.thumbnail?.source;
    if (thumb) result.thumbnail = thumb;
    return result;
  } catch {
    return null;
  }
}

async function wikidataTitle(qid: string): Promise<string | null> {
  try {
    const url = `${WIKIDATA}?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      entities?: Record<string, { sitelinks?: { enwiki?: { title?: string } } }>;
    };
    return data.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
  } catch {
    return null;
  }
}

async function geosearchTitle(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url =
      `${ACTION}?action=query&list=geosearch&gscoord=${latitude}%7C${longitude}` +
      `&gsradius=150&gslimit=1&format=json&origin=*`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      query?: { geosearch?: Array<{ title?: string }> };
    };
    return data.query?.geosearch?.[0]?.title ?? null;
  } catch {
    return null;
  }
}

const STOPWORDS = new Set([
  "the", "of", "and", "at", "in", "on",
  "chittagong", "chattogram", "bangladesh",
  "road", "rd", "street", "st", "lane", "bazar", "bazaar",
  "moholla", "para", "ward", "thana",
  "city", "shopping", "center", "centre", "complex", "market", "tower",
  "mosque", "masjid", "jame", "jamee", "jameya",
  "school", "college", "high", "government", "govt", "public",
  "ltd", "limited", "co", "company",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

/** Distinctive tokens (stopwords/generic words removed). */
function distinctive(value: string): string[] {
  return tokens(value).filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

/**
 * Conservative name match: either one normalized name contains the other, or
 * most of the landmark's distinctive tokens appear in the article title. This
 * stops the geosearch fallback from showing an unrelated nearby place.
 */
export function namesMatch(landmarkName: string, articleTitle: string): boolean {
  const a = normalize(landmarkName);
  const b = normalize(articleTitle);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const source = distinctive(landmarkName);
  if (source.length === 0) return false;
  const target = new Set(tokens(articleTitle));
  const overlap = source.filter((token) => target.has(token));
  return overlap.length / source.length >= 0.6;
}
