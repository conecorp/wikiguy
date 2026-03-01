const { fetch } = require("./utils.js");
const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { SB64_CATEGORY_IDS } = require("./commands.js");

const GAMES = {
    sb64: {
        id: "9d3wv0w1",
        name: "SUPER BLOX 64"
    },
    sr: {
        id: "o6gk4xn1",
        name: "Superstar Racers"
    }
};

function formatTime(seconds, forceMinutes = false) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    let parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0 || (forceMinutes && h === 0)) parts.push(`${m}m`);

    // Removed the (s % 1 === 0) check to force 3 decimal places always
    if (s > 0 || parts.length > 0 || forceMinutes) {
        parts.push(`${s.toFixed(3).padStart(6, '0')}s`);
    }

    return parts.join(" ");
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
        headers: { "User-Agent": "DiscordBot/Orbital" },
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

    // SB64 Hub categories are actually levels.
    // Category ID for all per-level categories in SB64 is q25660vk
    if (gameKey === 'sb64' && !levelId) {
        const perLevelCategories = [
            SB64_CATEGORY_IDS.W1_HUB,
            SB64_CATEGORY_IDS.W2_HUB,
            SB64_CATEGORY_IDS.W3_HUB,
            SB64_CATEGORY_IDS.W4_HUB,
            SB64_CATEGORY_IDS.W5_HUB,
            SB64_CATEGORY_IDS.STARBURST_GALAXY,
            SB64_CATEGORY_IDS.ALL_DELUXE
        ];
        if (perLevelCategories.includes(categoryId)) {
            levelId = categoryId;
            categoryId = 'q25660vk';
        }
    }

    try {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        const responseJson = await getLeaderboardData(game.id, categoryId, levelId, variables);
        const leaderboard = responseJson.data;

        if (!leaderboard.runs || leaderboard.runs.length === 0) {
            return await interaction.editReply({ content: `No runs found for this category.` });
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

        const categoryName = leaderboard.category.data.name;
        const levelName = leaderboard.level?.data?.name;

        const mainTitle = levelName ? levelName : game.name;
        let titleLine = `## ${mainTitle}\n`;
        titleLine += `-# ${categoryName}`;
        
        if (levelName) {
            titleLine += ` @ ${game.name}`;
        }
        
        titleLine += `\n`;

        let description = titleLine;

        leaderboard.runs.forEach((runItem) => {
            const place = runItem.place;
            const run = runItem.run;
            const players = run.players.map(p => {
                if (p.rel === "user") return playersMap.get(p.id) || "Unknown";
                return p.name || "Guest";
            }).join(" @");
            const time = formatTime(run.times.primary_t, forceMinutes);
            description += `${place}. <:flag:1477323785366540439> \`${time}\`    [**@${players}**](${run.weblink})\n`;
        });

        const container = new ContainerBuilder();
        const section = new SectionBuilder();
        section.addTextDisplayComponents([new TextDisplayBuilder().setContent(description)]);
        section.setThumbnailAccessory(thumbnail => thumbnail.setURL("https://upload.wikimedia.org/wikipedia/commons/8/89/HD_transparent_picture.png"));

        const row = new ActionRowBuilder();
        row.addComponents(
            new ButtonBuilder()
                .setLabel("View full leaderboard")
                .setStyle(ButtonStyle.Link)
                .setURL(leaderboard.weblink)
        );

        container.addSectionComponents(section);
        container.addActionRowComponents(row);

        return await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

    } catch (err) {
        console.error("Error fetching speedrun leaderboard:", err);
        const errorMessage = err.status === 400 ? `Speedrun.com: ${err.message}` : "An error occurred while fetching the leaderboard.";
        const errorMsg = { content: errorMessage };
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(errorMsg).catch(() => null);
        } else {
            return await interaction.reply({ ...errorMsg, ephemeral: true, fetchReply: true }).catch(() => null);
        }
    }
}

module.exports = { handleSpeedrunRequest };
