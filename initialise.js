require("dotenv").config();

const { 
    findCanonicalTitle, 
    getWikiContent, 
    getSectionContent, 
    getLeadSection, 
    getFullSizeImageUrl
} = require("./functions/parse_page.js");

const { getContributionScores } = require("./functions/contribscores.js");
const { handleFileRequest } = require("./functions/parse_file.js");

const {
    Client,
    GatewayIntentBits,
    Partials,
    MessageFlags,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ActivityType,
    ChannelType,
    InteractionType,
    ApplicationCommandType
} = require("discord.js");

const { BOT_NAME, WIKIS, CATEGORY_WIKI_MAP, toggleContribScore, STATUS_OPTIONS } = require("./config.js");

// node-fetch wrapper 
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

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
    `\\[\\[(?:(${prefixPattern}):)?([^[\\s\\]|]+)(?:\\|[^[\\]]*)?\\]\\]`
);

const responseMap = new Map();
const botToAuthorMap = new Map();

function pruneMap(map, maxSize = 1000) {
    while (map.size > maxSize) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
    }
}

const wikiChoices = Object.entries(WIKIS).map(([key, wiki]) => ({
    name: wiki.name,
    value: key
}));

async function fetchWikiChoices(wikiConfig, params, listKey, isFileSearch) {
    try {
        // Use a 3-second timeout to prevent autocomplete from hanging on slow wiki APIs
        const res = await fetch(`${wikiConfig.apiEndpoint}?${params.toString()}`, {
            headers: { "User-Agent": "DiscordBot/Orbital" },
            signal: AbortSignal.timeout(3000)
        });
        if (!res.ok) {
            console.warn(`Wiki API returned ${res.status} for ${listKey} (${wikiConfig.apiEndpoint})`);
            return [];
        }

        const json = await res.json();
        const items = json.query?.[listKey] || [];
        const results = [];

        for (const item of items) {
            let title = item.title ?? item.name;
            let value = title;

            if (isFileSearch && title.toLowerCase().startsWith('file:')) {
                title = title.slice(5);
                value = value.slice(5);
            }

            if (title.length > 100) continue;
            results.push({ name: title, value: value });
        }
        return results;
    } catch (err) {
        console.error(`Fetch error for ${listKey}:`, err);
        return [];
    }
}

async function getAutocompleteChoices(wikiConfig, listType, prefix) {
    const isFileSearch = listType === 'allimages';
    const namespace = isFileSearch ? '6' : '0';
    let searchPrefix = prefix.trim();

    if (isFileSearch && searchPrefix.toLowerCase().startsWith('file:')) {
        searchPrefix = searchPrefix.slice(5).trim();
    }

    if (searchPrefix === '') {
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            list: listType,
            [isFileSearch ? 'aiprefix' : 'apprefix']: '',
            [isFileSearch ? 'ailimit' : 'aplimit']: '25'
        });
        return await fetchWikiChoices(wikiConfig, params, listType, isFileSearch);
    }

    // 1. Prefix search (best for instant autocomplete, case-insensitive)
    const psParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'prefixsearch',
        pssearch: searchPrefix,
        psnamespace: namespace,
        pslimit: '25'
    });

    // 2. Similar search using list=search (with intitle: for miser mode)
    // We wrap searchPrefix in quotes to treat it as a literal phrase and avoid query manipulation.
    const srParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: `intitle:"${searchPrefix.replace(/"/g, '')}"`,
        srnamespace: namespace,
        srlimit: '25'
    });

    const [psResults, srResults] = await Promise.all([
        fetchWikiChoices(wikiConfig, psParams, 'prefixsearch', isFileSearch),
        fetchWikiChoices(wikiConfig, srParams, 'search', isFileSearch)
    ]);

    const seen = new Set();
    const finalChoices = [];

    // Prioritize prefix search results
    for (const choice of [...psResults, ...srResults]) {
        const key = choice.value.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            finalChoices.push(choice);
            if (finalChoices.length >= 25) break;
        }
    }

    return finalChoices;
}

