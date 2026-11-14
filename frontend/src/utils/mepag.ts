export interface MepagGoal {
  id: "GOAL_I" | "GOAL_II" | "GOAL_III" | "GOAL_IV";
  label: string;
  shortLabel: string;
  theme: string;
  badgeClass: string;
  colorHex: string;
}

export function getMepagGoalForCategory(category?: string): MepagGoal {
  const cat = (category || "").toLowerCase();

  if (
    cat.includes("astrobiology") ||
    cat.includes("biosignature") ||
    cat.includes("life") ||
    cat.includes("lake") ||
    cat.includes("organic") ||
    cat.includes("delta") ||
    cat.includes("clay")
  ) {
    return {
      id: "GOAL_I",
      label: "MEPAG Goal I: Life & Biosignatures",
      shortLabel: "MEPAG I (Life)",
      theme: "Biosignature & Habitable Environments",
      badgeClass: "text-emerald-400 bg-emerald-950/40 border-emerald-800/60",
      colorHex: "#10b981",
    };
  }

  if (
    cat.includes("climate") ||
    cat.includes("paleohydrology") ||
    cat.includes("mineral") ||
    cat.includes("water") ||
    cat.includes("ice") ||
    cat.includes("weather")
  ) {
    return {
      id: "GOAL_II",
      label: "MEPAG Goal II: Climate History",
      shortLabel: "MEPAG II (Climate)",
      theme: "Aqueous Alteration & Volatiles",
      badgeClass: "text-cyan-400 bg-cyan-950/40 border-cyan-800/60",
      colorHex: "#06b6d4",
    };
  }

  if (
    cat.includes("isru") ||
    cat.includes("resource") ||
    cat.includes("human") ||
    cat.includes("traverse")
  ) {
    return {
      id: "GOAL_IV",
      label: "MEPAG Goal IV: Human Exploration",
      shortLabel: "MEPAG IV (Human)",
      theme: "In-Situ Resource Utilization & Crew Safety",
      badgeClass: "text-purple-400 bg-purple-950/40 border-purple-800/60",
      colorHex: "#a855f7",
    };
  }

  return {
    id: "GOAL_III",
    label: "MEPAG Goal III: Geology & Evolution",
    shortLabel: "MEPAG III (Geology)",
    theme: "Crustal Evolution & Geomorphology",
    badgeClass: "text-amber-400 bg-amber-950/40 border-amber-800/60",
    colorHex: "#f59e0b",
  };
}
