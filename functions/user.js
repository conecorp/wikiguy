const cheerio = require("cheerio");
const { fetch } = require("./utils.js");
const { getPageData } = require("./page.js");
const { BOT_NAME } = require("../config.js");
const BOT_USER_AGENT = `${BOT_NAME} Discord bot`;

async function getUserProfile(username, wikiConfig) {
    const normalized = String(username).trim().replace(/^User\s*:\s*/i, "").replace(/^@/, "");
    if (!normalized) return null;
    const params = new URLSearchParams({ action: "query", format: "json", list: "users", ususers: normalized, usprop: "groups|editcount" });
    try {
        const response = await fetch(`${wikiConfig.apiEndpoint}?${params}`, { headers: { "User-Agent": BOT_USER_AGENT } });
        if (!response.ok) return null;
        const user = (await response.json()).query?.users?.[0];
        if (!user || user.invalid !== undefined || user.userid === 0) return null;
        let avatarUrl = null;
        try {
            const profileUrl = `${wikiConfig.articlePath}User:${encodeURIComponent(normalized.replace(/ /g, "_"))}`;
            const profileResponse = await fetch(profileUrl, { headers: { "User-Agent": BOT_USER_AGENT } });
            if (profileResponse.ok) {
                const $profile = cheerio.load(await profileResponse.text());
                avatarUrl = $profile("img.profile-avatar-image").first().attr("src") || null;
                if (avatarUrl?.startsWith("//")) avatarUrl = `https:${avatarUrl}`;
                else if (avatarUrl?.startsWith("/")) avatarUrl = new URL(avatarUrl, wikiConfig.baseUrl).href;
            }
        } catch (err) { console.warn("Failed to fetch profile avatar:", err.message); }
        const page = await getPageData(`User:${normalized}`, wikiConfig);
        const profileUrl = `${wikiConfig.articlePath}User:${normalized.replace(/ /g, "_")}`;
        const fallback = { bureaucrat: "Bureaucrat", "interface-admin": "Interface administrator", sysop: "Administrator", autoconfirmed: "Autoconfirmed", confirmed: "Confirmed", bot: "Bot" };
        const visibleGroups = (Array.isArray(user.groups) ? user.groups : []).filter(group => !["*", "user"].includes(group));
        const labels = {};
        if (visibleGroups.length) {
            try {
                const labelParams = new URLSearchParams({ action: "query", format: "json", meta: "allmessages", ammessages: visibleGroups.map(group => `group-${group}-member`).join("|"), amlang: "content" });
                const messages = (await (await fetch(`${wikiConfig.apiEndpoint}?${labelParams}`, { headers: { "User-Agent": BOT_USER_AGENT } })).json()).query?.allmessages || [];
                Object.assign(labels, Object.fromEntries(messages.filter(message => message['*'] && !message['*'].includes("⧼")).map(message => [message.name, message['*']])));
            } catch (err) { console.warn("Failed to fetch on-wiki group labels:", err.message); }
        }
        const clean = label => String(label).replace(/\{\{\s*GENDER\s*:\s*[^|}]+\|([^{}]*)\}\}/gi, "$1").replace(/\{\{[^{}]*\}\}/g, "").trim().replace(/[-_]+/g, " ").toLowerCase();
        const groups = visibleGroups.map(group => clean(labels[`group-${group}-member`] || fallback[group] || group)).map((group, index) => index === 0 ? group.charAt(0).toUpperCase() + group.slice(1) : group);
        return { username: user.name || normalized, groups: [...new Set(groups)], editCount: Number.isFinite(Number(user.editcount)) ? Number(user.editcount) : null, avatarUrl, profileUrl, contribsUrl: `${wikiConfig.articlePath}Special:Contributions/${encodeURIComponent(user.name || normalized)}`, content: page?.extract || "" };
    } catch (err) { console.warn("getUserProfile failed:", err.message); return null; }
}

module.exports = { getUserProfile };
