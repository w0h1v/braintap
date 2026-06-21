import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import type { Rng } from "@/lib/rng";
import type { Difficulty } from "@/lib/types";
import {
  ATTR_KEYS,
  GRID,
  ROWS,
  COLS,
  cellIdx,
  computeLayer,
  domainOf,
  emptyTile,
  satisfiesAllRules,
  tilesEqual,
  TIERS,
  validateMatrix,
  type AttrKey,
  type MatrixPuzzle,
  type Rule,
  type RuleKind,
  type Tile,
  type TierConfig,
} from "./engine";

const cache = new Map<string, MatrixPuzzle>();

/** Which rule kinds are legal for a given attribute. */
function kindsForAttr(attr: AttrKey, allowed: RuleKind[], paletteSize: number): RuleKind[] {
  const dom = domainOf(attr, paletteSize);
  return allowed.filter((k) => {
    if (k === "arithmetic") return attr === "count";
    if (k === "distinct") return dom >= 3; // needs >=3 distinct base values
    return true;
  });
}

/** Assign distinct attributes to rules so two rules never fight over one attribute. */
function assignRules(rng: Rng, tier: TierConfig): Rule[] {
  const ruleCount = rng.int(tier.minRules, tier.maxRules);
  const attrs = rng.shuffle(ATTR_KEYS).slice(0, ruleCount);
  const rules: Rule[] = [];

  for (const attr of attrs) {
    const kinds = kindsForAttr(attr, tier.allowedRuleKinds, tier.paletteSize);
    // Bias toward progression/constant for legibility; specials are rarer.
    const kind = rng.pick(kinds);
    let axis: "row" | "col" = rng.chance(0.5) ? "row" : "col";
    // arithmetic is inherently per-row; pin axis to row for clarity.
    if (kind === "arithmetic") axis = "row";
    const m = domainOf(attr, tier.paletteSize);
    const step = kind === "progression" ? (rng.chance(0.65) ? 1 : 2) : undefined;
    rules.push({ attr, kind, axis, step, modulo: m });
  }

  // Guarantee at least one ROW-axis rule so rows 0/1 fully demonstrate it.
  if (!rules.some((r) => r.axis === "row")) {
    // flip a non-arithmetic, non-distinct rule (distinct is axis-agnostic anyway).
    const flip = rules.find((r) => r.kind !== "arithmetic") ?? rules[0];
    flip.axis = "row";
  }
  // Hard guarantees at least one COL-axis rule.
  if (tier.requireColAxis && !rules.some((r) => r.axis === "col")) {
    const flip =
      rules.find((r) => r.kind !== "arithmetic" && r.kind !== "distinct" && r.axis === "row") ??
      rules.find((r) => r.kind !== "arithmetic");
    if (flip) flip.axis = "col";
  }
  // Ensure there is always an "easy foothold": at least one progression or
  // constant rule alongside any special (distinct/arithmetic) rule.
  const hasSpecial = rules.some((r) => r.kind === "distinct" || r.kind === "arithmetic");
  const hasFoothold = rules.some((r) => r.kind === "progression" || r.kind === "constant");
  if (hasSpecial && !hasFoothold) {
    const tgt = rules.find((r) => r.kind === "distinct" || r.kind === "arithmetic");
    if (tgt && tgt.kind !== "arithmetic") {
      tgt.kind = "progression";
      tgt.step = 1;
    } else if (tgt) {
      // arithmetic can't become a per-cell rule cleanly; demote to progression.
      tgt.kind = "progression";
      tgt.step = 1;
    }
  }

  return rules;
}

