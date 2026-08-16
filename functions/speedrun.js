const { fetch } = require("./utils.js");
const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { WIKIS, SPEEDRUN_EMOJI, BOT_NAME } = require("../config.js");
const { getPageData } = require("./page.js");

const SB64_CATEGORY_IDS = {
    ANY_PERCENT: 'z27jz052',
    HUNDRED_PERCENT: 'jdzzxgxd',
    HUNDRED_TWENTY_TWO_PERCENT: '8244zv32',
    PER_LEVEL_OVERALL: 'q25660vk'
};

const SB64_LEVEL_IDS = {
    W1_HUB: '920j3n7d',
    W2_HUB: '9vmyj5q9',
    W3_HUB: 'd406nrq9',
    W4_HUB: 'd0k0l3m9',
    W5_HUB: 'w6qvrepd',
    STARBURST_GALAXY: '93q08m2w',
    ALL_DELUXE: '9gy3mxk9'
};

const SB64_CATEGORIES = [
    { name: 'Any%', value: SB64_CATEGORY_IDS.ANY_PERCENT },
    { name: '100%', value: SB64_CATEGORY_IDS.HUNDRED_PERCENT },
    { name: '122%', value: SB64_CATEGORY_IDS.HUNDRED_TWENTY_TWO_PERCENT },
    { name: 'World 1 Hub + Breezy Plains', value: SB64_LEVEL_IDS.W1_HUB },
    { name: 'World 2 Hub + Sunshine Beach', value: SB64_LEVEL_IDS.W2_HUB },
    { name: 'World 3 Hub + Sodacan Canyon', value: SB64_LEVEL_IDS.W3_HUB },
    { name: 'World 4 Hub + Freezy Fields', value: SB64_LEVEL_IDS.W4_HUB },
    { name: 'World 5 Hub + Mechanical Museum', value: SB64_LEVEL_IDS.W5_HUB },
    { name: 'Starburst Galaxy', value: SB64_LEVEL_IDS.STARBURST_GALAXY },
    { name: 'All deluxe challenges', value: SB64_LEVEL_IDS.ALL_DELUXE }
];

const SB64_VARIABLES = {
    CHARACTER: 'ylqxg938',
    GLITCHES: 'gnx6d06n'
};

const SB64_CHARACTER_CHOICES = [
    { name: 'Bloxxer', value: 'q65xzdvl' },
    { name: 'Bloxera', value: 'qj74x37q' }
];

const SR_CATEGORY_IDS = {
    ALL_MAPS: 'rkl63l6k',
    INDIVIDUAL_LEVELS_V13: 'xk94rvxd',
    INDIVIDUAL_LEVELS_V12: '9d8qwwwd',
    INDIVIDUAL_LEVELS_V10: 'xd1yxxzd'
};

const SR_FILTER_CHOICES = [
    { name: 'Full game', value: 'full_game' },
    { name: 'Full game with lobby', value: 'full_game_lobby' },
    { name: 'Individual map', value: 'individual_map' }
];

const SR_VERSION_CHOICES = [
    { name: 'Pre-Recode (V10)', value: 'v10' },
    { name: 'Legacy Recode (V12)', value: 'v12' },
    { name: 'Recode (V13)', value: 'v13' }
];

const SR_LEVEL_IDS = {
    ABANDONED_LAB: 'wkkp8rvw',
    BEDROOM: 'wp7q8kzw',
    FLOODED_CITY: 'we28mkrw',
    JUNGLE_UNDERPASS: 'w6qojrgd',
    LUCID_LANE: 'wlg7pxr9',
    MAGMA_BOMB_BLITZ: 'd1j54v6d',
    MARBLE_MANIA: 'dqz7o61d',
    MIDNIGHT_RUSH: 'dqz1n61d',
    RETRO_RACEWAY: '9zp4noow',
    SKY_HIGH_ROPEWAY: '9m5j40ld',
    SLIME_FACTORY: 'd7y326vd',
    SODACAN_CANYON: 'wo723gy9',
    SPACE_STATION: 'wj7evozw',
    SUNSET_OASIS: 'd1j78n5d',
    SURFERS_PARADISE: '95k8mvj9',
    SWEET_SPEEDWAY: '9gy37kk9',
    UNDERWATER_HIGHWAY: '9x1lxm1d',
    WINTER_WONDERLAND: '9gy3vpj9',
    TUTORIAL: 'd7yve1gd',
    LOBBY_EASY: 'wj75z50w',
    LOBBY_MEDIUM: 'wo7060j9',
    LOBBY_HARD: 'd1j727zd'
};