// --- NEW: UNIFIED COMPONENT BUILDER ---
function buildPageEmbed(title, content, imageUrl, wikiConfig, gallery = null) {
    const container = new ContainerBuilder();
    
    const hasContent = content && content !== "No content available.";
    const hasGallery = gallery && gallery.length > 0;

    // Suppression logic: if content is ONLY the "## Gallery" header and we have a media gallery, don't show the text section.
    const isOnlyGalleryHeader = hasContent && content.trim() === "## Gallery";
    const shouldShowTextSection = hasContent && !(isOnlyGalleryHeader && hasGallery);

    const showEmbed = shouldShowTextSection || hasGallery;

    if (showEmbed) {
        const mainSection = new SectionBuilder();

        // 1. Text Content
        if (shouldShowTextSection) {
            mainSection.addTextDisplayComponents([new TextDisplayBuilder().setContent(content)]);

            // SectionBuilder requires an accessory (Thumbnail or Button) in this version of discord.js.
            // We use the provided imageUrl, or a fallback transparent image.
            const fallbackImage = "https://upload.wikimedia.org/wikipedia/commons/8/89/HD_transparent_picture.png";

            // If hasGallery is true, we use the fallback to avoid duplicate images (thumbnail + gallery)
            const finalImageUrl = (!hasGallery && typeof imageUrl === "string" && imageUrl.trim() !== "") ? imageUrl : fallbackImage;

            try {
                mainSection.setThumbnailAccessory(thumbnail => thumbnail.setURL(finalImageUrl));
            } catch (err) {
                console.warn("Failed to set thumbnail accessory:", err.message);
            }

            container.addSectionComponents(mainSection);
        }

        // 2. Media Gallery (top-level container component)
        if (hasGallery) {
            const mediaGallery = new MediaGalleryBuilder();
            gallery.slice(0, 10).forEach(item => {
                const galleryItem = new MediaGalleryItemBuilder().setURL(item.url);
                if (item.caption) {
                    galleryItem.setDescription(item.caption.slice(0, 1000));
                }
                mediaGallery.addItems(galleryItem);
            });
            container.addMediaGalleryComponents(mediaGallery);
        }
    }
    
    // 3. Action Row (Link Button)
    if (title) {
        try {
            let pageUrl;
            if (title === "Special:ContributionScores") {
                pageUrl = `${wikiConfig.articlePath}Special:ContributionScores`;
            } else {
                const isSectionLink = String(title).includes(" § ");
                const titleStr = String(title);
                let pageOnly, frag;
                if (isSectionLink) {
                    const idx = titleStr.indexOf(" § ");
                    pageOnly = idx !== -1 ? titleStr.slice(0, idx) : titleStr;
                    frag = idx !== -1 ? titleStr.slice(idx + 3) : undefined;
                } else {
                    const idx = titleStr.indexOf("#");
                    pageOnly = idx !== -1 ? titleStr.slice(0, idx) : titleStr;
                    frag = idx !== -1 ? titleStr.slice(idx + 1) : undefined;
                }
                const parts = pageOnly.split(':').map(s => encodeURIComponent(s.replace(/ /g, "_")));
                const anchor = frag ? '#' + encodeURIComponent(frag.replace(/ /g, '_')) : '';
                pageUrl = `${wikiConfig.articlePath}${parts.join(':')}${anchor}`;
            }
            
            const row = new ActionRowBuilder();
            const btn = new ButtonBuilder()
                .setLabel(String(title).slice(0, 80))
                .setStyle(ButtonStyle.Link)
                .setURL(pageUrl);

            if (wikiConfig.emoji) {
                btn.setEmoji(wikiConfig.emoji);
            }
    
            if (btn) row.addComponents(btn);
            if (row.components.length > 0) container.addActionRowComponents(row);
        } catch (err) {
            console.warn("Failed to build link button:", err.message);
        }
    }

    return container;
}

// -------------------- STATUS --------------------
const STATUS_INTERVAL_MS = 5 * 60 * 1000;

