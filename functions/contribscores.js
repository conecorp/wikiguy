const { fetch } = require("./utils.js");

async function getContributionScores(wikiConfig) {
    try {
        const params = new URLSearchParams({
            action: "parse",
            format: "json",
            text: "{{Special:ContributionScores/10/7}}", 
            prop: "text",
            disablelimitreport: "true"
        });

        const url = `${wikiConfig.apiEndpoint}?${params.toString()}`;
        const res = await fetch(url, { headers: { "User-Agent": "DiscordBot/Orbital" } });
        const json = await res.json();
        const html = json.parse?.text?.["*"];

        if (!html) return {
            title: "Special:ContributionScores",
            result: "No content available."
        };

        // Basic Regex to pull the username and score from the HTML table
        const rows = html.split('<tr class="">');
        rows.shift(); // Remove header

        let dataSummary = `## Edit leaderboard for [${wikiConfig.name} Wiki](${wikiConfig.articlePath}Special:ContributionScores) <:emoji:${wikiConfig.emoji}>\n`;
        dataSummary += `-# Top 10 users over the past 7 days\n\n`;
        
        // Extract raw data into an array
        const userData = rows.map((row) => {
            const user = row.match(/<bdi>(.*?)<\/bdi>/)?.[1] || "Unknown";
            const stats = [...row.matchAll(/>([\d,]+)\s*<\/td>/g)];
            
            // grab the score (index 1) and edits (index 3)
            const score = stats[1] ? stats[1][1].replace(/,/g, '') : "0";
            const edits = stats[3] ? stats[3][1] : "0";
            
            return { user, score, edits };
        });
        
        // Find the character length of the highest number (e.g., "100" = 3)
        const maxScoreLength = Math.max(...userData.map(d => d.score.length), 1);
        const maxEditLength = Math.max(...userData.map(d => d.edits.length), 1);
        
        // Loop through the data and build the string with padding
        userData.forEach((data, i) => {
            const paddedScore = data.score.padStart(maxScoreLength, ' ');
            const paddedEdits = data.edits.padStart(maxEditLength, ' ');
        
            dataSummary += `${i + 1}. <:playerpoint:1472433775593000961> \`${paddedScore}\`    ✏️ \`${paddedEdits}\`    **[@${data.user}](${wikiConfig.articlePath}User:${data.user})**\n`;
        });

        if (!dataSummary) return {
            title: "Special:ContributionScores",
            result: "No content available."
        };

        return {
            title: "Special:ContributionScores",
            result: dataSummary
        };
    } catch (err) {
        console.error("Error fetching leaderboard:", err);
        return { error: "Failed to fetch leaderboard data." };
    }
}

async function handleContribScoresRequest(interaction, { toggleContribScore, WIKIS, buildPageEmbed, botToAuthorMap, pruneMap, MessageFlags }) {
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

    try {
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
    } catch (err) {
        console.error("Error in handleContribScoresRequest:", err);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: "An error occurred while fetching contribution scores." });
            } else {
                await interaction.reply({ content: "An error occurred while fetching contribution scores.", ephemeral: true });
            }
        } catch (secondaryErr) {
            console.error("Failed to send error reply:", secondaryErr);
        }
    }
}

module.exports = { getContributionScores, handleContribScoresRequest };