const SR_LEVELS = [
    { name: 'Abandoned Lab', value: SR_LEVEL_IDS.ABANDONED_LAB },
    { name: 'Bedroom', value: SR_LEVEL_IDS.BEDROOM },
    { name: 'Flooded City', value: SR_LEVEL_IDS.FLOODED_CITY },
    { name: 'Jungle Underpass', value: SR_LEVEL_IDS.JUNGLE_UNDERPASS },
    { name: 'Lucid Lane', value: SR_LEVEL_IDS.LUCID_LANE },
    { name: 'Magma Bomb Blitz', value: SR_LEVEL_IDS.MAGMA_BOMB_BLITZ },
    { name: 'Marble Mania', value: SR_LEVEL_IDS.MARBLE_MANIA },
    { name: 'Midnight Rush', value: SR_LEVEL_IDS.MIDNIGHT_RUSH },
    { name: 'Retro Raceway', value: SR_LEVEL_IDS.RETRO_RACEWAY },
    { name: 'Sky-High Ropeway', value: SR_LEVEL_IDS.SKY_HIGH_ROPEWAY },
    { name: 'Slime Factory', value: SR_LEVEL_IDS.SLIME_FACTORY },
    { name: 'Sodacan Canyon', value: SR_LEVEL_IDS.SODACAN_CANYON },
    { name: 'Space Station', value: SR_LEVEL_IDS.SPACE_STATION },
    { name: 'Sunset Oasis', value: SR_LEVEL_IDS.SUNSET_OASIS },
    { name: "Surfer's Paradise", value: SR_LEVEL_IDS.SURFERS_PARADISE },
    { name: 'Sweet Speedway', value: SR_LEVEL_IDS.SWEET_SPEEDWAY },
    { name: 'Underwater Highway', value: SR_LEVEL_IDS.UNDERWATER_HIGHWAY },
    { name: 'Winter Wonderland', value: SR_LEVEL_IDS.WINTER_WONDERLAND },
    { name: 'Tutorial', value: SR_LEVEL_IDS.TUTORIAL },
    { name: 'Lobby Easy Time Trial', value: SR_LEVEL_IDS.LOBBY_EASY },
    { name: 'Lobby Medium Time Trial', value: SR_LEVEL_IDS.LOBBY_MEDIUM },
    { name: 'Lobby Hard Time Trial', value: SR_LEVEL_IDS.LOBBY_HARD }
];

const SR_VARIABLES = {
    EVENTS: 'p85y11vl',
    VERSIONS: 'ylq4gmvn'
};

const SR_EVENTS_CHOICES = [
    { name: 'Raised Speed Cap', value: 'q75rpkv1' },
    { name: 'Low Gravity', value: 'qoxd952q' },
    { name: 'Raised Speed Cap + Low Gravity', value: 'qyzog9d1' }
];

const SB64_DEFAULTS = {
    CHARACTER: '10v9vdjl',
    GLITCHES_ON: 'qox3r45q',
    GLITCHES_OFF: 'lmo4g581'
};

const SR_DEFAULTS = {
    EVENTS: 'qkem56nq',
    VERSION_V13: 'qox9wdxq',
    VERSION_V12: 'ln8w8p0l',
    VERSION_V11: 'lmojmn81',
    VERSION_LOBBY: '12vm002q'
};

