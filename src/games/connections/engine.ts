/**
 * Neural Connections engine — pure, deterministic logic for a NYT-Connections
 * style puzzle on brain-science themes. No React, no DOM, no globals: fully
 * unit-testable.
 *
 * A daily puzzle deterministically draws 4 categories from a curated POOL,
 * flattens their member terms into 16 unique tiles, and verifies that no chosen
 * term plausibly belongs to another chosen category (ambiguity guard).
 */

import type { Rng } from "@/lib/rng";
import type { Difficulty } from "@/lib/types";

/** The four difficulty/colour tiers, in solve-reveal order (easy → hard). */
export const GROUP_COLORS = ["#ffb020", "#7CF5C4", "#00e5ff", "#ff2bd6"] as const;
export const GROUP_EMOJI = ["🟨", "🟩", "🟦", "🟪"] as const;

/** Number of categories per puzzle and members shown per category. */
export const GROUP_COUNT = 4;
export const GROUP_SIZE = 4;
export const TILE_COUNT = GROUP_COUNT * GROUP_SIZE; // 16
/**
 * Legacy default mistake allowance. Kept exported for backward-compat, but it is
 * no longer the source of truth — the live limit comes from `puzzle.maxMistakes`
 * which varies per difficulty tier (see {@link DIFFICULTY_RULES}).
 */
export const MAX_MISTAKES = 4;

/** Per-tier leniency: mistake allowance + whether near-miss feedback is shown. */
export const DIFFICULTY_RULES: Record<
  Difficulty,
  { maxMistakes: number; oneAway: boolean }
> = {
  easy: { maxMistakes: 6, oneAway: true },
  medium: { maxMistakes: 4, oneAway: true },
  hard: { maxMistakes: 3, oneAway: false },
};

/** A curated category in the pool: a theme plus its candidate member terms. */
export interface PoolCategory {
  label: string;
  /** >=4 candidate terms (UPPERCASE, single token preferred). */
  members: readonly string[];
  /** One-sentence brain-science insight shown on completion. */
  insight: string;
}

/** A category chosen for a specific puzzle (exactly 4 words, with colour). */
export interface PuzzleGroup {
  label: string;
  color: string;
  words: string[];
  insight: string;
}

/** The shape produced by getDailyPuzzle. */
export interface ConnectionsPuzzle {
  /** The four solution groups (index 0 = easiest/orange … 3 = hardest/magenta). */
  groups: PuzzleGroup[];
  /** All 16 words in their deterministic shuffled board order. */
  tiles: string[];
  /** Allowed wrong guesses before the game is lost (1..8, per difficulty tier). */
  maxMistakes: number;
  /** Whether to surface the "one away" near-miss feedback (off on hard). */
  oneAway: boolean;
}

/**
 * Curated pool of brain-science categories. Every member set is deliberately
 * cohesive AND chosen so its terms do not bleed into other categories' themes,
 * which keeps the daily ambiguity guard satisfiable.
 *
 * Pool size: well above the required 44.
 */
