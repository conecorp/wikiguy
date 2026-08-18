require("dotenv").config();

const { setRandomStatus } = require("./bot/presence.js");
const { commands } = require("./bot/commands.js");
const { 
    handleInteraction,
    handleUserRequest,
    responseMap,
    botToAuthorMap,
    pruneMap
} = require("./bot/interactions.js");

const {
    Client,
    GatewayIntentBits,
    Partials
} = require("discord.js");

const {
    WIKIS,
    WIKI_MAP,
    DEFAULT_WIKI,
    STATUS_INTERVAL_MS
} = require("./config.js");

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
    `\\[\\[(?:(${prefixPattern}):)?([^\\]|]+)(?:\\|[^[\\]]*)?\\]\\]`,
    "i"
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

// Events
function isUnknownMessageError(error) {
    return error?.code === 10008 || error?.rawError?.code === 10008;
}

function getWikiAndPage(messageContent, channel) {
    if (typeof messageContent !== "string") return null;

    const match = messageContent.match(syntaxRegex);
    if (!match) return null;

    const prefix = match[1] || match[3];
    let rawPageName = (match[2] || match[4]).trim();

    let wikiConfig = null;
    if (prefix) {
        // Explicit prefixes override the wiki configured for this channel.
        wikiConfig = WIKIS[PREFIX_WIKI_MAP[prefix.toLowerCase()]];
    } else {
        // The same config map supports both channel-specific and category-wide
        // defaults. Put the channel first so a channel override wins over its
        // parent category.
        const channelAndCategoryIds = [
            channel?.id,
            channel?.parentId,
            channel?.parent?.id,
            channel?.parent?.parentId,
            channel?.parent?.parent?.id
        ].filter(Boolean).map(String);
        // Keep message handling alive if an older/misconfigured deployment has
        // no WIKI_MAP export yet. The default wiki still handles the message.
        const wikiMap = WIKI_MAP || {};
        const configuredId = channelAndCategoryIds.find(id => wikiMap[id]);
        const wikiKey = wikiMap[configuredId] || DEFAULT_WIKI;
        wikiConfig = WIKIS[wikiKey];
    }

    const rawLower = rawPageName.toLowerCase();
    if (rawLower.startsWith("mw:")) {
        rawPageName = "MediaWiki:" + rawPageName.slice(3).trim();
    } else if (rawLower.startsWith("t:")) {
        rawPageName = "Template:" + rawPageName.slice(2).trim();
    }

    return { wikiConfig, rawPageName };
}

client.on("messageCreate", async (message) => {
    try {
        if (message.author?.bot) return;

        const res = getWikiAndPage(message.content, message.channel);
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
    } catch (err) {
        // A user can delete the source message while the wiki request is in
        // flight. Discord then rejects the eventual reply with 10008.
        if (!isUnknownMessageError(err)) {
            console.error("Error handling message:", err);
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

    const res = getWikiAndPage(newMessage.content, newMessage.channel);
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
            if (!isUnknownMessageError(error)) {
                console.error("Something went wrong when fetching the reaction:", error);
            }
            return;
        }
    }

    const emoji = reaction.emoji.name?.toLowerCase();
    if (emoji === "🗑️" || emoji === "wastebucket") {
        const message = reaction.message;
        // Do not let an incomplete partial payload bypass the bot-message check.
        if (!message.author?.id || message.author.id !== client.user.id) return;

        let originalAuthorId = botToAuthorMap.get(message.id);


        if (!originalAuthorId && message.reference?.messageId) {
            try {
                const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
                originalAuthorId = referencedMsg.author?.id;
                // Cache it for next time
                if (originalAuthorId) {
                    botToAuthorMap.set(message.id, originalAuthorId);
                    pruneMap(botToAuthorMap);
                }
            } catch (err) {
                console.warn(`Failed to fetch referenced message ${message.reference.messageId} for bot message ${message.id}:`, err);
            }
        }

        if (originalAuthorId && user.id === originalAuthorId) {
            try {
                await message.delete();
                botToAuthorMap.delete(message.id);
            } catch (err) {
                console.warn("Failed to delete message on reaction:", err.message);
            }
        }
    }
});

client.on("interactionCreate", handleInteraction);

client.login(DISCORD_TOKEN);