/** Build the 9-cell grid from rules. Unruled attributes are held constant. */
function buildGrid(rng: Rng, rules: Rule[], paletteSize: number): Tile[] {
  const ruled = new Map<AttrKey, Rule>();
  for (const r of rules) ruled.set(r.attr, r);

  const cells: Tile[] = Array.from({ length: GRID }, () => emptyTile());

  for (const attr of ATTR_KEYS) {
    const dom = domainOf(attr, paletteSize);
    const rule = ruled.get(attr);
    if (!rule) {
      // No rule: hold constant grid-wide at a fixed decorative value.
      const v = rng.int(0, dom - 1);
      for (let i = 0; i < GRID; i++) cells[i][attr] = v;
      continue;
    }
    if (rule.kind === "arithmetic") {
      // Choose per-row bases for cols 0 & 1 such that the sum stays in-domain
      // (count domain is 4 => values 0..3; pick a+b < dom).
      for (let r = 0; r < ROWS; r++) {
        let a: number;
        let b: number;
        // re-roll until the sum fits the domain (no wrap) for a fair, readable rule.
        let guard = 0;
        do {
          a = rng.int(0, dom - 1);
          b = rng.int(0, dom - 1);
          guard += 1;
        } while (a + b >= dom && guard < 40);
        if (a + b >= dom) {
          a = rng.int(0, Math.floor((dom - 1) / 2));
          b = rng.int(0, dom - 1 - a);
        }
        cells[cellIdx(r, 0)][attr] = a;
        cells[cellIdx(r, 1)][attr] = b;
      }
      const layer = computeLayer(rule, 0, cells);
      for (let i = 0; i < GRID; i++) cells[i][attr] = layer[i];
      continue;
    }
    // constant / progression / distinct: choose a base and apply.
    let base: number;
    if (rule.kind === "constant") {
      base = rng.int(0, dom - 1);
    } else if (rule.kind === "progression") {
      base = rng.int(0, dom - 1);
    } else {
      // distinct (Latin) — base just rotates the permutation.
      base = rng.int(0, dom - 1);
    }
    const layer = computeLayer(rule, base, cells);
    for (let i = 0; i < GRID; i++) cells[i][attr] = layer[i];
  }

  return cells;
}

/**
 * Build distractors: clone the answer and mutate exactly ONE ruled attribute to
 * a value that provably fails that rule at cell 8. Dedupe against the answer and
 * other distractors. Hard adds one "swap trap" that exchanges two correct
 * attributes with a sibling cell.
 */