function setRandomStatus(client) {
    if (!client || !client.user) return;
    const newStatus = STATUS_OPTIONS[Math.floor(Math.random() * STATUS_OPTIONS.length)];
    if (!newStatus || !newStatus.text || typeof newStatus.type !== "number") return;

    try {
        client.user.setPresence({
            activities: [{ name: newStatus.text, type: newStatus.type }],
            status: 'online',
        });
    } catch (err) {
        console.error("Failed to set Discord status:", err);
    }
}

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
        await client.application.commands.set([
            {
                name: 'contribscores',
                description: 'Get contribution scores for a wiki',
                options: [
                    {
                        name: 'wiki',
                        description: 'The wiki to get scores from',
                        type: 3, // STRING
                        required: true,
                        choices: wikiChoices
                    }
                ]
            },
            {
                name: 'wiki',
                description: 'Wiki commands',
                options: [
                    {
                        name: 'page',
                        description: 'Search for a wiki page',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'wiki',
                                description: 'The wiki to search in',
                                type: 3, // STRING
                                required: true,
                                choices: wikiChoices
                            },
                            {
                                name: 'page',
                                description: 'The page name',
                                type: 3, // STRING
                                required: true,
                                autocomplete: true
                            }
                        ]
                    },
                    {
                        name: 'file',
                        description: 'Search for a wiki file',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'wiki',
                                description: 'The wiki to search in',
                                type: 3, // STRING
                                required: true,
                                choices: wikiChoices
                            },
                            {
                                name: 'file',
                                description: 'The file name',
                                type: 3, // STRING
                                required: true,
                                autocomplete: true
                            }
                        ]
                    }
                ]
            }
        ]);
        console.log("✅ Registered slash commands.");
    } catch (err) {
        console.error("Failed to register commands:", err);
    }
});

