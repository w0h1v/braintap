import type { GameId, GameMeta } from "@/lib/types";

/**
 * Canonical metadata for all 15 games. This is the single source of truth for
 * the hub grid, rotation, and routing. Individual game modules import their
 * meta from here so the platform stays consistent.
 */

const ACCENTS = {
  cyan: { from: "#00e5ff", to: "#7b8cff", solid: "#00e5ff", soft: "#9fe9ff" },
  magenta: { from: "#ff2bd6", to: "#ff7ae0", solid: "#ff2bd6", soft: "#ffb3ec" },
  peri: { from: "#86a3ff", to: "#00e5ff", solid: "#86a3ff", soft: "#b3c2ff" },
  amber: { from: "#ffb020", to: "#ff7a18", solid: "#ffb020", soft: "#ffcf7a" },
  mint: { from: "#7CF5C4", to: "#00e5ff", solid: "#7CF5C4", soft: "#9bf7d3" },
  violet: { from: "#9b8cff", to: "#00e5ff", solid: "#9b8cff", soft: "#c3b8ff" },
  orange: { from: "#ff9e3d", to: "#ff6b9d", solid: "#ff9e3d", soft: "#ffc58a" },
} as const;

export const GAME_METAS: Record<GameId, GameMeta> = {
  connections: {
    id: "connections",
    name: "Neural Connections",
    tagline: "Group 16 terms into four hidden brain-science categories.",
    category: "VERBAL",
    estMinutes: 4,
    accent: ACCENTS.cyan,
    skills: ["verbal", "logic"],
    icon: "connections",
    insight:
      "Sorting sixteen terms into four hidden groups exercises semantic memory and cognitive flexibility — your brain forms, tests and discards category hypotheses until the connections click.",
  },
  brainle: {
    id: "brainle",
    name: "Synapse Wordle",
    tagline: "Guess the 5-letter mind word in six tries.",
    category: "VERBAL",
    estMinutes: 3,
    accent: ACCENTS.magenta,
    skills: ["verbal"],
    icon: "brainle",
    insight:
      "Each guess prunes a vast search space — your brain runs a Bayesian update, narrowing the possibilities with every clue, the same way it predicts the world.",
  },
  strands: {
    id: "strands",
    name: "Mind Strands",
    tagline: "Find the hidden words in a themed letter grid — including the spangram.",
    category: "VERBAL",
    estMinutes: 6,
    accent: ACCENTS.peri,
    skills: ["verbal", "focus"],
    icon: "strands",
    insight:
      "Tracing themed words through a letter grid blends lexical retrieval with visual search — your vocabulary network and spatial attention working in tandem.",
  },
  forge: {
    id: "forge",
    name: "Focus Forge",
    tagline: "Solve the picross from the number clues to reveal today's hidden glyph.",
    category: "LOGIC · NONOGRAM",
    estMinutes: 4,
    accent: ACCENTS.amber,
    skills: ["logic", "spatial"],
    icon: "forge",
    insight:
      "Nonograms recruit the parietal lobe's spatial reasoning while your working memory juggles overlapping row and column constraints — deduction made visual.",
  },
  weaver: {
    id: "weaver",
    name: "Idea Weaver",
    tagline: "Spell as many words as you can from seven letters — the center one is required.",
    category: "CREATIVE · SPELL",
    estMinutes: 5,
    accent: ACCENTS.mint,
    skills: ["verbal"],
    icon: "weaver",
    insight:
      "Hunting for words from a fixed set of letters exercises your brain's lexical retrieval network — the same word-finding circuitry that keeps verbal fluency sharp with age.",
  },
  vault: {
    id: "vault",
    name: "Memory Vault",
    tagline: "Watch the pattern light up, then rebuild it from memory.",
    category: "MEMORY · RECALL",
    estMinutes: 2,
    accent: ACCENTS.cyan,
    skills: ["memory"],
    icon: "vault",
    insight:
      "Most people hold only about four items in working memory at once; practising spatial-pattern recall gradually nudges that ceiling upward.",
  },
  teasers: {
    id: "teasers",
    name: "Tap Teasers",
    tagline: "Five lateral-thinking riddles. Pick the answer, then unlock the aha.",
    category: "LATERAL · RIDDLE",
    estMinutes: 3,
    accent: ACCENTS.magenta,
    skills: ["logic", "verbal"],
    icon: "teasers",
    insight:
      "Lateral-thinking riddles force your brain off its well-worn associative paths, strengthening the cognitive flexibility that powers creative problem-solving.",
  },
  sudoku: {
    id: "sudoku",
    name: "Mini Sudoku",
    tagline: "Fill the grid so every row, column and 2×3 box holds 1 to 6.",
    category: "NUMBER · 6×6",
    estMinutes: 5,
    accent: ACCENTS.violet,
    skills: ["logic", "numeric"],
    icon: "sudoku",
    insight:
      "Sudoku leans on working memory and deductive logic — you hold candidate numbers in mind while systematically ruling out the impossible.",
  },
  sprint: {
    id: "sprint",
    name: "Sum Sprint",
    tagline: "Tap numbers that add up to the target before the clock runs out.",
    category: "NUMBER · SPEED",
    estMinutes: 1,
    accent: ACCENTS.mint,
    skills: ["numeric", "focus"],
    icon: "sprint",
    insight:
      "Fast mental arithmetic trains processing speed and your brain's approximate number system — the circuitry that estimates quantities at a glance.",
  },
  pips: {
    id: "pips",
    name: "Pips",
    tagline: "Lay dominoes across the board so every coloured region meets its rule.",
    category: "NUMBER · DOMINOES",
    estMinutes: 3,
    accent: ACCENTS.orange,
    skills: ["logic", "numeric"],
    icon: "pips",
    insight:
      "Domino logic exercises constraint satisfaction — the prefrontal cortex juggles several rules at once while it searches for the one arrangement that fits them all.",
  },
  g2048: {
    id: "g2048",
    name: "2048",
    tagline: "Slide and merge matching tiles. Plan ahead to reach the 2048 tile.",
    category: "NUMBER · SPATIAL",
    estMinutes: 5,
    accent: ACCENTS.violet,
    skills: ["numeric", "spatial"],
    icon: "g2048",
    insight:
      "Sliding-tile games blend spatial planning with arithmetic — you're running a constant cost-benefit search several moves ahead, a workout for the brain's executive-function network.",
  },
  schulte: {
    id: "schulte",
    name: "Schulte Table",
    tagline: "Tap 1 to 25 in order as fast as you can.",
    category: "FOCUS · SPEED",
    estMinutes: 1,
    accent: ACCENTS.cyan,
    skills: ["focus"],
    icon: "schulte",
    insight:
      "Schulte tables train peripheral vision and visual attention — keeping your eyes fixed on the centre while the numbers are found widens your useful field of view.",
  },
  simon: {
    id: "simon",
    name: "Sequence Echo",
    tagline: "Watch the colors and tones, then echo the growing sequence back.",
    category: "MEMORY · RECALL",
    estMinutes: 2,
    accent: ACCENTS.magenta,
    skills: ["memory", "focus"],
    icon: "simon",
    insight:
      "Repeating a growing sequence taxes your phonological loop and spatial sketchpad at once — the two scratchpads of working memory — and chunking the pattern into groups is how experts push past seven.",
  },
  slide: {
    id: "slide",
    name: "Tile Slide",
    tagline: "Slide the tiles to order them 1 to 15. Fewer moves, faster time.",
    category: "SPATIAL · 15-PUZZLE",
    estMinutes: 4,
    accent: ACCENTS.cyan,
    skills: ["spatial", "logic"],
    icon: "slide",
    insight:
      "Sliding puzzles build mental rotation and look-ahead planning — you simulate moves in your mind's eye before committing, the same spatial machinery that maps a city or packs a suitcase.",
  },
  reversi: {
    id: "reversi",
    name: "Reversi",
    tagline: "Outflank the BrainTap AI to flip the board your colour. Claim the corners.",
    category: "STRATEGY · VS AI",
    estMinutes: 6,
    accent: ACCENTS.mint,
    skills: ["logic", "spatial"],
    icon: "reversi",
    insight:
      "Territory games train look-ahead and inhibition — resisting the move that flips the most discs now in favour of the corner that wins the board later.",
  },
  crossword: {
    id: "crossword",
    name: "Mini Crossword",
    tagline: "Fill the mini grid from across and down clues — a daily test of word recall.",
    category: "VERBAL · CROSSWORD",
    estMinutes: 4,
    accent: ACCENTS.peri,
    skills: ["verbal", "memory"],
    icon: "crossword",
    insight:
      "Reconstructing words from definitional clues exercises semantic memory and the brain's word-retrieval network — the same \"tip-of-the-tongue\" circuitry that keeps verbal fluency sharp with age.",
  },
  matrix: {
    id: "matrix",
    name: "Pattern Matrix",
    tagline: "Read the hidden rules across the 3×3 grid, then pick the tile that completes it.",
    category: "LOGIC · MATRIX",
    estMinutes: 3,
    accent: ACCENTS.peri,
    skills: ["logic", "spatial"],
    icon: "matrix",
    insight:
      "Abstract matrix reasoning is the purest lab measure of fluid intelligence — your brain induces hidden rules from sparse examples, the same inductive engine behind learning anything new.",
  },
  stroop: {
    id: "stroop",
    name: "Stroop Rush",
    tagline: "Tap the ink colour, not the word. Beat the clock without slipping.",
    category: "FOCUS · SPEED",
    estMinutes: 2,
    accent: ACCENTS.magenta,
    skills: ["focus", "logic"],
    icon: "stroop",
    insight:
      "Reading is so automatic that naming the ink of a mismatched colour word forces your prefrontal cortex to override the reflex — the classic measure of inhibitory control and selective attention.",
  },
  mathsprint: {
    id: "mathsprint",
    name: "Mental Math Sprint",
    tagline: "Solve as many rapid-fire arithmetic problems as you can before the clock runs out.",
    category: "NUMBER · SPEED",
    estMinutes: 2,
    accent: ACCENTS.amber,
    skills: ["numeric", "focus"],
    icon: "mathsprint",
    insight:
      "Rapid single-fact arithmetic drills the brain's fact-retrieval circuits and processing speed, shifting effortful calculation toward instant recall — the automaticity that frees working memory for harder thinking.",
  },
  spotchange: {
    id: "spotchange",
    name: "Spot the Change",
    tagline: "Memorize the grid, then spot the one cell that changed.",
    category: "MEMORY · SPATIAL",
    estMinutes: 2,
    accent: ACCENTS.orange,
    skills: ["memory", "spatial"],
    icon: "spotchange",
    insight:
      "Visual working memory holds only a handful of object-feature bindings at once, so spotting the single changed cell forces your brain to compare a stored snapshot against the present scene — the core of everyday change-detection.",
  },
};

/** Display order on the hub grid (matches the prototype). */
export const GAME_ORDER: GameId[] = [
  "connections",
  "brainle",
  "strands",
  "forge",
  "weaver",
  "vault",
  "teasers",
  "sudoku",
  "sprint",
  "pips",
  "g2048",
  "schulte",
  "simon",
  "slide",
  "reversi",
  "crossword",
  "matrix",
  "stroop",
  "mathsprint",
  "spotchange",
];

/** Weekly rotation (highlighted "featured" game per weekday). */
export const ROTATION: Record<string, GameId> = {
  Mon: "connections",
  Tue: "brainle",
  Wed: "strands",
  Thu: "forge",
  Fri: "weaver",
  Sat: "vault",
  Sun: "teasers",
};