export const POOL: readonly PoolCategory[] = [
  {
    label: "NEUROTRANSMITTERS",
    members: ["DOPAMINE", "SEROTONIN", "OXYTOCIN", "ACETYLCHOLINE", "GLUTAMATE", "ENDORPHIN"],
    insight: "These chemical messengers tune mood, focus and bonding across the synaptic gap.",
  },
  {
    label: "BRAINWAVE BANDS",
    members: ["DELTA", "THETA", "ALPHA", "BETA", "GAMMA"],
    insight: "EEG frequency bands span deep-sleep Delta up to high-binding Gamma activity.",
  },
  {
    label: "MEMORY TYPES",
    members: ["WORKING", "EPISODIC", "SENSORY", "SEMANTIC", "PROCEDURAL", "PROSPECTIVE"],
    insight: "Memory is plural — a scratchpad, life events, raw senses, facts and skills.",
  },
  {
    label: "COGNITIVE BIASES",
    members: ["ANCHORING", "HALO", "RECENCY", "FRAMING", "HINDSIGHT", "CONFIRMATION"],
    insight: "Systematic mental shortcuts quietly skew our judgement and decisions.",
  },
  {
    label: "BRAIN LOBES",
    members: ["FRONTAL", "PARIETAL", "TEMPORAL", "OCCIPITAL", "INSULAR", "LIMBIC"],
    insight: "The cortex is mapped into lobes, each weighted toward different functions.",
  },
  {
    label: "DEEP BRAIN STRUCTURES",
    members: ["AMYGDALA", "HIPPOCAMPUS", "THALAMUS", "HYPOTHALAMUS", "CEREBELLUM", "PUTAMEN"],
    insight: "Subcortical hubs route emotion, memory, and sensory traffic beneath the cortex.",
  },
  {
    label: "NEURON PARTS",
    members: ["AXON", "DENDRITE", "SOMA", "SYNAPSE", "MYELIN", "TERMINAL"],
    insight: "A neuron gathers signals on dendrites and fires them down its axon.",
  },
  {
    label: "GLIAL CELLS",
    members: ["ASTROCYTE", "MICROGLIA", "OLIGODENDROCYTE", "EPENDYMAL", "SCHWANN"],
    insight: "Glia outnumber neurons, insulating, feeding and defending the nervous system.",
  },
  {
    label: "SENSES",
    members: ["VISION", "HEARING", "TOUCH", "SMELL", "TASTE", "BALANCE"],
    insight: "Each sense maps to dedicated receptors and cortical processing regions.",
  },
  {
    label: "SLEEP STAGES",
    members: ["AWAKE", "LIGHT", "DEEP", "REM", "DROWSY"],
    insight: "Sleep cycles through stages that consolidate memory and clear metabolic waste.",
  },
  {
    label: "EXECUTIVE FUNCTIONS",
    members: ["PLANNING", "INHIBITION", "FLEXIBILITY", "ATTENTION", "MONITORING"],
    insight: "The prefrontal cortex orchestrates these top-down control processes.",
  },
  {
    label: "EMOTIONS",
    members: ["JOY", "FEAR", "ANGER", "DISGUST", "SURPRISE", "SADNESS"],
    insight: "Basic emotions recruit fast circuits centred on the amygdala.",
  },
  {
    label: "LEARNING TYPES",
    members: ["CLASSICAL", "OPERANT", "OBSERVATIONAL", "LATENT", "INSIGHT"],
    insight: "Brains learn by association, consequence, imitation and sudden restructuring.",
  },
  {
    label: "INTELLIGENCE THEORIES",
    members: ["FLUID", "CRYSTALLISED", "EMOTIONAL", "SPATIAL", "PRACTICAL"],
    insight: "Psychologists model intelligence as several partly independent abilities.",
  },
  {
    label: "MEMORY DISTORTIONS",
    members: ["MISATTRIBUTION", "SUGGESTIBILITY", "BIAS", "PERSISTENCE", "BLOCKING"],
    insight: "Memory's flaws are features of a reconstructive, not a recording, system.",
  },
  {
    label: "ATTENTION TYPES",
    members: ["SUSTAINED", "SELECTIVE", "DIVIDED", "ALTERNATING", "FOCUSED"],
    insight: "Attention is a limited spotlight we shift, split and hold over time.",
  },
  {
    label: "NEUROIMAGING METHODS",
    members: ["MRI", "PET", "EEG", "FMRI", "CT", "MEG"],
    insight: "Each scanner trades spatial for temporal resolution when imaging the brain.",
  },
  {
    label: "REFLEXES",
    members: ["BLINK", "STARTLE", "KNEE", "GRASP", "GAG"],
    insight: "Reflex arcs bypass the brain, firing through the spinal cord for speed.",
  },
  {
    label: "STRESS HORMONES",
    members: ["CORTISOL", "ADRENALINE", "NORADRENALINE", "ALDOSTERONE"],
    insight: "The HPA axis floods the body with these to mobilise a threat response.",
  },
  {
    label: "PSYCHOLOGISTS",
    members: ["FREUD", "PIAGET", "PAVLOV", "SKINNER", "JUNG", "MASLOW"],
    insight: "These founders shaped how we study mind, behaviour and development.",
  },
  {
    label: "ILLUSIONS",
    members: ["MULLER", "PONZO", "EBBINGHAUS", "ZOLLNER", "KANIZSA"],
    insight: "Visual illusions expose the shortcuts the brain uses to build perception.",
  },
  {
    label: "DEFENCE MECHANISMS",
    members: ["DENIAL", "PROJECTION", "REPRESSION", "SUBLIMATION", "REGRESSION"],
    insight: "The ego deploys these to soften anxiety and protect the self-image.",
  },
  {
    label: "PERSONALITY TRAITS",
    members: ["OPENNESS", "CONSCIENTIOUSNESS", "EXTRAVERSION", "AGREEABLENESS", "NEUROTICISM"],
    insight: "The Big Five capture personality along five broad, stable dimensions.",
  },
  {
    label: "MASLOW NEEDS",
    members: ["PHYSIOLOGICAL", "SAFETY", "BELONGING", "ESTEEM", "ACTUALISATION"],
    insight: "Maslow stacked human motives into a pyramid from survival to self-growth.",
  },
  {
    label: "PIAGET STAGES",
    members: ["SENSORIMOTOR", "PREOPERATIONAL", "CONCRETE", "FORMAL"],
    insight: "Piaget charted how children's thinking restructures in distinct stages.",
  },
  {
    label: "MOTOR AREAS",
    members: ["PREMOTOR", "PRIMARY", "SUPPLEMENTARY", "BASAL", "CEREBELLAR"],
    insight: "Movement is planned and refined across a network of motor regions.",
  },
  {
    label: "SLEEP DISORDERS",
    members: ["INSOMNIA", "APNEA", "NARCOLEPSY", "PARASOMNIA", "BRUXISM"],
    insight: "Disrupted sleep architecture quickly erodes memory and emotion regulation.",
  },
  {
    label: "WAVES OF FOCUS",
    members: ["FLOW", "HYPERFOCUS", "VIGILANCE", "CONCENTRATION", "ENGAGEMENT"],
    insight: "Deep absorption states quiet self-referential brain networks.",
  },
  {
    label: "VISUAL PATHWAY",
    members: ["RETINA", "OPTIC", "LGN", "STRIATE", "CORTEX"],
    insight: "Light becomes sight along a relay from eye to visual cortex.",
  },
  {
    label: "TASTE QUALITIES",
    members: ["SWEET", "SOUR", "SALTY", "BITTER", "UMAMI"],
    insight: "Tongue receptors decode five basic tastes the brain blends into flavour.",
  },
  {
    label: "BRAIN VENTRICLES",
    members: ["LATERAL", "THIRD", "FOURTH", "CENTRAL", "CEREBRAL"],
    insight: "Fluid-filled ventricles cushion the brain and circulate spinal fluid.",
  },
  {
    label: "NEURODEGENERATIVE",
    members: ["ALZHEIMER", "PARKINSON", "HUNTINGTON", "DEMENTIA", "ALS"],
    insight: "Progressive loss of specific neuron populations drives these conditions.",
  },
  {
    label: "PHOBIAS",
    members: ["ARACHNO", "ACRO", "CLAUSTRO", "AGORA", "SOCIAL"],
    insight: "Phobias hijack the brain's threat-detection circuitry out of proportion.",
  },
  {
    label: "BRAIN CHEMICALS",
    members: ["GABA", "GLYCINE", "HISTAMINE", "ANANDAMIDE", "MELATONIN"],
    insight: "Beyond the famous few, dozens of molecules modulate neural signalling.",
  },
  {
    label: "PERCEPTION PRINCIPLES",
    members: ["PROXIMITY", "SIMILARITY", "CLOSURE", "CONTINUITY", "FIGURE"],
    insight: "Gestalt rules describe how the brain groups parts into wholes.",
  },
  {
    label: "CIRCADIAN CUES",
    members: ["SUNLIGHT", "TEMPERATURE", "MEALS", "EXERCISE", "DARKNESS"],
    insight: "External zeitgebers entrain the brain's master clock each day.",
  },
  {
    label: "DECISION TERMS",
    members: ["HEURISTIC", "UTILITY", "RISK", "REWARD", "VALENCE"],
    insight: "Choice emerges from valuing options against effort and uncertainty.",
  },
  {
    label: "CONSCIOUSNESS STATES",
    members: ["WAKING", "DREAMING", "MEDITATIVE", "HYPNAGOGIC", "COMA"],
    insight: "Consciousness shifts across a spectrum of distinct global brain modes.",
  },
  {
    label: "SYNAPSE EVENTS",
    members: ["DEPOLARISE", "REPOLARISE", "POTENTIAL", "THRESHOLD", "REFRACTORY"],
    insight: "An action potential is an all-or-nothing wave of ionic exchange.",
  },
  {
    label: "BRAIN PROTECTION",
    members: ["SKULL", "MENINGES", "DURA", "ARACHNOID", "PIA"],
    insight: "Layered membranes and bone shield the soft, vulnerable brain.",
  },
  {
    label: "LANGUAGE AREAS",
    members: ["BROCA", "WERNICKE", "ANGULAR", "ARCUATE", "FUSIFORM"],
    insight: "A left-hemisphere network lets us produce and comprehend language.",
  },
  {
    label: "REWARD CIRCUIT",
    members: ["ACCUMBENS", "VTA", "STRIATUM", "TEGMENTUM", "PALLIDUM"],
    insight: "Dopamine pathways through these hubs encode motivation and craving.",
  },
  {
    label: "THINKING STYLES",
    members: ["DIVERGENT", "CONVERGENT", "ANALYTICAL", "CRITICAL", "ABSTRACT"],
    insight: "Creative and analytic modes engage complementary brain networks.",
  },
  {
    label: "BODY CLOCKS",
    members: ["CIRCADIAN", "ULTRADIAN", "INFRADIAN", "DIURNAL", "NOCTURNAL"],
    insight: "Biological rhythms run on cycles from minutes to months.",
  },
  {
    label: "NEUROPLASTICITY",
    members: ["PRUNING", "SPROUTING", "POTENTIATION", "REWIRING", "REMAPPING"],
    insight: "The brain physically reshapes its connections in response to use.",
  },
  {
    label: "FEAR RESPONSES",
    members: ["FREEZE", "FLIGHT", "FIGHT", "FAWN", "FAINT"],
    insight: "The threat circuit picks among rapid, hard-wired survival responses.",
  },
  {
    label: "SPINAL TRACTS",
    members: ["CORTICOSPINAL", "SPINOTHALAMIC", "RETICULOSPINAL", "VESTIBULOSPINAL"],
    insight: "Ascending and descending tracts carry signals along the cord.",
  },
  {
    label: "WORD SOUNDS",
    members: ["PHONEME", "MORPHEME", "SYLLABLE", "PROSODY", "INTONATION"],
    insight: "Speech perception decomposes sound into units the brain stitches to meaning.",
  },
];

