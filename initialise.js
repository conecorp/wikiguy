require("dotenv").config();

const { 
    findCanonicalTitle, 
    getWikiContent, 
    getSectionContent, 
    getLeadSection, 
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

// -------------------- UTILITIES --------------------
const DISCORD_MAX_LENGTH = 2000;

function splitMessage(text, maxLength = DISCORD_MAX_LENGTH) {
    const messages = [];
    let currentText = text;

    while (currentText.length > 0) {
        if (currentText.length <= maxLength) {
            messages.push(currentText);
            break;
        }

        const searchLength = maxLength - 10;
        let splitIndex = currentText.lastIndexOf('\n', searchLength);
        if (splitIndex === -1) splitIndex = currentText.lastIndexOf(' ', searchLength);
        if (splitIndex === -1) splitIndex = searchLength;

        let segment = currentText.slice(0, splitIndex).trim();
        let remaining = currentText.slice(splitIndex).trim();

        const backtickMatches = segment.match(/```/g);
        const isInsideCodeBlock = backtickMatches && (backtickMatches.length % 2 !== 0);

        if (isInsideCodeBlock) {
            segment += "\n```";
            remaining = "```\n" + remaining;
        }

        messages.push(segment);
        currentText = remaining;
    }

    return messages;
}

// --- NEW: UNIFIED COMPONENT BUILDER ---
function buildPageEmbed(title, content, imageUrl, wikiConfig) {
    const container = new ContainerBuilder();
    const mainSection = new SectionBuilder();

    // 1. Text Content
    mainSection.addTextDisplayComponents([new TextDisplayBuilder().setContent(content)]);
    
    // 2. Image (Thumbnail)
    const fallbackImage = "https://upload.wikimedia.org/wikipedia/commons/8/89/HD_transparent_picture.png"; 
    const finalImageUrl = (typeof imageUrl === "string" && imageUrl.trim() !== "") ? imageUrl : fallbackImage;
    
    try {
        mainSection.setThumbnailAccessory(thumbnail => thumbnail.setURL(finalImageUrl));
    } catch (err) { }      

    if (mainSection.components && mainSection.components.length > 0) {
        mainSection.components = mainSection.components.filter(c => c !== undefined);
        if (mainSection.components.length > 0) {
            container.addSectionComponents(mainSection);
        }
    }
    
    // 3. Action Row (Link Button)
    if (title) {
        try {
            const [pageOnly, frag] = String(title).split("#");
            const parts = pageOnly.split(':').map(s => encodeURIComponent(s.replace(/ /g, "_")));
            const pageUrl = `${wikiConfig.articlePath}${parts.join(':')}${frag ? '#'+encodeURIComponent(frag.replace(/ /g,'_')) : ''}`;
            
            const row = new ActionRowBuilder();
            const btn = new ButtonBuilder()
                .setLabel(String(title).slice(0, 80))
                .setStyle(ButtonStyle.Link)
                .setURL(pageUrl);
    
            if (btn) row.addComponents(btn);
            if (row.components.length > 0) container.addActionRowComponents(row);
        } catch (err) {}
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
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
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
        console.log("✅ Registered slash commands.");
    } catch (err) {
        console.error("Failed to register commands:", err);
    }
});

// -------------------- HANDLER --------------------
async function handleUserRequest(wikiConfig, rawUserMsg, messageOrInteraction) {
    const isInteraction = interaction => interaction.editReply || interaction.followUp;

    const smartReply = async (payload) => {
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
    if (contextMessage.channel?.sendTyping) {
        messageOrInteraction.channel.sendTyping().catch(() => {});
        typingInterval = setInterval(() => messageOrInteraction.channel.sendTyping().catch(() => {}), 8000);
    }

    try {
        const syntaxRegex = /\{\{([^{}|]+)(?:\|[^{}]*)?\}\}|\[\[([^[\]|]+)(?:\|[^[\]]*)?\]\]|;;([^{}|]+);;|&&([^{}|]+)&&|!!([^{}|]+)!!/;
        const match = rawUserMsg.match(syntaxRegex);

        if (!match) return;

        let rawPageName = (match[1] || match[2] || match[3] || match[4] || match[5]).trim();
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

            if (sectionName) {
                content = await getSectionContent(canonical, sectionName, wikiConfig);
                displayTitle = `${canonical}#${sectionName}`;
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
                    return first?.thumbnail?.source || null;
                } catch (err) {
                    return null;
                }
            };
            const imageUrl = await fetchPageImage(canonical);

            const container = buildPageEmbed(displayTitle, content.slice(0, 1000), imageUrl, wikiConfig);
            
            await smartReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        } else {
            await smartReply({ content: `Page "${rawPageName}" not found on ${wikiConfig.name}.`, ephemeral: true });
        }

    } catch (err) {
        console.error("Error handling request:", err);
    } finally {
        if (typingInterval) clearInterval(typingInterval);
    }
}

// -------------------- EVENTS --------------------
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const rawUserMsg = message.content.trim();
    if (!rawUserMsg) return;

    // Determine which wiki to use
    let wikiConfig = null;

    const syntaxRegex = /\{\{([^{}|]+)(?:\|[^{}]*)?\}\}|\[\[([^[\]|]+)(?:\|[^[\]]*)?\]\]|;;([^{}|]+);;|&&([^{}|]+)&&|!!([^{}|]+)!!/;
    const match = rawUserMsg.match(syntaxRegex);

    if (!match) return;

    // Check for special syntaxes first based on which group matched
    if (match[3]) wikiConfig = WIKIS["super-blox-64"];
    else if (match[4]) wikiConfig = WIKIS["superstar-racers"];
    else if (match[5]) wikiConfig = WIKIS["a-blocks-journey"];
    else if (match[1] || match[2]) {
        // {{}} or [[]] - Use category mapping
        const categoryId = message.channel.parentId;
        const wikiKey = CATEGORY_WIKI_MAP[categoryId];
        if (wikiKey) {
            wikiConfig = WIKIS[wikiKey];
        } else {
            // Fallback to Superstar Racers if not in a listed category
            wikiConfig = WIKIS["superstar-racers"];
        }
    }

    if (wikiConfig) {
        await handleUserRequest(wikiConfig, rawUserMsg, message);
    }
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'contribscores') {
        const wikiKey = interaction.options.getString('wiki');
        const wikiConfig = WIKIS[wikiKey];

        await interaction.deferReply();
        const result = await getContributionScores(wikiConfig);

        if (result.error) {
            await interaction.editReply({ content: result.error });
        } else {
            const parts = splitMessage(result.result);
            for (const [index, part] of parts.entries()) {
                if (index === 0) {
                    await interaction.editReply({ content: part });
                } else {
                    await interaction.followUp({ content: part });
                }
            }
        }
    }
});

client.login(DISCORD_TOKEN);