const ABJ_CATEGORY_IDS = {
    ALL_ORBS: 'jdr3v4gd',
    MAXWELLS: 'jdzg9z3k',
    ALL_WORLD_ORBS: 'ndxo96rd'
};

const ABJ_LEVEL_IDS = {
    INK_FOREST: 'wo7lq1y9',
    GEARSHOCK_BEACH: 'd1j68e6d'
};

const ABJ_CATEGORIES = [
    { name: 'All Orbs', value: ABJ_CATEGORY_IDS.ALL_ORBS },
    { name: 'Maxwells', value: ABJ_CATEGORY_IDS.MAXWELLS },
    { name: 'Ink Forest', value: ABJ_LEVEL_IDS.INK_FOREST },
    { name: 'Gearshock Beach', value: ABJ_LEVEL_IDS.GEARSHOCK_BEACH }
];

const SB64_PER_LEVEL_CATEGORIES = new Set([
    SB64_LEVEL_IDS.W1_HUB,
    SB64_LEVEL_IDS.W2_HUB,
    SB64_LEVEL_IDS.W3_HUB,
    SB64_LEVEL_IDS.W4_HUB,
    SB64_LEVEL_IDS.W5_HUB,
    SB64_LEVEL_IDS.STARBURST_GALAXY,
    SB64_LEVEL_IDS.ALL_DELUXE
]);

const ABJ_PER_LEVEL_CATEGORIES = new Set([
    ABJ_LEVEL_IDS.INK_FOREST,
    ABJ_LEVEL_IDS.GEARSHOCK_BEACH
]);

const GAMES = {
    sb64: {
        id: "9d3wv0w1",
        name: "SUPER BLOX 64"
    },
    sr: {
        id: "o6gk4xn1",
        name: "Superstar Racers"
    },
    abj: {
        id: "v1pponz1",
        name: "A Block's Journey"
    }
};

const GAME_WIKI_MAP = {
    sb64: 'super-blox-64',
    sr: 'superstar-racers',
    abj: 'a-blocks-journey'
};

function formatTime(seconds, forceMinutes = false) {
    const totalMs = Math.round(seconds * 1000);
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    const mss = String(ms).padStart(3, '0');

    if (h > 0) {
        const hh = String(h).padStart(2, '0');
        return `${hh}:${mm}:${ss}:${mss}`;
    }
    return `${mm}:${ss}:${mss}`;
}