/** Lowercased, trimmed comparison key for a term. */
function key(word: string): string {
  return word.trim().toLowerCase();
}

/**
 * Ambiguity guard: returns true when no chosen word plausibly belongs to any
 * OTHER chosen category. We treat a word as a candidate of a category iff it
 * appears in that category's full member list. Because each pool category's
 * member list is curated to be disjoint from others, this reduces to a strict
 * cross-membership check.
 */
export function hasCrossMembership(
  chosen: { source: PoolCategory; words: string[] }[],
): boolean {
  for (let i = 0; i < chosen.length; i++) {
    for (let j = 0; j < chosen.length; j++) {
      if (i === j) continue;
      const otherMembers = new Set(chosen[j].source.members.map(key));
      for (const w of chosen[i].words) {
        if (otherMembers.has(key(w))) return true;
      }
    }
  }
  return false;
}

/**
 * Deterministically build a daily puzzle from a seeded RNG. Picks 4 distinct
 * categories, draws 4 words from each, enforces uniqueness + the ambiguity
 * guard, then shuffles all 16 tiles. Retries deterministically until valid.
 *
 * The 4×4 board structure is identical across tiers; difficulty only changes the
 * mistake allowance and near-miss feedback. (A distinct daily board per tier is
 * achieved upstream via a tier-specific seed — see the generator.)
 */
