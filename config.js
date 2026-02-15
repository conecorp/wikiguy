// --- WIKI CONFIGURATION ---
const BOT_NAME = "Orbital"; 

const WIKIS = {
    "super-blox-64": {
        name: "SUPER BLOX 64!",
        baseUrl: "https://superblox64.wiki",
        apiEndpoint: "https://superblox64.wiki/w/api.php",
        articlePath: "https://superblox64.wiki/",
        prefix: "sb64",
        emoji: "1472436401680158741"
    },
    "superstar-racers": {
        name: "Superstar Racers",
        baseUrl: "https://superstarracers.wiki",
        apiEndpoint: "https://superstarracers.wiki/w/api.php",
        articlePath: "https://superstarracers.wiki/",
        prefix: "sr",
        emoji: "1472436382998728714"
    },
    "a-blocks-journey": {
        name: "A Block's Journey",
        baseUrl: "https://ablocksjourney.wiki",
        apiEndpoint: "https://ablocksjourney.wiki/w/api.php",
        articlePath: "https://ablocksjourney.wiki/",
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
];

module.exports = {
    BOT_NAME,
    WIKIS,
    CATEGORY_WIKI_MAP,
    toggleContribScore,
    STATUS_OPTIONS
};
