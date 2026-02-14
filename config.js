// --- WIKI CONFIGURATION ---
// Change this URL to switch wikis. 
// Ensure no trailing slash.
const WIKI_BASE_URL = "https://tagging.wiki"; 

const BOT_NAME = "Orbital"; 

const WIKI_ENDPOINTS = {
    BASE: WIKI_BASE_URL,
    API: `${WIKI_BASE_URL}/w/api.php`,
    // The path used for user-facing links (e.g. [Link](https://wiki...))
    ARTICLE_PATH: `${WIKI_BASE_URL}/wiki/` 
};

// --- DISCORD STATUSES ---
// Note: ActivityType is imported in initialise.js, so we keep these simple here
// and map them there, OR we just use raw numbers:
// 0=Playing, 2=Listening, 3=Watching, 5=Competing, 4=Custom
const STATUS_OPTIONS = [
    { type: 4, text: "just send [[a page]] and i'll appear!" },
    { type: 4, text: "just send {{a page}} and i'll appear!" },
    { type: 4, text: "dms are open!" },
    { type: 4, text: `check out ${WIKI_BASE_URL.replace('https://', '')}!` },
    { type: 0, text: `${GAME_TOPIC}` },
    { type: 2, text: "crashout by nicopatty" },
    { type: 3, text: `Special:RecentChanges - ${WIKI_BASE_URL.replace('https://', '')}` },
    { type: 5, text: `${GAME_TOPIC}` },
];

module.exports = {
    BOT_NAME,
    WIKI_ENDPOINTS,
    STATUS_OPTIONS
};
