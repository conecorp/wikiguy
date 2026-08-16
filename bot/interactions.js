const {
    findCanonicalTitle,
    getPageData,
    getSectionContent,
    getSectionChoices,
    linkIntroductionPageName,
} = require("../functions/page.js");
const { getRandomPage } = require("../functions/random.js");
const { getUserProfile } = require("../functions/user.js");
const { handleFileRequest } = require("../functions/file.js");
const { handleContribScoresRequest } = require("../functions/contribs.js");
const {
    handleSpeedrunRequest,
    SB64_VARIABLES,
    SB64_DEFAULTS,
    SR_CATEGORY_IDS,
    SR_VARIABLES,
    SR_DEFAULTS
} = require("../functions/speedrun.js");
const {
    WIKIS,
    toggleContribScore,
    BOT_NAME,
    CONTRIBSCORES_SCORE_EMOJI
} = require("../config.js");
const { fetch, truncateToParagraphs: truncateContentToParagraphs } = require("../functions/utils.js");

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

function nextRandomWikiKey() {
    const keys = Object.keys(WIKIS);
    return keys[Math.floor(Math.random() * keys.length)];
}

function pruneMap(map, maxSize = 1000) {
    while (map.size > maxSize) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
    }
}

function sendInteractionError(interaction, error, tag) {
    console.error(`Error handling ${tag} interaction:`, error);
    const errorMsg = { content: 'An error occurred while processing your request.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
        return interaction.followUp(errorMsg).catch(() => {});
    } else {
        return interaction.reply(errorMsg).catch(() => {});
    }
}

