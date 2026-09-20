export interface QuestStop {
  /** Must match a named building's `name` exactly. */
  landmark: string;
}

export interface Quest {
  id: string;
  title: string;
  subtitle: string;
  stops: QuestStop[];
}

/**
 * A first guided route through real Chittagong landmarks in the spawn district
 * (spec §75 quests/missions). Discover a stop by walking up to it.
 */
export const CHEARGI_WALK: Quest = {
  id: "cheragi-walk",
  title: "The Cheragi Pahar Walk",
  subtitle: "A short loop through old Chittagong",
  stops: [
    { landmark: "Anderkilla Shahi Jame Masjid" },
    { landmark: "Andarkilla Book Market" },
    { landmark: "Chittagong City Corporation" },
    { landmark: "Municipal Shopping Center" },
    { landmark: "Kadam Mobarak Shahi Jame Mosque" },
  ],
};
