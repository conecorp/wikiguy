// --- WIKI CONFIGURATION ---
const BOT_NAME = "Orbital"; 

const WIKIS = {
    "super-blox-64": {
        name: "Super Blox 64",
        baseUrl: "https://superblox64.wiki",
        apiEndpoint: "https://superblox64.wiki/w/api.php",
        articlePath: "https://superblox64.wiki/wiki/",
        syntax: ";;",
        emoji: "1472436401680158741"
    },
    "superstar-racers": {
        name: "Superstar Racers",
        baseUrl: "https://superstarracers.wiki",
        apiEndpoint: "https://superstarracers.wiki/w/api.php",
        articlePath: "https://superstarracers.wiki/wiki/",
        syntax: "&&",
        emoji: "1472436382998728714"
    },
    "a-blocks-journey": {
        name: "A Block's Journey",
        baseUrl: "https://ablocksjourney.wiki",
        apiEndpoint: "https://ablocksjourney.wiki/w/api.php",
        articlePath: "https://ablocksjourney.wiki/wiki/",
        syntax: "!!",
        emoji: "1472436415760568460"
    }
};

const CATEGORY_WIKI_MAP = {
    "1286781988669231166": "super-blox-64",
    "1389381096436793484": "superstar-racers",
    "1454904248943771748": "a-blocks-journey"
};

// --- DISCORD STATUSES ---
const STATUS_OPTIONS = [
    { type: 4, text: "just send [[a page]] or {{a page}}!" },
    { type: 4, text: "now supporting 3 wikis!" },
    { type: 4, text: "use ;;page;; for Super Blox 64" },
    { type: 4, text: "use &&page&& for Superstar Racers" },
    { type: 4, text: "use !!page!! for A Block's Journey" },
];

module.exports = {
    BOT_NAME,
    WIKIS,
    CATEGORY_WIKI_MAP,
    STATUS_OPTIONS
};
