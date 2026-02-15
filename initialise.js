require("dotenv").config();

const { 
    findCanonicalTitle, 
    getWikiContent, 
    getSectionContent, 
    getLeadSection, 
    getFullSizeImageUrl
} = require("./functions/parse_page.js");

const { getContributionScores } = require("./functions/contribscores.js");

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

const { BOT_NAME, WIKIS, CATEGORY_WIKI_MAP, STATUS_OPTIONS } = require("./config.js");

// node-fetch wrapper 
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

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
                        choices: Object.entries(WIKIS).map(([key, wiki]) => ({
                            name: wiki.name,
                            value: key
                        }))
                    }
                ]
            }
        ]);
        console.log("Registered slash commands.");
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
            if (messageOrInteraction.deferred || messageOrInteraction.replied) {
                return messageOrInteraction.followUp(payload);
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
            return await smartReply({ content: `Page "${rawPageName}" not found on ${wikiConfig.name}.`, components: [], ephemeral: true, allowedMentions: { parse: [] }});
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
            // Limit map size to 1000 entries
            if (responseMap.size > 1000) {
                const firstKey = responseMap.keys().next().value;
                responseMap.delete(firstKey);
            }
        }
    }
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
    // Ensure the message is fully resolved
    if (newMessage.partial) {
        try {
            newMessage = await newMessage.fetch();
        } catch (err) {
            return; // Message was deleted or inaccessible
        }
    }
    
    if (newMessage.author.bot) return;
    if (!responseMap.has(newMessage.id)) return;

    const res = getWikiAndPage(newMessage.content, newMessage.channel.parentId);
    if (!res) return;

    const { wikiConfig, rawPageName } = res;
    const botMessageId = responseMap.get(newMessage.id);

    try {
        const botMessage = await newMessage.channel.messages.fetch(botMessageId);
        if (botMessage) {
            const updatedResponse = await handleUserRequest(wikiConfig, rawPageName, newMessage, botMessage);
            if (updatedResponse && updatedResponse.id !== botMessageId) {
                responseMap.set(newMessage.id, updatedResponse.id);
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
    if (emoji === "🗑️" || emoji === "🗑") {
        let message = reaction.message;
        if (message.partial) {
            try {
                message = await message.fetch();
            } catch (err) {
                return; // Message was deleted or inaccessible
            }
        }
        if (message.author.id !== client.user.id) return;

        let originalAuthorId = null;
        for (const [userMsgId, botMsgId] of responseMap.entries()) {
            if (botMsgId === message.id) {
                try {
                    const userMsg = await message.channel.messages.fetch(userMsgId);
                    originalAuthorId = userMsg.author.id;
                } catch (err) {}
                break;
            }
        }

        if (!originalAuthorId && message.reference) {
            try {
                const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
                originalAuthorId = referencedMsg.author.id;
            } catch (err) {}
        }

        if (user.id === originalAuthorId) {
            try {
                await message.delete();
                // Clean up the responseMap entry
                for (const [userMsgId, botMsgId] of responseMap.entries()) {
                    if (botMsgId === message.id) {
                        responseMap.delete(userMsgId);
                        break;
                    }
                }
            } catch (err) {
                console.warn("Failed to delete message on reaction:", err.message);
            }
        }
    }
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'contribscores') {
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
            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
});

client.login(DISCORD_TOKEN);