async function getLeaderboardData(gameId, categoryId, levelId = null, variables = {}) {
    let url = `https://www.speedrun.com/api/v1/leaderboards/${gameId}`;
    if (levelId) {
        url += `/level/${levelId}/${categoryId}`;
    } else {
        url += `/category/${categoryId}`;
    }
    url += `?top=10&embed=players,category${levelId ? ',level' : ''}`;

    for (const [key, value] of Object.entries(variables)) {
        if (value) {
            url += `&var-${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
    }

    const res = await fetch(url, {
        headers: { "User-Agent": `${BOT_NAME} Discord bot` },
        signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData.message || `Speedrun.com API returned ${res.status}`;
        const err = new Error(message);
        err.status = res.status;
        throw err;
    }
    return await res.json();
}

async function handleSpeedrunRequest(interaction, gameKey, categoryId, levelId = null, variables = {}) {
    const game = GAMES[gameKey];

    // SB64/ABJ per-level categories are actually levels in the SRC API.
    if (!levelId) {
        if (gameKey === 'sb64' && SB64_PER_LEVEL_CATEGORIES.has(categoryId)) {
            levelId = categoryId;
            categoryId = SB64_CATEGORY_IDS.PER_LEVEL_OVERALL;
        } else if (gameKey === 'abj' && ABJ_PER_LEVEL_CATEGORIES.has(categoryId)) {
            levelId = categoryId;
            categoryId = ABJ_CATEGORY_IDS.ALL_WORLD_ORBS;
        }
    }

    try {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        const responseJson = await getLeaderboardData(game.id, categoryId, levelId, variables);
        const leaderboard = responseJson.data;

        if (!leaderboard.runs || leaderboard.runs.length === 0) {
            const noRunsMsg = { content: `No runs found for this category.`, ephemeral: true };
            await interaction.deleteReply().catch(e => console.warn("Failed to delete reply:", e.message));
            return await interaction.followUp(noRunsMsg);
        }

        const forceMinutes = leaderboard.runs.some(runItem => runItem.run.times.primary_t >= 60);

        const playersMap = new Map();
        leaderboard.players.data.forEach(p => {
            if (p.rel === "user") {
                playersMap.set(p.id, p.names.international);
            } else {
                playersMap.set(p.id, p.name); // Guest
            }
        });

        let categoryName = leaderboard.category.data.name;
        if (gameKey === 'sr' && variables[SR_VARIABLES.VERSIONS] === SR_DEFAULTS.VERSION_LOBBY) {
            categoryName = "All Maps (Lobby)";
        }
        const levelName = leaderboard.level?.data?.name;

        const mainTitle = levelName ? levelName : game.name;
        let titleLine = `## ${mainTitle}\n`;
        titleLine += `-# ${categoryName}`;
        
        if (levelName) {
            titleLine += ` @ ${game.name}`;
        }
        
        titleLine += `\n\n`;

        let description = titleLine;

        leaderboard.runs.forEach((runItem) => {
            const place = runItem.place;
            const run = runItem.run;
            const players = run.players.map(p => {
                if (p.rel === "user") return playersMap.get(p.id) || "Unknown";
                return p.name || "Guest";
            }).join(" @");
            const time = formatTime(run.times.primary_t, forceMinutes);
            description += `${place}. \`${time}\`   [**@${players}**](${run.weblink})\n`;
        });

        const container = new ContainerBuilder();
        const leaderboardSection = new SectionBuilder();
        leaderboardSection.addTextDisplayComponents([new TextDisplayBuilder().setContent(description)]);

        const wikiConfig = WIKIS[GAME_WIKI_MAP[gameKey]];
        const mapPage = await getPageData(mainTitle, wikiConfig);
        if (mapPage?.imageUrl) {
            leaderboardSection.setThumbnailAccessory(thumbnail => thumbnail.setURL(mapPage.imageUrl));
        }
        container.addSectionComponents(leaderboardSection);

        const row = new ActionRowBuilder();
        const button = new ButtonBuilder()
            .setLabel("View list")
            .setStyle(ButtonStyle.Link)
            .setURL(leaderboard.weblink);
        if (SPEEDRUN_EMOJI) button.setEmoji(SPEEDRUN_EMOJI);
        row.addComponents(button);
        row.addComponents(new ButtonBuilder()
            .setCustomId("speedrun:help")
            .setLabel("What does this mean?")
            .setStyle(ButtonStyle.Secondary));

        container.addActionRowComponents(row);

        return await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

    } catch (err) {
        console.error("Error fetching speedrun leaderboard:", err);
        const errorMessage = err.status === 400 ? `Speedrun.com: ${err.message}` : "An error occurred while fetching the leaderboard.";
        const errorMsg = { content: errorMessage, ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            await interaction.deleteReply().catch(() => {});
            return await interaction.followUp(errorMsg).catch(() => null);
        } else {
            return await interaction.reply(errorMsg).catch(() => null);
        }
    }
}

module.exports = {
    handleSpeedrunRequest,
    SB64_CATEGORY_IDS,
    SB64_LEVEL_IDS,
    SB64_CATEGORIES,
    SB64_VARIABLES,
    SB64_CHARACTER_CHOICES,
    SR_CATEGORY_IDS,
    SR_FILTER_CHOICES,
    SR_VERSION_CHOICES,
    SR_LEVEL_IDS,
    SR_LEVELS,
    SR_VARIABLES,
    SR_EVENTS_CHOICES,
    SB64_DEFAULTS,
    SR_DEFAULTS,
    ABJ_CATEGORIES
};

