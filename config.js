// --- WIKI CONFIGURATION ---
const BOT_NAME = "Wiki Guy"; 

const WIKIS = {
    "super-blox-64": {
        name: "SUPER BLOX 64!",
        baseUrl: "https://sb64.conecorp.cc",
        apiEndpoint: "https://sb64.conecorp.cc/w/api.php",
        articlePath: "https://sb64.conecorp.cc/",
        prefix: "sb64",
        emoji: "1472436401680158741"
    },
    "superstar-racers": {
        name: "Superstar Racers",
        baseUrl: "https://sr.conecorp.cc",
        apiEndpoint: "https://sr.conecorp.cc/w/api.php",
        articlePath: "https://sr.conecorp.cc/",
        prefix: "sr",
        emoji: "1472436382998728714"
    },
    "a-blocks-journey": {
        name: "A Block's Journey",
        baseUrl: "https://abj.conecorp.cc",
        apiEndpoint: "https://abj.conecorp.cc/w/api.php",
        articlePath: "https://abj.conecorp.cc/",
        prefix: "abj",
        emoji: "1472436415760568460"
    }
};

// IDs may be either Discord channel IDs or category IDs. The resolver checks
// the current channel first, then its parent/category, so a channel entry
// applies only to that channel while a category entry applies to its channels.
const CATEGORY_WIKI_MAP = {
    "1286781988669231166": "super-blox-64",
    "1389381096436793484": "superstar-racers",
    "1454904248943771748": "a-blocks-journey"
};

const toggleContribScore = true;

const SPEEDRUN_EMOJI = "1477323785366540439";

const STATUS_INTERVAL_MS = 5 * 60 * 1000;

// --- DISCORD STATUSES ---
const STATUS_OPTIONS = [
    { type: 4, text: "just send [[a page]] or {{a page}}!" },
    { type: 4, text: "use [[sb64:page]] for SUPER BLOX 64! embedding" },
    { type: 4, text: "use [[sr:Page]] for Superstar Racers embedding" },
    { type: 4, text: "use [[abj:Page]] for A Block's Journey embedding" },
    { type: 4, text: "abj.conecorp.cc" },
    { type: 4, text: "sr.conecorp.cc" },
    { type: 4, text: "sb64.conecorp.cc" },
    { type: 0, text: "SUPER BLOX 64!" },
    { type: 0, text: "Superstar Racers" },
    { type: 0, text: "A Block's Journey" },
    { type: 5, text: "SUPER BLOX 64!" },
    { type: 5, text: "Superstar Racers" },
    { type: 5, text: "A Block's Journey" },
    { type: 3, text: "A Block's Journey teaser trailer" },
    { type: 4, text: "edit your message and my embed will too!" },
    { type: 4, text: "react with :wastebasket: on my messages & i'll delete!" },
];

module.exports = {
    BOT_NAME,
    WIKIS,
    CATEGORY_WIKI_MAP,
    toggleContribScore,
    SPEEDRUN_EMOJI,
    STATUS_INTERVAL_MS,
    STATUS_OPTIONS
};
