/**
 * Synapse Wordle ("Brainle") word data.
 *
 * `ANSWERS` — the curated daily answer bank (>=365 five-letter words, all
 * uppercase). Brain/cognition-themed words come first (these also seed the hint
 * database), followed by a large pool of common English words so the bank walks
 * a full year without repeats.
 *
 * `VALID` — the full set of guesses we accept. It is a superset of `ANSWERS`:
 * every answer is guessable, plus hundreds of extra common words.
 *
 * Source data adapted from design_src/brainle-words.js, then expanded to satisfy
 * the >=365 bank requirement.
 */

/** Brain/cognition-themed answers (curated, kept first; drive the hint bank). */
export const THEMED: readonly string[] = [
  "BRAIN", "FOCUS", "SLEEP", "DREAM", "LOGIC", "ALPHA", "THETA", "GAMMA", "SENSE", "NERVE",
  "AWAKE", "RELAX", "LEARN", "THINK", "PULSE", "LUCID", "VIVID", "HABIT", "SMART", "QUIET",
  "CHILL", "DRIVE", "STUDY", "CALMS", "MOODS", "ALERT", "SHARP", "NEURO", "SYNCH", "WAVES",
];

/** Hints, keyed by themed answer (verbatim from the design spec). */
export const HINTS: Readonly<Record<string, string>> = {
  BRAIN: "Three pounds of you that rewires itself every day.",
  FOCUS: "Attention is a spotlight — this is where you point it.",
  SLEEP: "When the brain clears metabolic waste and files memory.",
  DREAM: "REM theatre where the mind rehearses and consolidates.",
  LOGIC: "The prefrontal cortex doing its slow, careful thing.",
  ALPHA: "8–12 Hz — the relaxed, idling rhythm of a calm mind.",
  THETA: "4–8 Hz — drowsy, creative, deep-meditation territory.",
  GAMMA: "40 Hz — bound-together perception and peak focus.",
  SENSE: "Five streams of data your cortex stitches into reality.",
  NERVE: "A cable of axons carrying the body's electrical mail.",
  AWAKE: "Cortical arousal, courtesy of your reticular system.",
  RELAX: "Down-shift the sympathetic nervous system.",
  LEARN: "Neurons that fire together, wire together.",
  THINK: "Default-mode and executive networks taking turns.",
  PULSE: "The rhythmic beat entrainment locks onto.",
  LUCID: "Aware that you are dreaming, mid-dream.",
  VIVID: "High-salience memory the amygdala tagged as important.",
  HABIT: "Behaviour the basal ganglia automated for you.",
  SMART: "Fluid reasoning plus the knowledge you've stored.",
  QUIET: "The low-noise state where insight tends to surface.",
  CHILL: "Parasympathetic tone, rest-and-digest.",
  DRIVE: "Dopamine's pull toward a goal.",
  STUDY: "Spaced repetition beats cramming, every time.",
  CALMS: "What slow breathing does to your vagus nerve.",
  MOODS: "Affective weather, set partly by neurotransmitters.",
  ALERT: "Norepinephrine sharpening your signal-to-noise.",
  SHARP: "Cognitive acuity on a good day.",
  NEURO: "The prefix for everything in this game.",
  SYNCH: "When brain regions oscillate in phase.",
  WAVES: "What an EEG actually measures.",
};

/** A generic, brain-flavoured fallback hint for non-themed answers. */
export const GENERIC_HINT =
  "A five-letter word — let your pattern-matching cortex do the work.";

/**
 * Large pool of common 5-letter English words. Combined with THEMED to form the
 * answer bank, and with EXTRA to form the valid-guess set.
 */
