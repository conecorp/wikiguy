const {
    findCanonicalTitle,
    getPageData,
    getSectionContent,
} = require("./parse_page.js");
const { handleFileRequest } = require("./parse_file.js");
const { handleContribScoresRequest } = require("./contribscores.js");
const {
    WIKIS,
    toggleContribScore,
    CATEGORY_WIKI_MAP
} = require("../config.js");
const { fetch } = require("./utils.js");

const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags
} = require("discord.js");


const responseMap = new Map();
const botToAuthorMap = new Map();

function pruneMap(map, maxSize = 1000) {
    while (map.size > maxSize) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
    }
}

async function fetchWikiChoices(wikiConfig, params, listKey, isFileSearch) {
    try {
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

    const psParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'prefixsearch',
        pssearch: searchPrefix,
        psnamespace: namespace,
        pslimit: '25'
    });

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

function buildPageEmbed(title, content, imageUrl, wikiConfig, gallery = null) {
    const container = new ContainerBuilder();

    const hasContent = content && content !== "No content available.";
    const hasGallery = gallery && gallery.length > 0;

    const isOnlyGalleryHeader = hasContent && content.trim() === "## Gallery";
    const shouldShowTextSection = hasContent && !(isOnlyGalleryHeader && hasGallery);

    const showEmbed = shouldShowTextSection || hasGallery;

    if (showEmbed) {
        const mainSection = new SectionBuilder();

        if (shouldShowTextSection) {
            mainSection.addTextDisplayComponents([new TextDisplayBuilder().setContent(content)]);
            const fallbackImage = "https://upload.wikimedia.org/wikipedia/commons/8/89/HD_transparent_picture.png";
            const finalImageUrl = (!hasGallery && typeof imageUrl === "string" && imageUrl.trim() !== "") ? imageUrl : fallbackImage;

            try {
                mainSection.setThumbnailAccessory(thumbnail => thumbnail.setURL(finalImageUrl));
            } catch (err) {
                console.warn("Failed to set thumbnail accessory:", err.message);
            }

            container.addSectionComponents(mainSection);
        }

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

    if (title) {
        try {
            let pageUrl;
            if (title === "Special:ContributionScores") {
                pageUrl = `${wikiConfig.articlePath}Special:ContributionScores?utm_source=orbital`;
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
                pageUrl = `${wikiConfig.articlePath}${parts.join(':')}?utm_source=orbital${anchor}`;
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

async function handleUserRequest(wikiConfig, rawPageName, messageOrInteraction, botMessageToEdit = null) {
    if (rawPageName.toLowerCase().startsWith("file:")) {
        return await handleFileRequest(wikiConfig, rawPageName.slice(5).trim(), messageOrInteraction);
    }

    const isInteraction = (interaction) => interaction && (interaction.editReply || interaction.followUp);

    const smartReply = async (payload) => {
        if (botMessageToEdit) {
            try {
                return await botMessageToEdit.edit(payload);
            } catch (err) {
                console.warn("Failed to edit message, sending new one instead:", err.message);
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
    let typingTimeout;
    if (!botMessageToEdit && contextMessage.channel?.sendTyping) {
        messageOrInteraction.channel.sendTyping().catch(() => {});
        typingInterval = setInterval(() => messageOrInteraction.channel.sendTyping().catch(() => {}), 8000);
        typingTimeout = setTimeout(() => {
            if (typingInterval) {
                clearInterval(typingInterval);
                typingInterval = null;
            }
        }, 30000);
    }

    try {
        let sectionName = null;

        if (rawPageName.includes("#")) {
            const [page, section] = rawPageName.split("#");
            rawPageName = page.trim();
            sectionName = section.trim();
        }

        let content = null;
        let displayTitle = null;
        let gallery = null;
        let imageUrl = null;
        let canonical = null;

        if (sectionName) {
            canonical = await findCanonicalTitle(rawPageName, wikiConfig);
            if (canonical) {
                const sectionData = await getSectionContent(canonical, sectionName, wikiConfig);
                if (sectionData) {
                    content = sectionData.content;
                    displayTitle = `${canonical} § ${sectionData.displayTitle}`;
                    gallery = sectionData.gallery;
                } else {
                    content = "No content available.";
                    displayTitle = `${canonical}#${sectionName}`;
                }

                const pageData = await getPageData(canonical, wikiConfig);
                imageUrl = pageData?.imageUrl;
            }
        } else {
            const pageData = await getPageData(rawPageName, wikiConfig);
            if (pageData) {
                canonical = pageData.canonical;
                content = pageData.extract;
                imageUrl = pageData.imageUrl;
                displayTitle = canonical;
            }
        }

        if (canonical) {
            if (!content) {
                content = "No content available.";
            }

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
        const errorMsg = { content: "An error occurred while processing your request.", ephemeral: true };
        if (isInteraction(messageOrInteraction)) {
            if (messageOrInteraction.replied) {
                await messageOrInteraction.followUp(errorMsg).catch(() => {});
            } else if (messageOrInteraction.deferred) {
                await messageOrInteraction.editReply(errorMsg).catch(() => {});
            } else {
                await messageOrInteraction.reply(errorMsg).catch(() => {});
            }
        } else {
            await messageOrInteraction.reply(errorMsg).catch(() => {});
        }
    } finally {
        if (typingInterval) clearInterval(typingInterval);
        if (typingTimeout) clearTimeout(typingTimeout);
    }
}

async function handleInteraction(interaction) {
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'parse' || interaction.commandName === 'wiki') {
            const focusedOption = interaction.options.getFocused(true);
            const wikiKey = interaction.options.getString('wiki');
            const wikiConfig = WIKIS[wikiKey];

            if (!wikiConfig) {
                return interaction.respond([]).catch(() => {});
            }

            const listType = (focusedOption.name === 'page') ? 'allpages' : (focusedOption.name === 'file' ? 'allimages' : null);
            if (!listType) return interaction.respond([]).catch(() => {});

            const choices = await getAutocompleteChoices(wikiConfig, listType, focusedOption.value);
            return interaction.respond(choices).catch(err => console.error(`Failed to respond to ${focusedOption.name} autocomplete:`, err));
        }
        return;
    }

    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'contribscores') {
        await handleContribScoresRequest(interaction, { toggleContribScore, WIKIS, buildPageEmbed, botToAuthorMap, pruneMap, MessageFlags });
    } else if (interaction.commandName === 'wiki') {
        const wikiKey = interaction.options.getString('wiki');
        const wikiConfig = WIKIS[wikiKey];

        if (!wikiConfig) {
            await interaction.reply({ content: 'Unknown wiki selection.', ephemeral: true }).catch(() => {});
            return;
        }

        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

            // Just the wiki link, per user request
            const response = await interaction.editReply({
                content: wikiConfig.baseUrl
            });

            if (response && response.id) {
                botToAuthorMap.set(response.id, interaction.user.id);
                pruneMap(botToAuthorMap);
            }
        } catch (err) {
            console.error(`Error executing wiki command:`, err);
            const errorMsg = { content: "An error occurred while executing the command.", ephemeral: true };
            if (interaction.replied) {
                await interaction.followUp(errorMsg).catch(() => {});
            } else if (interaction.deferred) {
                await interaction.editReply({ content: errorMsg.content }).catch(() => {});
            } else {
                await interaction.reply(errorMsg).catch(() => {});
            }
        }
    } else if (interaction.commandName === 'parse') {
        const subCommand = interaction.options.getSubcommand();
        const wikiKey = interaction.options.getString('wiki');
        const wikiConfig = WIKIS[wikiKey];

        if (!wikiConfig) {
            await interaction.reply({ content: 'Unknown wiki selection.', ephemeral: true }).catch(() => {});
            return;
        }

        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

            let response;
            if (subCommand === 'page') {
                const pageName = interaction.options.getString('page');
                response = await handleUserRequest(wikiConfig, pageName, interaction);
            } else if (subCommand === 'file') {
                const fileName = interaction.options.getString('file');
                response = await handleFileRequest(wikiConfig, fileName, interaction);
            }

            if (response && response.id) {
                botToAuthorMap.set(response.id, interaction.user.id);
                pruneMap(botToAuthorMap);
            }
        } catch (err) {
            console.error(`Error executing parse command:`, err);
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
}

module.exports = {
    handleInteraction,
    handleUserRequest,
    buildPageEmbed,
    responseMap,
    botToAuthorMap,
    pruneMap
};
