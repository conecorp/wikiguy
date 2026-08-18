// Copy this file to config.js and replace the example values.
// --- WIKI CONFIGURATION ---
const BOT_NAME = "Wiki Guy";

const WIKIS = {
    "example-wiki": {
        name: "Example Wiki",
        baseUrl: "https://example.com",
        apiEndpoint: "https://example.com/w/api.php",
        articlePath: "https://example.com/",
        prefix: "example",
        emoji: "DISCORD_EMOJI_ID"
    }
};

// Map a channel or category ID to a wiki.
const WIKI_MAP = {
    "DISCORD_CHANNEL_OR_CATEGORY_ID": "example-wiki"
};

const DEFAULT_WIKI = "example-wiki";

// Enable or disable slash commands. Disabled commands are not registered with Discord.
const COMMANDS = {
    speedrun: true,
    contribs: true,
    wiki: true,
    parse: true,
    user: true,
    random: true,
};
const SPEEDRUN_EMOJI = "DISCORD_EMOJI_ID";
const CONTRIBSCORES_SCORE_EMOJI = "DISCORD_EMOJI_ID";
const STATUS_INTERVAL_MS = 5 * 60 * 1000;

// --- DISCORD STATUSES ---
const STATUS_OPTIONS = [
    { type: 4, text: "your wiki" },
];

module.exports = {
    BOT_NAME,
    WIKIS,
    WIKI_MAP,
    DEFAULT_WIKI,
    COMMANDS,
    SPEEDRUN_EMOJI,
    CONTRIBSCORES_SCORE_EMOJI,
    STATUS_INTERVAL_MS,
    STATUS_OPTIONS
};