function buildDistractors(
  rng: Rng,
  cells: Tile[],
  rules: Rule[],
  tier: TierConfig,
): Tile[] {
  const answer = cells[GRID - 1];
  const need = tier.optionCount - 1;
  const distractors: Tile[] = [];
  const ruledAttrs = rules.map((r) => r.attr);

  const isDuplicate = (t: Tile): boolean =>
    tilesEqual(t, answer) || distractors.some((d) => tilesEqual(d, t));

  // Candidate wrong values for an attribute that FAIL that attribute's rule.
  const wrongValues = (attr: AttrKey): number[] => {
    const dom = domainOf(attr, tier.paletteSize);
    const out: number[] = [];
    for (let v = 0; v < dom; v++) {
      if (v === answer[attr]) continue;
      const trial: Tile = { ...answer, [attr]: v };
      // Must fail the FULL rule set (mutating a ruled attr to a wrong value
      // should break exactly that rule; verify the whole tile is now invalid).
      if (!satisfiesAllRules(rules, cells, trial)) out.push(v);
    }
    return out;
  };

  // Precompute wrong-value pools per ruled attribute.
  const pools = new Map<AttrKey, number[]>();
  for (const attr of ruledAttrs) pools.set(attr, rng.shuffle(wrongValues(attr)));

  // Hard "swap trap": swap two ruled attribute values from a sibling cell into
  // the answer, producing a tile that satisfies all-but-(at least one) rule.
  if (tier.swapTrap && ruledAttrs.length >= 2) {
    const shuffledAttrs = rng.shuffle(ruledAttrs);
    const a1 = shuffledAttrs[0];
    const a2 = shuffledAttrs[1];
    // pull values from a neighbouring cell (cell 7) for plausibility.
    const sibling = cells[GRID - 2];
    const trap: Tile = { ...answer, [a1]: sibling[a1], [a2]: sibling[a2] };
    if (!isDuplicate(trap) && !satisfiesAllRules(rules, cells, trap)) {
      distractors.push(trap);
    }
  }

  // One distractor per ruled attribute (cycle if more distractors needed).
  let attrCursor = 0;
  let guard = 0;
  while (distractors.length < need && guard < 400) {
    guard += 1;
    const attr = ruledAttrs[attrCursor % ruledAttrs.length];
    attrCursor += 1;
    const pool = pools.get(attr) ?? [];
    let made: Tile | null = null;
    for (const v of pool) {
      const cand: Tile = { ...answer, [attr]: v };
      if (!isDuplicate(cand)) {
        made = cand;
        break;
      }
    }
    if (made) {
      distractors.push(made);
      continue;
    }
    // Fallback: mutate two ruled attributes to wrong values (guaranteed-different).
    if (ruledAttrs.length >= 2) {
      const a1 = ruledAttrs[attrCursor % ruledAttrs.length];
      const a2 = ruledAttrs[(attrCursor + 1) % ruledAttrs.length];
      const p1 = pools.get(a1) ?? [];
      const p2 = pools.get(a2) ?? [];
      let placed = false;
      for (const v1 of p1) {
        for (const v2 of p2) {
          const cand: Tile = { ...answer, [a1]: v1, [a2]: v2 };
          if (!isDuplicate(cand) && !satisfiesAllRules(rules, cells, cand)) {
            distractors.push(cand);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (placed) continue;
    }
    // Last-resort fallback: mutate an unruled attribute (still differs from the
    // answer, still fails because... it may NOT fail). To be safe, combine with
    // a wrong ruled value if any pool is non-empty; otherwise mutate any attr.
    const anyPool = ruledAttrs.find((a) => (pools.get(a) ?? []).length > 0);
    if (anyPool) {
      const v = (pools.get(anyPool) ?? [])[0];
      for (const k of ATTR_KEYS) {
        const dom = domainOf(k, tier.paletteSize);
        for (let alt = 0; alt < dom; alt++) {
          const cand: Tile = { ...answer, [anyPool]: v, [k]: alt };
          if (!isDuplicate(cand) && !satisfiesAllRules(rules, cells, cand)) {
            distractors.push(cand);
            break;
          }
        }
        if (distractors.length >= need || guard > 380) break;
      }
    } else {
      break; // cannot make more distinct failing distractors
    }
  }

  return distractors;
}

function generate(dateISO: string, difficulty: Difficulty): MatrixPuzzle {
  const tier = TIERS[difficulty];
  // Re-roll the whole pipeline (advancing the seed) until validateMatrix passes.
  // In practice the first attempt almost always passes; the loop is a safety net.
  for (let attempt = 0; attempt < 60; attempt++) {
    const rng = rngFromString(
      `matrix:${difficultySeed("matrix", dateISO, difficulty)}:${attempt}`,
    );
    const rules = assignRules(rng, tier);
    const cells = buildGrid(rng, rules, tier.paletteSize);
    const distractors = buildDistractors(rng, cells, rules, tier);
    if (distractors.length < tier.optionCount - 1) continue;
    const answer = cells[GRID - 1];
    const options = rng.shuffle([answer, ...distractors]);
    const answerIndex = options.findIndex((o) => tilesEqual(o, answer));
    const puzzle: MatrixPuzzle = {
      difficulty,
      cells,
      rules,
      options,
      answerIndex,
      optionCount: tier.optionCount,
      strikes: tier.strikes,
      paletteSize: tier.paletteSize,
    };
    if (validateMatrix(puzzle)) return puzzle;
  }
  // Should never happen given the validators; throw to surface a generator bug.
  throw new Error(`matrix: failed to generate a valid puzzle for ${dateISO}/${difficulty}`);
}

/** Deterministic daily puzzle for a date + tier (memoised per date:difficulty). */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): MatrixPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const puzzle = generate(dateISO, difficulty);
  cache.set(key, puzzle);
  return puzzle;
}