// -------------------- HANDLER --------------------
async function handleUserRequest(wikiConfig, rawPageName, messageOrInteraction, botMessageToEdit = null) {
    const isInteraction = (interaction) => interaction && (interaction.editReply || interaction.followUp);

    const smartReply = async (payload) => {
        if (botMessageToEdit) {
            try {
                return await botMessageToEdit.edit(payload);
            } catch (err) {
                console.warn("Failed to edit message, sending new one instead:", err.message);
                // Fallback to sending new if edit fails (e.g. message deleted)
            }
        }
        if (isInteraction(messageOrInteraction)) {
            if (messageOrInteraction.replied) {
                return messageOrInteraction.followUp(payload);
            }
            if (messageOrInteraction.deferred) {
                if (payload.ephemeral) {
                    return messageOrInteraction.followUp(payload);
                }
                return messageOrInteraction.editReply(payload);
            }
            return messageOrInteraction.reply(payload);
        } else if (typeof messageOrInteraction.reply === 'function') {
            return messageOrInteraction.reply(payload);
        } else if (messageOrInteraction.channel && typeof messageOrInteraction.channel.send === 'function') {
            return messageOrInteraction.channel.send(payload);
        }
    };
    
    const contextMessage = messageOrInteraction;
    let typingInterval;
    if (!botMessageToEdit && contextMessage.channel?.sendTyping) {
        messageOrInteraction.channel.sendTyping().catch(() => {});
        typingInterval = setInterval(() => messageOrInteraction.channel.sendTyping().catch(() => {}), 8000);
    }

    try {
        let sectionName = null;

        if (rawPageName.includes("#")) {
            const [page, section] = rawPageName.split("#");
            rawPageName = page.trim();
            sectionName = section.trim();
        }

        const canonical = await findCanonicalTitle(rawPageName, wikiConfig);
        
        if (canonical) {
            let content = null;
            let displayTitle = canonical;
            let gallery = null;

            if (sectionName) {
                const sectionData = await getSectionContent(canonical, sectionName, wikiConfig);
                if (sectionData) {
                    content = sectionData.content;
                    displayTitle = `${canonical} § ${sectionData.displayTitle}`;
                    gallery = sectionData.gallery;
                } else {
                    content = "No content available.";
                    displayTitle = `${canonical}#${sectionName}`;
                }
            } else {
                content = await getLeadSection(canonical, wikiConfig);
            }

            if (!content) {
                content = "No content available.";
            }

            // Fetch Image
            const fetchPageImage = async (title) => {
                try {
                    const imageRes = await fetch(`${wikiConfig.apiEndpoint}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=512&format=json`);
                    const imageJson = await imageRes.json();
                    const pages = imageJson.query?.pages;
                    const first = pages ? Object.values(pages)[0] : null;
                    const src = first?.thumbnail?.source || null;
                    return getFullSizeImageUrl(src);
                } catch (err) {
                    return null;
                }
            };
            const imageUrl = await fetchPageImage(canonical);

            const container = buildPageEmbed(displayTitle, content.slice(0, 1000), imageUrl, wikiConfig, gallery);
            
            return await smartReply({
                content: "",
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        } else {
            return await smartReply({ content: `Page "${rawPageName}" not found on [${wikiConfig.name} Wiki](<${wikiConfig.baseUrl}>).`, components: [], ephemeral: true, allowedMentions: { parse: [] }});
        }

    } catch (err) {
        console.error("Error handling request:", err);
    } finally {
        if (typingInterval) clearInterval(typingInterval);
    }
}

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
    if (newMessage.author.bot) return;
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

        if (!originalAuthorId) {
            // fallback to responseMap for older messages or if map missed it
            for (const [userMsgId, botMsgId] of responseMap.entries()) {
                if (botMsgId === message.id) {
                    try {
                        const userMsg = await message.channel.messages.fetch(userMsgId);
                        originalAuthorId = userMsg.author.id;
                        // Cache it for next time
                        botToAuthorMap.set(botMsgId, originalAuthorId);
                    } catch (err) {
                        console.warn(`Failed to fetch original user message ${userMsgId} for bot message ${botMsgId}:`, err);
                    }
                    break;
                }
            }
        }

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

client.on("interactionCreate", async (interaction) => {
    // --- Autocomplete ---
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'wiki') {
            const focusedOption = interaction.options.getFocused(true);
            const wikiKey = interaction.options.getString('wiki');
            const wikiConfig = WIKIS[wikiKey];

            if (!wikiConfig) {
                return interaction.respond([]).catch(() => {});
            }

            const listType = focusedOption.name === 'page' ? 'allpages' : (focusedOption.name === 'file' ? 'allimages' : null);
            if (!listType) return interaction.respond([]).catch(() => {});

            const choices = await getAutocompleteChoices(wikiConfig, listType, focusedOption.value);
            return interaction.respond(choices).catch(err => console.error(`Failed to respond to ${focusedOption.name} autocomplete:`, err));
        }
        return;
    }

    // --- Command Execution ---
    if (interaction.commandName === 'contribscores') {
        if (!toggleContribScore) {
            await interaction.reply({ content: 'Contribution scores are currently disabled.', ephemeral: true });
            return;
        }
        const wikiKey = interaction.options.getString('wiki');
        const wikiConfig = WIKIS[wikiKey];

        if (!wikiConfig) {
           await interaction.reply({ content: 'Unknown wiki selection.', ephemeral: true });
           return;
        }
        
        await interaction.deferReply();
        const result = await getContributionScores(wikiConfig);

        if (result.error) {
            await interaction.editReply({ content: result.error });
        } else {
            const container = buildPageEmbed(result.title, result.result, null, wikiConfig);
            const response = await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
            if (response && response.id) {
                botToAuthorMap.set(response.id, interaction.user.id);
                pruneMap(botToAuthorMap);
            }
        }
    } else if (interaction.commandName === 'wiki') {
        const subcommand = interaction.options.getSubcommand();
        const wikiKey = interaction.options.getString('wiki');
        const wikiConfig = WIKIS[wikiKey];

        if (!wikiConfig) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Unknown wiki selection.', ephemeral: true }).catch(() => {});
            }
            return;
        }

        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

            let response;
            if (subcommand === 'page') {
                response = await handleUserRequest(wikiConfig, interaction.options.getString('page'), interaction);
            } else if (subcommand === 'file') {
                // Ensure handleFileRequest is awaited and errors are caught
                response = await handleFileRequest(wikiConfig, interaction.options.getString('file'), interaction);
            }

            // FIX: Ensure we track the author even if response returned is slightly malformed
            // or provide a fallback if the request failed to produce a Message object.
            if (response && response.id) {
                botToAuthorMap.set(response.id, interaction.user.id);
                pruneMap(botToAuthorMap);
            } else {
                console.warn(`[Interaction Error] ${subcommand} request by ${interaction.user.tag} (${interaction.user.id}) did not return a valid Message object for mapping.`);
                
                // If it finished but returned nothing (double-failure), send a final fallback if possible
                if (!interaction.replied && interaction.deferred) {
                    await interaction.editReply({ content: "The request could not be completed, and no message was returned for tracking." });
                }
            }
        } catch (err) {
            console.error(`Error executing wiki ${subcommand} command:`, err);
            const errorMsg = { content: "An error occurred while executing the command.", ephemeral: true };
            if (interaction.replied) {
                await interaction.followUp(errorMsg).catch(() => {});
            } else if (interaction.deferred) {
                await interaction.editReply({ content: errorMsg.content }).catch(() => {});
            } else {
                await interaction.reply(errorMsg).catch(() => {});
            }
        }
    }
});

client.login(DISCORD_TOKEN);