async function fetchWikiChoices(wikiConfig, params, listKey, isFileSearch) {
    try {
        const res = await fetch(`${wikiConfig.apiEndpoint}?${params.toString()}`, {
            headers: { "User-Agent": `${BOT_NAME} Discord bot` },
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
            let title = item.title ?? item.name ?? item.userid;
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
    if (listType === 'allusers') {
        const params = new URLSearchParams({ action: 'query', format: 'json', list: 'allusers', auprefix: prefix.trim(), aulimit: '25' });
        return await fetchWikiChoices(wikiConfig, params, 'allusers', false);
    }
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

function buildPageEmbed(title, content, imageUrl, wikiConfig, gallery = null, buttonEmoji = null) {
    const container = new ContainerBuilder();

    const hasContent = content && content !== "No content available.";
    const hasGallery = gallery && gallery.length > 0;
    // This is used by both the media gallery and its overflow button.
    const galleryLimit = hasGallery
        ? (gallery.length >= 9 ? 9 : gallery.length >= 6 ? 6 : gallery.length >= 4 ? 4 : 1)
        : 0;

    const isOnlyGalleryHeader = hasContent && content.trim() === "## Gallery";
    const shouldShowTextSection = hasContent && !(isOnlyGalleryHeader && hasGallery);

    const showEmbed = shouldShowTextSection || hasGallery;

    if (showEmbed) {
        const mainSection = new SectionBuilder();

        if (shouldShowTextSection) {
            const hasImage = !hasGallery && typeof imageUrl === "string" && imageUrl.trim() !== "";
            if (hasImage) {
                mainSection.addTextDisplayComponents([new TextDisplayBuilder().setContent(content)]);
                mainSection.setThumbnailAccessory(thumbnail => thumbnail.setURL(imageUrl));
                container.addSectionComponents(mainSection);
            } else {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
            }
        }

        if (hasGallery) {
            const mediaGallery = new MediaGalleryBuilder();
            gallery.slice(0, galleryLimit).forEach(item => {
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
                pageUrl = `${wikiConfig.articlePath}Special:ContributionScores?utm_source=${encodeURIComponent(BOT_NAME)}`;
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
                pageUrl = `${wikiConfig.articlePath}${parts.join(':')}?utm_source=${encodeURIComponent(BOT_NAME)}${anchor}`;
            }

            const row = new ActionRowBuilder();
            const btn = new ButtonBuilder()
                .setLabel(String(title).slice(0, 80))
                .setStyle(ButtonStyle.Link)
                .setURL(pageUrl);

            if (buttonEmoji || wikiConfig.emoji) {
                btn.setEmoji(buttonEmoji || wikiConfig.emoji);
            }

            if (btn) row.addComponents(btn);
            if (hasGallery && gallery.length > galleryLimit) {
                row.addComponents(new ButtonBuilder()
                    .setLabel(`View ${gallery.length - galleryLimit} more`.slice(0, 80))
                    .setStyle(ButtonStyle.Link)
                    .setURL(pageUrl));
            }
            if (row.components.length > 0) container.addActionRowComponents(row);
        } catch (err) {
            console.warn("Failed to build link button:", err.message);
        }
    }

    return container;
}

function buildUserEmbed(profile, wikiConfig) {
    const container = new ContainerBuilder();
    const groupText = profile.groups.length > 1
        ? `${profile.groups.slice(0, -1).join(", ")} & ${profile.groups.at(-1)}`
        : profile.groups[0] || "";
    const groupLine = groupText ? `-# ${groupText}` : "";
    const content = [
        `## [@${profile.username}](${profile.profileUrl})`,
        groupLine,
        profile.content ? truncateContentToParagraphs(profile.content, 2, 500) : ""
    ].filter(Boolean).join("\n");

    const section = new SectionBuilder();
    section.addTextDisplayComponents([new TextDisplayBuilder().setContent(content)]);
    if (profile.avatarUrl) {
        section.setThumbnailAccessory(thumbnail => thumbnail.setURL(profile.avatarUrl));
    }
    if (profile.avatarUrl) {
        container.addSectionComponents(section);
    } else {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    }

    const row = new ActionRowBuilder();
    const button = new ButtonBuilder()
        .setLabel(`User:${profile.username}`.slice(0, 80))
        .setStyle(ButtonStyle.Link)
        .setURL(`${profile.profileUrl}?utm_source=${encodeURIComponent(BOT_NAME)}`);
    if (wikiConfig.emoji) button.setEmoji(wikiConfig.emoji);
    row.addComponents(button);
    if (Number.isFinite(profile.editCount)) {
        row.addComponents(new ButtonBuilder()
            .setLabel(`${profile.editCount.toLocaleString('en-US')} edits`.slice(0, 80))
            .setStyle(ButtonStyle.Link)
            .setURL(`${profile.contribsUrl}?utm_source=${encodeURIComponent(BOT_NAME)}`));
    }
    container.addActionRowComponents(row);
    return container;
}

async function handleUserRequest(wikiConfig, rawPageName, messageOrInteraction, botMessageToEdit = null, buttonEmoji = null) {
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
        const userMatch = String(rawPageName).match(/^(?:User\s*:\s*|@)(.+)$/i);
        if (userMatch) {
            const username = userMatch[1].trim();
            const profile = await getUserProfile(username, wikiConfig);
            if (!profile) {
                return await smartReply({ content: `User "${username}" not found on [${wikiConfig.name} Wiki](<${wikiConfig.baseUrl}>).`, components: [], ephemeral: true, allowedMentions: { parse: [] } });
            }
            const container = buildUserEmbed(profile, wikiConfig);
            return await smartReply({ content: "", components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
        }

        if (String(rawPageName).trim().toLowerCase() === "special:random") {
            const randomTitle = await getRandomPage(wikiConfig);
            if (!randomTitle) {
                return await smartReply({ content: `Unable to find a random page on [${wikiConfig.name} Wiki](<${wikiConfig.baseUrl}>).`, components: [], ephemeral: true, allowedMentions: { parse: [] } });
            }
            rawPageName = randomTitle;
        }

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
                content = linkIntroductionPageName(pageData.extract, pageData.canonical, wikiConfig);
                imageUrl = pageData.imageUrl;
                displayTitle = canonical;
            }
        }

        if (canonical) {
            if (!content) {
                content = "No content available.";
            }

            const container = buildPageEmbed(displayTitle, truncateContentToParagraphs(content), imageUrl, wikiConfig, gallery, buttonEmoji);

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
    if (interaction.isButton() && interaction.customId === 'contribs:help') {
        return interaction.reply({
            content: `In contribution score lists, <:playerpoint:${CONTRIBSCORES_SCORE_EMOJI}> is the score: \`unique pages edited + 2 × √(total edits − unique pages edited)\`. ✏️ is the number of edits (revisions) counted for the selected period.`,
            ephemeral: true
        }).catch(() => {});
    }

    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'parse' || interaction.commandName === 'wiki' || interaction.commandName === 'user') {
            const focusedOption = interaction.options.getFocused(true);
            const wikiKey = interaction.options.getString('wiki');
            const wikiConfig = WIKIS[wikiKey];

            if (!wikiConfig) {
                return interaction.respond([]).catch(() => {});
            }

            if (focusedOption.name === 'section') {
                const pageName = interaction.options.getString('page');
                return interaction.respond(await getSectionChoices(pageName, focusedOption.value, wikiConfig)).catch(() => {});
            }
            const listType = (focusedOption.name === 'page') ? 'allpages'
                : (focusedOption.name === 'file' ? 'allimages'
                : (focusedOption.name === 'username' ? 'allusers' : null));
            if (!listType) return interaction.respond([]).catch(() => {});

            const choices = await getAutocompleteChoices(wikiConfig, listType, focusedOption.value);
            return interaction.respond(choices).catch(err => console.error(`Failed to respond to ${focusedOption.name} autocomplete:`, err));
        }
        return;
    }

    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'contribs') {
        try {
            await handleContribScoresRequest(interaction, { toggleContribScore, WIKIS, buildPageEmbed, botToAuthorMap, pruneMap, MessageFlags });
            return;
        } catch (err) {
            return sendInteractionError(interaction, err, 'contribs');
        }
    } else if (interaction.commandName === 'speedrun') {
        try {
            const subCommand = interaction.options.getSubcommand();
            let response;
            if (subCommand === 'sb64') {
                const categoryId = interaction.options.getString('category');
                const character = interaction.options.getString('character') || SB64_DEFAULTS.CHARACTER; // Default to Both
                const glitches = interaction.options.getBoolean('glitches');

                const variables = {};
                variables[SB64_VARIABLES.CHARACTER] = character;
                variables[SB64_VARIABLES.GLITCHES] = glitches ? SB64_DEFAULTS.GLITCHES_ON : SB64_DEFAULTS.GLITCHES_OFF; // true = Glitches, false/null = Glitchless

                response = await handleSpeedrunRequest(interaction, 'sb64', categoryId, null, variables);
            } else if (subCommand === 'sr') {
                const filter = interaction.options.getString('filter');
                const version = interaction.options.getString('version');
                let levelId = interaction.options.getString('level');
                const events = interaction.options.getString('events') || SR_DEFAULTS.EVENTS; // Default to No Events

                const variables = {};
                variables[SR_VARIABLES.EVENTS] = events;

                let categoryId;
                if (filter === 'individual_map') {
                    if (!levelId) {
                        return interaction.reply({ content: 'You must select a level when using the "Individual map" filter.', ephemeral: true });
                    }
                    if (version === 'v13') {
                        categoryId = SR_CATEGORY_IDS.INDIVIDUAL_LEVELS_V13;
                    } else if (version === 'v12') {
                        categoryId = SR_CATEGORY_IDS.INDIVIDUAL_LEVELS_V12;
                    } else if (version === 'v10') {
                        categoryId = SR_CATEGORY_IDS.INDIVIDUAL_LEVELS_V10;
                    }
                } else {
                    // Full game or Full game with lobby
                    categoryId = SR_CATEGORY_IDS.ALL_MAPS;
                    levelId = null; // Ensure levelId is cleared for full-game categories

                    if (filter === 'full_game_lobby') {
                        variables[SR_VARIABLES.VERSIONS] = SR_DEFAULTS.VERSION_LOBBY;
                    } else {
                        if (version === 'v13') {
                            variables[SR_VARIABLES.VERSIONS] = SR_DEFAULTS.VERSION_V13;
                        } else if (version === 'v12') {
                            variables[SR_VARIABLES.VERSIONS] = SR_DEFAULTS.VERSION_V12;
                        } else if (version === 'v10') {
                            variables[SR_VARIABLES.VERSIONS] = SR_DEFAULTS.VERSION_V11; // Map V10 to V11 for full game
                        }
                    }
                }

                response = await handleSpeedrunRequest(interaction, 'sr', categoryId, levelId, variables);
            } else if (subCommand === 'abj') {
                const categoryId = interaction.options.getString('category');
                response = await handleSpeedrunRequest(interaction, 'abj', categoryId);
            } else {
                return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true }).catch(() => {});
            }

            if (response && response.id) {
                botToAuthorMap.set(response.id, interaction.user.id);
                pruneMap(botToAuthorMap);
            }
        } catch (err) {
            return sendInteractionError(interaction, err, 'speedrun');
        }
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
    } else if (interaction.commandName === 'user' || interaction.commandName === 'random') {
        const wikiKey = interaction.options.getString('wiki') || nextRandomWikiKey();
        const wikiConfig = WIKIS[wikiKey];
        if (!wikiConfig) {
            await interaction.reply({ content: 'Unknown wiki selection.', ephemeral: true }).catch(() => {});
            return;
        }
        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
            const pageName = interaction.commandName === 'user'
                ? `User:${interaction.options.getString('username')}`
                : 'Special:Random';
            const response = await handleUserRequest(wikiConfig, pageName, interaction, null, interaction.commandName === 'random' ? '🎲' : null);
            if (response && response.id) {
                botToAuthorMap.set(response.id, interaction.user.id);
                pruneMap(botToAuthorMap);
            }
        } catch (err) {
            return sendInteractionError(interaction, err, interaction.commandName);
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
                const section = interaction.options.getString('section');
                response = await handleUserRequest(wikiConfig, section ? `${pageName}#${section}` : pageName, interaction);
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

