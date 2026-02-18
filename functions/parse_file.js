const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const {
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    FileBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

/**
 * Handles the /wiki file command.
 * @param {object} wikiConfig - The wiki configuration object.
 * @param {string} fileName - The name of the file to fetch.
 * @param {object} interaction - The Discord interaction object.
 */
async function handleFileRequest(wikiConfig, fileName, interaction) {
    // Ensure fileName starts with "File:" (namespace 6)
    let searchTitle = fileName;
    if (!searchTitle.toLowerCase().startsWith("file:")) {
        searchTitle = "File:" + fileName;
    }

    const params = new URLSearchParams({
        action: "query",
        titles: searchTitle,
        prop: "imageinfo",
        iiprop: "url|mime",
        format: "json",
        redirects: 1
    });

    try {
        const res = await fetch(`${wikiConfig.apiEndpoint}?${params.toString()}`, {
            headers: { "User-Agent": "DiscordBot/Orbital" }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const json = await res.json();
        const pages = json.query?.pages;
        if (!pages) {
            if (interaction.deferred || interaction.replied) {
                return interaction.followUp({ content: "File not found.", ephemeral: true });
            }
            return interaction.reply({ content: "File not found.", ephemeral: true });
        }

        const page = Object.values(pages)[0];
        if (page.missing !== undefined) {
            if (interaction.deferred || interaction.replied) {
                return interaction.followUp({ content: `File "${fileName}" not found on [${wikiConfig.name}](<${wikiConfig.baseUrl}>).`, ephemeral: true });
            }
            return interaction.reply({ content: `File "${fileName}" not found on [${wikiConfig.name}](<${wikiConfig.baseUrl}>).`, ephemeral: true });
        }

        const info = page.imageinfo?.[0];
        if (!info) {
            if (interaction.deferred || interaction.replied) {
                return interaction.followUp({ content: "Could not retrieve file information.", ephemeral: true });
            }
            return interaction.reply({ content: "Could not retrieve file information.", ephemeral: true });
        }

        const url = info.url;
        const mime = info.mime || "";
        const title = page.title;

        const container = new ContainerBuilder();

        const isPictureOrVideo = mime.startsWith("image/") || mime.startsWith("video/");

        if (isPictureOrVideo) {
            const mediaGallery = new MediaGalleryBuilder();
            mediaGallery.addItems(new MediaGalleryItemBuilder().setURL(url));
            container.addMediaGalleryComponents(mediaGallery);
        } else {
            // Audio or non-media
            const fileComp = new FileBuilder().setURL(url);
            container.addFileComponents(fileComp);
        }

        // Action Row with Button
        const parts = title.split(':').map(s => encodeURIComponent(s.replace(/ /g, "_")));
        const pageUrl = `${wikiConfig.articlePath}${parts.join(':')}`;

        const row = new ActionRowBuilder();
        const btn = new ButtonBuilder()
            .setLabel(title.slice(0, 80))
            .setStyle(ButtonStyle.Link)
            .setURL(pageUrl);

        if (wikiConfig.emoji) {
            try {
                btn.setEmoji(wikiConfig.emoji);
            } catch (err) {
                console.warn("Failed to set emoji on button:", err.message);
            }
        }
        row.addComponents(btn);
        container.addActionRowComponents(row);

        const reply = interaction.deferred || interaction.replied ? interaction.editReply : interaction.reply;
        return await reply.call(interaction, {
            content: "",
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

    } catch (err) {
        console.error("Error in handleFileRequest:", err);
        try {
            if (interaction.deferred || interaction.replied) {
                return await interaction.followUp({ content: "An error occurred while fetching the file information.", ephemeral: true });
            }
            return await interaction.reply({ content: "An error occurred while fetching the file information.", ephemeral: true });
        } catch (secondaryErr) {
            console.error("Failed to send error reply:", secondaryErr);
        }
    }
}

module.exports = { handleFileRequest };