export function buildPuzzle(
  rng: Rng,
  difficulty: Difficulty = "medium",
): ConnectionsPuzzle {
  const { maxMistakes, oneAway } = DIFFICULTY_RULES[difficulty];
  for (let attempt = 0; attempt < 200; attempt++) {
    const order = rng.shuffle([...POOL.keys()]);
    const picks = order.slice(0, GROUP_COUNT).map((k) => POOL[k]);

    const chosen = picks.map((cat) => ({
      source: cat,
      words: rng.shuffle(cat.members).slice(0, GROUP_SIZE),
    }));

    // All 16 words unique?
    const all = chosen.flatMap((c) => c.words.map(key));
    if (new Set(all).size !== TILE_COUNT) continue;

    // No cross-membership ambiguity.
    if (hasCrossMembership(chosen)) continue;

    const groups: PuzzleGroup[] = chosen.map((c, i) => ({
      label: c.source.label,
      color: GROUP_COLORS[i],
      words: c.words.slice(),
      insight: c.source.insight,
    }));

    const tiles = rng.shuffle(groups.flatMap((g) => g.words));
    return { groups, tiles, maxMistakes, oneAway };
  }
  throw new Error("connections: failed to build a valid puzzle");
}

/** Which group index a word belongs to, or -1. */
export function groupOf(puzzle: ConnectionsPuzzle, word: string): number {
  return puzzle.groups.findIndex((g) => g.words.some((w) => key(w) === key(word)));
}