const COMMON: readonly string[] = [
  "ABOUT", "ABOVE", "ABUSE", "ACTOR", "ACUTE", "ADMIT", "ADOPT", "ADULT", "AFTER", "AGAIN",
  "AGENT", "AGREE", "AHEAD", "ALARM", "ALBUM", "ALIVE", "ALLOW", "ALONE", "ALONG", "ALTER",
  "ANGEL", "ANGER", "ANGLE", "ANGRY", "APART", "APPLE", "APPLY", "ARENA", "ARGUE", "ARISE",
  "ARRAY", "ARROW", "ASIDE", "ASSET", "AUDIO", "AUDIT", "AVOID", "AWARD", "AWARE", "BADLY",
  "BAKER", "BASES", "BASIC", "BEACH", "BEGAN", "BEGIN", "BEING", "BELOW", "BENCH", "BIRTH",
  "BLACK", "BLAME", "BLANK", "BLAST", "BLIND", "BLOCK", "BLOOD", "BLOOM", "BOARD", "BOAST",
  "BOOST", "BOOTH", "BOUND", "BRAND", "BRAVE", "BREAD", "BREAK", "BREED", "BRIEF", "BRING",
  "BROAD", "BROKE", "BROWN", "BUILD", "BUILT", "BUYER", "CABLE", "CARRY", "CATCH", "CAUSE",
  "CHAIN", "CHAIR", "CHAOS", "CHARM", "CHART", "CHASE", "CHEAP", "CHECK", "CHEST", "CHIEF",
  "CHILD", "CHINA", "CHOSE", "CIVIL", "CLAIM", "CLASS", "CLEAN", "CLEAR", "CLICK", "CLIMB",
  "CLOCK", "CLOSE", "CLOUD", "COACH", "COAST", "COUNT", "COURT", "COVER", "CRAFT", "CRANE",
  "CRASH", "CRAZY", "CREAM", "CRIME", "CROSS", "CROWD", "CROWN", "CRUDE", "CURVE", "CYCLE",
  "DAILY", "DANCE", "DEALT", "DEATH", "DELAY", "DEPTH", "DOING", "DOUBT", "DOZEN", "DRAFT",
  "DRAMA", "DRANK", "DRAWN", "DREAD", "DRESS", "DRIED", "DRILL", "DRINK", "DROVE", "DYING",
  "EAGER", "EARLY", "EARTH", "EIGHT", "ELDER", "ELECT", "ELITE", "EMPTY", "ENEMY", "ENJOY",
  "ENTER", "ENTRY", "EQUAL", "ERROR", "EVENT", "EVERY", "EXACT", "EXIST", "EXTRA", "FAITH",
  "FALSE", "FANCY", "FAULT", "FAVOR", "FENCE", "FEVER", "FEWER", "FIBER", "FIELD", "FIFTH",
  "FIFTY", "FIGHT", "FINAL", "FIRST", "FIXED", "FLAME", "FLASH", "FLEET", "FLOOR", "FLUID",
  "FOCAL", "FORCE", "FORTH", "FORTY", "FORUM", "FOUND", "FRAME", "FRANK", "FRAUD", "FRESH",
  "FRONT", "FROST", "FRUIT", "FULLY", "FUNNY", "GIANT", "GIVEN", "GLASS", "GLOBE", "GLORY",
  "GOING", "GRACE", "GRADE", "GRAIN", "GRAND", "GRANT", "GRAPH", "GRASP", "GRASS", "GREAT",
  "GREEN", "GREET", "GRIEF", "GROSS", "GROUP", "GROWN", "GUARD", "GUESS", "GUEST", "GUIDE",
  "HANDS", "HAPPY", "HARSH", "HEART", "HEAVY", "HENCE", "HORSE", "HOTEL", "HOUSE", "HUMAN",
  "IDEAL", "IMAGE", "IMPLY", "INDEX", "INNER", "INPUT", "ISSUE", "JOINT", "JUDGE", "KNOWN",
  "LABEL", "LARGE", "LASER", "LATER", "LAUGH", "LAYER", "LEAST", "LEAVE", "LEGAL", "LEVEL",
  "LIGHT", "LIMIT", "LINKS", "LIVES", "LOCAL", "LOOSE", "LOWER", "LOYAL", "LUCKY", "LUNCH",
  "LYING", "MAGIC", "MAJOR", "MAKER", "MARCH", "MATCH", "MAYBE", "MAYOR", "MEANT", "MEDAL",
  "MEDIA", "METAL", "MIGHT", "MINOR", "MINUS", "MIXED", "MODEL", "MONEY", "MONTH", "MORAL",
  "MOTOR", "MOUNT", "MOUSE", "MOUTH", "MOVIE", "MUSIC", "NEEDS", "NEVER", "NEWLY", "NIGHT",
  "NOISE", "NORTH", "NOTED", "NOVEL", "NURSE", "OCCUR", "OCEAN", "OFFER", "OFTEN", "ORDER",
  "ORGAN", "OTHER", "OUGHT", "PAINT", "PANEL", "PAPER", "PARTY", "PEACE", "PHASE", "PHONE",
  "PHOTO", "PIANO", "PIECE", "PILOT", "PITCH", "PLACE", "PLAIN", "PLANE", "PLANT", "PLATE",
  "POINT", "POUND", "POWER", "PRESS", "PRICE", "PRIDE", "PRIME", "PRINT", "PRIOR", "PRIZE",
  "PROOF", "PROUD", "PROVE", "QUEEN", "QUEST", "QUICK", "QUITE", "RADIO", "RAISE", "RANGE",
  "RAPID", "RATIO", "REACH", "READY", "REALM", "REBEL", "REFER", "RIGHT", "RIVAL", "RIVER",
  "ROBOT", "ROUGH", "ROUND", "ROUTE", "ROYAL", "RURAL", "SCALE", "SCENE", "SCOPE", "SCORE",
  "SERVE", "SETUP", "SEVEN", "SHALL", "SHAPE", "SHARE", "SHEET", "SHELF", "SHELL", "SHIFT",
  "SHINE", "SHIRT", "SHOCK", "SHOOT", "SHORE", "SHORT", "SHOWN", "SIGHT", "SIGMA", "SILLY",
  "SINCE", "SIXTH", "SIXTY", "SIZED", "SKILL", "SLIDE", "SMALL", "SMILE", "SMOKE", "SOLID",
  "SOLVE", "SORRY", "SOUND", "SOUTH", "SPACE", "SPARE", "SPEAK", "SPEED", "SPELL", "SPEND",
  "SPENT", "SPLIT", "SPOKE", "SPORT", "STAFF", "STAGE", "STAKE", "STAND", "START", "STATE",
  "STEAM", "STEEL", "STEEP", "STEPS", "STICK", "STILL", "STOCK", "STONE", "STOOD", "STORE",
  "STORM", "STORY", "STRIP", "STUCK", "STUFF", "STYLE", "SUGAR", "SUITE", "SUPER", "SWEET",
  "SWIFT", "SWING", "TABLE", "TAKEN", "TASTE", "TEACH", "TEETH", "TERMS", "THANK", "THEFT",
  "THEIR", "THEME", "THERE", "THESE", "THICK", "THING", "THIRD", "THOSE", "THREE", "THREW",
  "THROW", "TIGHT", "TIMES", "TIRED", "TITLE", "TODAY", "TOPIC", "TOTAL", "TOUCH", "TOUGH",
  "TOWER", "TRACE", "TRACK", "TRADE", "TRAIL", "TRAIN", "TREAT", "TREND", "TRIAL", "TRIBE",
  "TRICK", "TRIED", "TRULY", "TRUST", "TRUTH", "TWICE", "UNCLE", "UNDER", "UNDUE", "UNION",
  "UNITY", "UNTIL", "UPPER", "UPSET", "URBAN", "USAGE", "USUAL", "VALID", "VALUE", "VIDEO",
  "VIRUS", "VISIT", "VITAL", "VOCAL", "VOICE", "WASTE", "WATCH", "WATER", "WHEEL", "WHERE",
  "WHICH", "WHILE", "WHITE", "WHOLE", "WHOSE", "WOMAN", "WORLD", "WORRY", "WORSE", "WORST",
  "WORTH", "WOULD", "WOUND", "WRITE", "WRONG", "WROTE", "YIELD", "YOUNG", "YOUTH",
];

