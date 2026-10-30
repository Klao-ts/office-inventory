export const BRANCHES = ["office", "factory", "store"] as const;
export type Branch = (typeof BRANCHES)[number];

export const BRANCH_LABELS: Record<Branch, string> = {
  office: "Office",
  factory: "Factory",
  store: "Store",
};

export function isBranch(value: string): value is Branch {
  return (BRANCHES as readonly string[]).includes(value);
}