/**
 * Evaluate a 4-word guess against the solution.
 * - "correct": all four belong to a single group.
 * - "one-away": exactly three share a group with the fourth elsewhere.
 * - "wrong": otherwise.
 * Returns the matched group index when correct.
 */
export function evaluateGuess(
  puzzle: ConnectionsPuzzle,
  guess: string[],
): { result: "correct" | "one-away" | "wrong"; groupIndex: number } {
  const counts = new Array(puzzle.groups.length).fill(0);
  for (const w of guess) {
    const gi = groupOf(puzzle, w);
    if (gi >= 0) counts[gi]++;
  }
  const best = Math.max(...counts);
  const groupIndex = counts.indexOf(best);
  if (guess.length === GROUP_SIZE && best === GROUP_SIZE) {
    return { result: "correct", groupIndex };
  }
  if (best === GROUP_SIZE - 1) return { result: "one-away", groupIndex: -1 };
  return { result: "wrong", groupIndex: -1 };
}

/**
 * Hint helper: returns the index of the easiest (lowest-index, i.e. orange →
 * magenta difficulty order) group that has NOT yet been solved, or -1 if every
 * group is already solved. Pure and deterministic — no globals, no randomness.
 *
 * The UI uses this to auto-reveal one unsolved category as a solved row.
 */
export function getHint(
  puzzle: ConnectionsPuzzle,
  solvedIndices: readonly number[],
): number {
  const solved = new Set(solvedIndices);
  for (let i = 0; i < puzzle.groups.length; i++) {
    if (!solved.has(i)) return i;
  }
  return -1;
}

/** Validate a puzzle is well-formed and unambiguous. */
export function validateConnections(p: ConnectionsPuzzle): boolean {
  if (!p || !Array.isArray(p.groups) || p.groups.length !== GROUP_COUNT) return false;
  if (!Array.isArray(p.tiles) || p.tiles.length !== TILE_COUNT) return false;

  // Difficulty leniency fields: maxMistakes is an integer in 1..8; oneAway bool.
  if (
    typeof p.maxMistakes !== "number" ||
    !Number.isInteger(p.maxMistakes) ||
    p.maxMistakes < 1 ||
    p.maxMistakes > 8
  ) {
    return false;
  }
  if (typeof p.oneAway !== "boolean") return false;

  const seen = new Set<string>();
  for (let i = 0; i < p.groups.length; i++) {
    const g = p.groups[i];
    if (!g.label || g.label.length === 0) return false;
    if (!g.insight || g.insight.length === 0) return false;
    if (g.color !== GROUP_COLORS[i]) return false;
    if (!Array.isArray(g.words) || g.words.length !== GROUP_SIZE) return false;
    for (const w of g.words) {
      if (!w || w.length === 0) return false;
      const k = key(w);
      if (seen.has(k)) return false; // duplicate across all 16
      seen.add(k);
    }
  }
  if (seen.size !== TILE_COUNT) return false;

  // tiles must be exactly the 16 group words (a permutation).
  const tileKeys = p.tiles.map(key).sort();
  const wordKeys = p.groups.flatMap((g) => g.words.map(key)).sort();
  for (let i = 0; i < TILE_COUNT; i++) {
    if (tileKeys[i] !== wordKeys[i]) return false;
  }

  // Ambiguity guard against the pool: rebuild source mapping and check.
  const chosen = p.groups.map((g) => {
    const source = POOL.find((c) => c.label === g.label);
    if (!source) return null;
    return { source, words: g.words };
  });
  if (chosen.some((c) => c === null)) return false;
  if (hasCrossMembership(chosen as { source: PoolCategory; words: string[] }[])) {
    return false;
  }

  return true;
}
