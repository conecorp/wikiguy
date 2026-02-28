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

const CATEGORY_WIKI_MAP = {
    "1286781988669231166": "super-blox-64",
    "1389381096436793484": "superstar-racers",
    "1454904248943771748": "a-blocks-journey"
};

const toggleContribScore = true;
const STATUS_INTERVAL_MS = 5 * 60 * 1000;

// --- DISCORD STATUSES ---
const STATUS_OPTIONS = [
    { type: 4, text: "just send [[a page]] or {{a page}}!" },
    { type: 4, text: "now supporting 3 wikis!" },
    { type: 4, text: "use [[sb64:page]] for SUPER BLOX 64! embedding" },
    { type: 4, text: "use [[sr:Page]] for Superstar Racers embedding" },
    { type: 4, text: "use [[abj:Page]] for A Block's Journey embedding" },
    { type: 4, text: "ablocksjourney.wiki" },
    { type: 4, text: "superstarracers.wiki" },
    { type: 4, text: "superblox64.wiki" },
    { type: 4, text: "conecorp.cc" },
    { type: 4, text: "₊˚⊹⋆" },
    { type: 4, text: "⋆｡𖦹°⭒˚｡⋆" },
    { type: 4, text: "✶⋆.˚" },
    { type: 4, text: "°˖➴" },
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
    STATUS_INTERVAL_MS,
    STATUS_OPTIONS
};