/** Extra accepted guesses (not used as daily answers, broaden the dictionary). */
const EXTRA: readonly string[] = [
  "ABIDE", "ABBEY", "ABYSS", "ACORN", "ADAPT", "ADEPT", "ADORE", "AGILE", "AISLE", "AMBER",
  "AMEND", "AMPLE", "ANKLE", "ANNEX", "ANNOY", "AORTA", "APPLE", "APRON", "ARROW", "ASHEN",
  "BACON", "BADGE", "BAGEL", "BANJO", "BARGE", "BASIL", "BATCH", "BATON", "BAYOU", "BEADY",
  "BEFIT", "BEGET", "BERRY", "BEZEL", "BISON", "BLAZE", "BLEAK", "BLEND", "BLESS", "BLINK",
  "BLISS", "BLOAT", "BLUNT", "BLURB", "BOGUS", "BOOST", "BOOTH", "BOTCH", "BRACE", "BRAID",
  "BRASH", "BRAWL", "BREWS", "BRINE", "BRINK", "BRISK", "BROIL", "BROOK", "BROOM", "BROTH",
  "BUDGE", "BUGLE", "BULKY", "BUNCH", "BURLY", "BURST", "CABIN", "CACTI", "CADET", "CADDY",
  "CAGEY", "CAMEL", "CANAL", "CANDY", "CANNY", "CANON", "CAPER", "CARGO", "CAROL", "CARVE",
  "CEDAR", "CHAFE", "CHALK", "CHAMP", "CHANT", "CHARD", "CHEEK", "CHEER", "CHEWY", "CHIDE",
  "CHIME", "CHIRP", "CHOIR", "CHOMP", "CHORD", "CHUCK", "CHUMP", "CHUNK", "CHURN", "CIDER",
  "CIGAR", "CINCH", "CIVIC", "CLAMP", "CLANG", "CLANK", "CLASP", "CLEAT", "CLEFT", "CLERK",
  "CLING", "CLINK", "CLOAK", "CLOMP", "CLOTH", "CLOVE", "CLOWN", "CLUCK", "CLUMP", "CLUNG",
  "COBRA", "COCOA", "COLON", "COMET", "COMFY", "CONIC", "COPSE", "CORAL", "CORNY", "COUCH",
  "COUGH", "COVET", "COWER", "COYLY", "CRAMP", "CRANK", "CRATE", "CRAVE", "CRAWL", "CRAZE",
  "CREAK", "CREED", "CREEK", "CREPT", "CRESS", "CREST", "CRICK", "CRISP", "CROAK", "CROCK",
  "CRONE", "CRONY", "CROOK", "CROUP", "CRUEL", "CRUMB", "CRUMP", "CRUSH", "CRUST", "CRYPT",
  "CUBIC", "CUMIN", "CURIO", "CURLY", "CURRY", "CURSE", "CURVY", "CYNIC", "DADDY", "DAISY",
  "DALLY", "DANDY", "DATUM", "DAUNT", "DEBAR", "DEBIT", "DEBUG", "DECAL", "DECAY", "DECOR",
  "DECOY", "DECRY", "DEFER", "DEIGN", "DEITY", "DELTA", "DELVE", "DEMON", "DENIM", "DEPOT",
  "DERBY", "DETER", "DEVIL", "DIARY", "DICEY", "DIGIT", "DIMLY", "DINGO", "DINGY", "DITCH",
  "DITTY", "DIVER", "DODGE", "DODGY", "DOGMA", "DOILY", "DONOR", "DONUT", "DOUSE", "DOWDY",
  "DOWEL", "DOWNY", "DOWRY", "DRAIN", "DRAKE", "DRAPE", "DRAWL", "DREAM", "DREGS", "DRIFT",
  "DROIT", "DROLL", "DRONE", "DROOL", "DROOP", "DROSS", "DROWN", "DRUID", "DRUNK", "DRYER",
  "DULLY", "DUMMY", "DUMPY", "DUNCE", "DUSKY", "DUTCH", "DWARF", "DWELL", "DWELT", "EAGLE",
  "EASEL", "EATEN", "EBONY", "EDICT", "EERIE", "EGRET", "ELBOW", "ELDER", "ELOPE", "ELUDE",
  "EMBED", "EMBER", "ENACT", "ENDOW", "ENNUI", "EPOCH", "EQUIP", "ERECT", "ERODE", "ERUPT",
  "ESSAY", "ETHIC", "ETHOS", "EVADE", "EVOKE", "EXALT", "EXCEL", "EXERT", "EXPEL", "EXUDE",
  "EXULT", "FABLE", "FACET", "FAINT", "FAIRY", "FANGS", "FATAL", "FATTY", "FAUNA", "FEAST",
  "FEIGN", "FELON", "FERAL", "FERRY", "FETAL", "FETCH", "FETID", "FETUS", "FIEND", "FIERY",
  "FILER", "FILET", "FILMY", "FILTH", "FINCH", "FINER", "FIORD", "FIXER", "FIZZY", "FJORD",
  "FLACK", "FLAIL", "FLAIR", "FLAKE", "FLAKY", "FLANK", "FLARE", "FLECK", "FLING", "FLINT",
  "FLIRT", "FLOAT", "FLOCK", "FLONG", "FLOOD", "FLORA", "FLOSS", "FLOUR", "FLOUT", "FLOWN",
  "FLUFF", "FLUKE", "FLUME", "FLUNG", "FLUNK", "FLUSH", "FLUTE", "FOAMY", "FOGGY", "FOIST",
  "FOLIO", "FOLLY", "FORAY", "FORGE", "FORGO", "FORTE", "FOYER", "FRAIL", "FREAK", "FREED",
  "FRIAR", "FRIED", "FRILL", "FRISK", "FROCK", "FROND", "FROTH", "FROWN", "FROZE", "FUDGE",
  "FUGUE", "FUNGI", "FUSSY", "FUZZY", "GABLE", "GAILY", "GAMUT", "GASSY", "GAUDY", "GAUGE",
  "GAUNT", "GAUZE", "GAVEL", "GAWKY", "GAYLY", "GAZER", "GECKO", "GEEKY", "GENIE", "GENRE",
  "GHOUL", "GIDDY", "GIRTH", "GIZMO", "GLADE", "GLAND", "GLARE", "GLAZE", "GLEAM", "GLEAN",
  "GLIDE", "GLINT", "GLOAT", "GLOOM", "GLYPH", "GNASH", "GNOME", "GODLY", "GOLEM", "GONER",
  "GOOSE", "GORGE", "GOUGE", "GOURD", "GRADY", "GRAVE", "GRAVY", "GRAZE", "GRIDS", "GRILL",
  "GRIME", "GRIMY", "GRIND", "GRIPE", "GROAN", "GROIN", "GROOM", "GROPE", "GROUT", "GROVE",
  "GRUEL", "GRUFF", "GRUNT", "GUILD", "GUILE", "GUISE", "GULCH", "GULLY", "GUMBO", "GUMMY",
  "GUPPY", "GUSTO", "GUSTY", "GYPSY", "HAIRY", "HALVE", "HANDY", "HARDY", "HAREM", "HASTE",
  "HASTY", "HATCH", "HAVEN", "HAVOC", "HAZEL", "HEADY", "HEFTY", "HEIST", "HELIX", "HERON",
  "HILLY", "HINGE", "HIPPO", "HITCH", "HOARD", "HOBBY", "HOIST", "HOLLY", "HONEY", "HONOR",
  "HOVEL", "HOVER", "HUMID", "HUMOR", "HUMPH", "HUNCH", "HUSKY", "HUTCH", "HYENA", "HYMNS",
  "ICILY", "ICING", "IDIOM", "IDIOT", "IGLOO", "ILIAC", "INANE", "INEPT", "INFER", "INGOT",
  "INLAY", "INLET", "IRATE", "IRONY", "ISLET", "IVORY", "JADED", "JAUNT", "JAZZY", "JELLY",
  "JERKY", "JETTY", "JEWEL", "JIFFY", "JOIST", "JOLLY", "JOUST", "JUICE", "JUICY", "JUMBO",
  "JUMPY", "JUNTA", "JUROR", "KAPPA", "KARMA", "KAYAK", "KEBAB", "KHAKI", "KINKY", "KIOSK",
  "KITTY", "KNACK", "KNAVE", "KNEAD", "KNEEL", "KNELT", "KNIFE", "KNOCK", "KOALA", "KUDOS",
  "LABOR", "LACED", "LADEN", "LADLE", "LANCE", "LANKY", "LAPEL", "LARVA", "LATCH", "LATHE",
  "LEAFY", "LEAKY", "LEAPT", "LEDGE", "LEECH", "LEMON", "LEMUR", "LIBEL", "LILAC", "LIMBO",
  "LINEN", "LINER", "LINGO", "LIVID", "LLAMA", "LOBBY", "LOFTY", "LOGIC", "LOOPY", "LOTUS",
  "LOUSE", "LOUSY", "LOWLY", "LUMEN", "LUNAR", "LUNGE", "LUPUS", "LURID", "LUSTY", "LYMPH",
  "LYNCH", "LYRIC", "MACAW", "MACHO", "MADAM", "MADLY", "MAFIA", "MAIZE", "MAMBO", "MANGO",
  "MANGY", "MANIA", "MANOR", "MAPLE", "MARSH", "MASON", "MAUVE", "MAXIM", "MEALY", "MECCA",
  "MELON", "MERGE", "MERIT", "MERRY", "MESSY", "MIDST", "MIMIC", "MINCE", "MINER", "MIRTH",
  "MOCHA", "MOGUL", "MOIST", "MOLAR", "MOLDY", "MONKS", "MOOSE", "MOPED", "MORON", "MOSSY",
  "MOTIF", "MOTTO", "MOULT", "MOUSY", "MOVER", "MUCKY", "MUDDY", "MULCH", "MUMMY", "MUNCH",
  "MURAL", "MURKY", "MUSHY", "MUSKY", "MUSTY", "MUTED", "NADIR", "NAIVE", "NANNY", "NAPPY",
  "NASAL", "NASTY", "NAVAL", "NEEDY", "NEIGH", "NERDY", "NEWER", "NICHE", "NIECE", "NIFTY",
  "NINJA", "NINNY", "NINTH", "NOBLE", "NOMAD", "NOOSE", "NOSEY", "NUDGE", "NUTTY", "NYLON",
  "NYMPH", "OAKEN", "OASIS", "OFFAL", "OLDEN", "OLIVE", "OMEGA", "ONION", "ONSET", "OOZED",
  "OPERA", "OPINE", "OPIUM", "OPTIC", "ORBIT", "OUNCE", "OUTDO", "OUTER", "OVARY", "OVATE",
  "OWING", "OXIDE", "OZONE", "PADDY", "PAGAN", "PALSY", "PANIC", "PANSY", "PARKA", "PARRY",
  "PASTA", "PASTE", "PASTY", "PATCH", "PATIO", "PATTY", "PAUSE", "PAYEE", "PEACH", "PEARL",
  "PEDAL", "PENAL", "PERCH", "PERIL", "PERKY", "PESKY", "PESTO", "PETAL", "PETTY", "PHONY",
  "PICKY", "PIECE", "PIETY", "PINCH", "PINKY", "PINTO", "PIPER", "PIQUE", "PITHY", "PIVOT",
  "PIXEL", "PIXIE", "PIZZA", "PLAID", "PLANK", "PLAZA", "PLEAD", "PLEAT", "PLIED", "PLUCK",
  "PLUMB", "PLUME", "PLUMP", "PLUNK", "PLUSH", "POACH", "PODGY", "POESY", "POISE", "POKER",
  "POLKA", "POLYP", "POOCH", "POPPY", "PORCH", "POSER", "POSIT", "POTTY", "POUCH", "POUTY",
  "PRANK", "PRAWN", "PREEN", "PRESS", "PRICK", "PRIED", "PRIER", "PRIMP", "PRISM", "PRIVY",
  "PROBE", "PRONE", "PRONG", "PROSE", "PROXY", "PRUDE", "PRUNE", "PSALM", "PUDGY", "PUFFY",
  "PUNCH", "PUPIL", "PUPPY", "PUREE", "PURER", "PURGE", "PURSE", "PUSHY", "PUTTY", "PYGMY",
  "QUACK", "QUAIL", "QUAKE", "QUALM", "QUARK", "QUART", "QUASH", "QUASI", "QUELL", "QUERY",
  "QUEUE", "QUILL", "QUILT", "QUIRK", "QUOTA", "QUOTE", "RABID", "RACER", "RADAR", "RAINY",
  "RALLY", "RAMEN", "RANCH", "RANDY", "RASPY", "RAVEN", "RAYON", "RAZOR", "REBUT", "RECAP",
  "REGAL", "REHAB", "REIGN", "RELAY", "RELIC", "REMIT", "RENAL", "REPAY", "REPEL", "REPLY",
  "RERUN", "RESET", "RESIN", "RETCH", "RETRO", "RHINO", "RHYME", "RIDGE", "RIFLE", "RINSE",
  "RIPEN", "RISEN", "RISER", "RISKY", "RIVET", "ROACH", "ROAST", "ROBIN", "ROCKY", "RODEO",
  "ROGUE", "ROOMY", "ROOST", "ROTOR", "ROUSE", "ROUST", "ROVER", "ROWDY", "ROWER", "RUDDY",
  "RUGBY", "RULER", "RUMBA", "RUMOR", "RUNIC", "RUNNY", "RUSTY", "SADLY", "SAINT", "SALAD",
  "SALON", "SALSA", "SALTY", "SALVE", "SALVO", "SANDY", "SAPPY", "SASSY", "SATIN", "SATYR",
  "SAUCE", "SAUCY", "SAUNA", "SAVOR", "SAVVY", "SCALD", "SCALP", "SCAMP", "SCANT", "SCARE",
  "SCARF", "SCARY", "SCION", "SCOFF", "SCOLD", "SCONE", "SCOUR", "SCOUT", "SCOWL", "SCRAM",
  "SCRAP", "SCREE", "SCREW", "SCRUB", "SCRUM", "SCUBA", "SEDAN", "SEEDY", "SEPIA", "SERIF",
  "SERUM", "SHACK", "SHADE", "SHADY", "SHAFT", "SHAKE", "SHAKY", "SHALE", "SHAME", "SHANK",
  "SHARK", "SHAWL", "SHEAR", "SHEEN", "SHEEP", "SHEER", "SHIED", "SHINY", "SHIRE", "SHOAL",
  "SHONE", "SHOOK", "SHRED", "SHREW", "SHRUB", "SHRUG", "SHUCK", "SHUNT", "SHUSH", "SHYLY",
  "SIEGE", "SIEVE", "SILKY", "SILLY", "SINEW", "SINGE", "SIREN", "SISSY", "SKATE", "SKIER",
  "SKIFF", "SKIMP", "SKIRT", "SKULK", "SKULL", "SKUNK", "SLACK", "SLAIN", "SLANG", "SLANT",
  "SLASH", "SLATE", "SLAVE", "SLEEK", "SLEET", "SLICE", "SLICK", "SLIME", "SLIMY", "SLING",
  "SLINK", "SLOOP", "SLOPE", "SLOSH", "SLOTH", "SLUMP", "SLUNG", "SLUNK", "SLURP", "SLUSH",
  "SLYLY", "SMACK", "SMASH", "SMEAR", "SMELL", "SMELT", "SMIRK", "SMITE", "SMITH", "SMOCK",
  "SMOTE", "SNACK", "SNAIL", "SNAKE", "SNARE", "SNARL", "SNEAK", "SNEER", "SNIDE", "SNIFF",
  "SNIPE", "SNOOP", "SNORE", "SNORT", "SNOUT", "SNOWY", "SNUCK", "SNUFF", "SOAPY", "SOBER",
  "SOGGY", "SOLAR", "SONAR", "SONIC", "SOOTH", "SOOTY", "SOWER", "SPADE", "SPANK", "SPARK",
  "SPASM", "SPAWN", "SPEAR", "SPECK", "SPERM", "SPICE", "SPICY", "SPIED", "SPIEL", "SPIKE",
  "SPIKY", "SPINE", "SPINY", "SPIRE", "SPITE", "SPLAT", "SPOIL", "SPOOF", "SPOOK", "SPOOL",
  "SPOON", "SPORE", "SPOUT", "SPRAY", "SPREE", "SPRIG", "SPUNK", "SPURN", "SPURT", "SQUAD",
  "SQUAT", "SQUIB", "STACK", "STAID", "STAIN", "STAIR", "STALE", "STALK", "STALL", "STAMP",
  "STANK", "STARK", "STASH", "STAVE", "STEAD", "STEAK", "STEED", "STEIN", "STERN", "STIFF",
  "STING", "STINK", "STINT", "STOIC", "STOKE", "STOLE", "STOMP", "STOOL", "STOOP", "STORK",
  "STOUT", "STOVE", "STRAP", "STRAW", "STRAY", "STREW", "STRUM", "STRUT", "STUMP", "STUNG",
  "STUNK", "STUNT", "SUAVE", "SULKY", "SULLY", "SUMAC", "SUNNY", "SURER", "SURGE", "SURLY",
  "SUSHI", "SWAMI", "SWAMP", "SWASH", "SWATH", "SWEAR", "SWEAT", "SWEEP", "SWELL", "SWEPT",
  "SWILL", "SWINE", "SWIRL", "SWISH", "SWOON", "SWOOP", "SWORD", "SWORE", "SWORN", "SWUNG",
  "SYRUP", "TABBY", "TABOO", "TACIT", "TACKY", "TAFFY", "TALON", "TANGO", "TANGY", "TAPER",
  "TAPIR", "TARDY", "TAROT", "TASTY", "TATTY", "TAUNT", "TAWNY", "TEARY", "TEASE", "TEDDY",
  "TEMPO", "TENET", "TENOR", "TENSE", "TEPEE", "TEPID", "TESTY", "THANE", "THIGH", "THORN",
  "THUMB", "THUMP", "THYME", "TIARA", "TIBIA", "TIDAL", "TIGER", "TILDE", "TIMID", "TINGE",
  "TIPSY", "TITAN", "TITHE", "TOAST", "TODDY", "TOKEN", "TONAL", "TONGA", "TONIC", "TOOTH",
  "TORCH", "TOXIC", "TOXIN", "TRACT", "TRAIT", "TRAMP", "TRASH", "TRAWL", "TREAD", "TREAT",
  "TRESS", "TROLL", "TROOP", "TROPE", "TROUT", "TRUCE", "TRUCK", "TRUMP", "TRUNK", "TRUSS",
  "TUBAL", "TULIP", "TUNIC", "TURBO", "TUTOR", "TWANG", "TWEAK", "TWEED", "TWEET", "TWINE",
  "TWIRL", "TWIST", "TWIXT", "ULCER", "ULTRA", "UMBRA", "UNCAP", "UNCUT", "UNDID", "UNFIT",
  "UNIFY", "UNLIT", "UNMET", "UNSET", "UNTIE", "UNWED", "UNZIP", "USHER", "USURP", "UTTER",
  "VAGUE", "VALET", "VALOR", "VAULT", "VAUNT", "VEGAN", "VENOM", "VENUE", "VERGE", "VERSE",
  "VERSO", "VEXED", "VICAR", "VIGIL", "VIGOR", "VILLA", "VINYL", "VIOLA", "VIPER", "VISOR",
  "VISTA", "VIXEN", "VOILA", "VOMIT", "VOTER", "VOUCH", "VOWEL", "VYING", "WACKY", "WAFER",
  "WAGER", "WAGON", "WAIST", "WAIVE", "WALTZ", "WARES", "WARTY", "WEARY", "WEAVE", "WEDGE",
  "WEEDY", "WEIGH", "WEIRD", "WELCH", "WELSH", "WENCH", "WHACK", "WHALE", "WHARF", "WHEAT",
  "WHELP", "WHIFF", "WHINE", "WHINY", "WHIRL", "WHISK", "WHOOP", "WIDEN", "WIDER", "WIDOW",
  "WIDTH", "WIELD", "WIMPY", "WINCE", "WINCH", "WINDY", "WIPER", "WISPY", "WITTY", "WOKEN",
  "WOOZY", "WORDY", "WORLD", "WORRY", "WOVEN", "WRACK", "WRATH", "WREAK", "WRECK", "WREST",
  "WRING", "WRIST", "WRUNG", "YACHT", "YEARN", "YEAST", "YODEL", "YOKEL", "YOLKS", "YUMMY",
  "ZEBRA", "ZESTY", "ZONAL",
];

/** Deduped, ordered answer bank: themed words first, then common words. */
export const ANSWERS: readonly string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of [...THEMED, ...COMMON]) {
    if (w.length === 5 && /^[A-Z]+$/.test(w) && !seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
})();

/** The full set of valid guesses (superset of the answer bank). */
export const VALID: ReadonlySet<string> = (() => {
  const s = new Set<string>();
  for (const w of [...ANSWERS, ...EXTRA]) {
    if (w.length === 5 && /^[A-Z]+$/.test(w)) s.add(w);
  }
  return s;
})();
