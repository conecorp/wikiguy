require("dotenv").config();

const { setRandomStatus } = require("./functions/presence.js");
const { commands } = require("./functions/commands.js");
const { 
    handleInteraction,
    handleUserRequest,
    responseMap,
    botToAuthorMap,
    pruneMap
} = require("./functions/interactions.js");

const {
    Client,
    GatewayIntentBits,
    Partials
} = require("discord.js");

const { WIKIS, CATEGORY_WIKI_MAP, STATUS_INTERVAL_MS } = require("./config.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// -------------------- UTILITIES --------------------
const PREFIX_WIKI_MAP = Object.keys(WIKIS).reduce((acc, key) => {
    const prefix = WIKIS[key].prefix;
    if (prefix) acc[prefix] = key;
    return acc;
}, {});

// joins all prefixes into a string like "a|b|c"
const prefixPattern = Object.values(WIKIS).map(w => w.prefix).join('|');

const syntaxRegex = new RegExp(
    `\\{\\{(?:(${prefixPattern}):)?([^{}|]+)(?:\\|[^{}]*)?\\}\\}|` +
    `\\[\\[(?:(${prefixPattern}):)?([^\\]|]+)(?:\\|[^[\\]]*)?\\]\\]`
);

// -------------------- CLIENT SETUP --------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    setRandomStatus(client);
    setInterval(() => { setRandomStatus(client); }, STATUS_INTERVAL_MS);

    try {
        console.log("Registering slash commands...");
        await client.application.commands.set(commands);
        console.log("✅ Registered slash commands.");
    } catch (err) {
        console.error("Failed to register commands:", err);
    }
});

// -------------------- EVENTS --------------------
function getWikiAndPage(messageContent, channelParentId) {
    const match = messageContent.match(syntaxRegex);
    if (!match) return null;

    const prefix = match[1] || match[3];
    const rawPageName = (match[2] || match[4]).trim();

    let wikiConfig = null;
    if (prefix) {
        wikiConfig = WIKIS[PREFIX_WIKI_MAP[prefix]];
    } else {
        const wikiKey = CATEGORY_WIKI_MAP[channelParentId] || "superstar-racers";
        wikiConfig = WIKIS[wikiKey];
    }

    return { wikiConfig, rawPageName };
}

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const res = getWikiAndPage(message.content, message.channel.parentId);
    if (!res) return;

    const { wikiConfig, rawPageName } = res;
    if (wikiConfig) {
        const response = await handleUserRequest(wikiConfig, rawPageName, message);
        if (response && response.id) {
            responseMap.set(message.id, response.id);
            botToAuthorMap.set(response.id, message.author.id);
            pruneMap(responseMap);
            pruneMap(botToAuthorMap);
        }
    }
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
    if (newMessage.partial) {
        try {
            await newMessage.fetch();
        } catch (err) {
            console.warn("Failed to fetch updated message:", err.message);
            return;
        }
    }

    if (oldMessage.partial) {
        try {
            await oldMessage.fetch();
        } catch (err) {
            console.warn("Failed to fetch old message content for update comparison:", err.message);
        }
    }

    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    if (!responseMap.has(newMessage.id)) return;

    const res = getWikiAndPage(newMessage.content, newMessage.channel.parentId);
    if (!res) return;

    const { wikiConfig, rawPageName } = res;
    const botMessageId = responseMap.get(newMessage.id);

    try {
        const botMessage = await newMessage.channel.messages.fetch(botMessageId);
        if (botMessage) {
            const response = await handleUserRequest(wikiConfig, rawPageName, newMessage, botMessage);
            if (response && response.id) {
                botToAuthorMap.set(response.id, newMessage.author.id);
                pruneMap(botToAuthorMap);
            }
        }
    } catch (err) {
        console.warn("Failed to fetch bot message for update:", err.message);
    }
});

client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the reaction:', error);
            return;
        }
    }

    const emoji = reaction.emoji.name;
    if (emoji === "🗑️" || emoji === "wastebucket") {
        const message = reaction.message;
        if (message.author.id !== client.user.id) return;

        let originalAuthorId = botToAuthorMap.get(message.id);


        if (!originalAuthorId && message.reference) {
            try {
                const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
                originalAuthorId = referencedMsg.author.id;
                // Cache it for next time
                botToAuthorMap.set(message.id, originalAuthorId);
            } catch (err) {
                console.warn(`Failed to fetch referenced message ${message.reference.messageId} for bot message ${message.id}:`, err);
            }
        }

        if (user.id === originalAuthorId) {
            try {
                await message.delete();
            } catch (err) {
                console.warn("Failed to delete message on reaction:", err.message);
            }
        }
    }
});

client.on("interactionCreate", handleInteraction);

client.login(DISCORD_TOKEN);
