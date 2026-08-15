const { fetch, truncateToParagraphs: truncateContentToParagraphs } = require("./utils.js");  
const { BOT_NAME } = require("../config.js");
const cheerio = require('cheerio');

const BOT_USER_AGENT = `${BOT_NAME} Discord bot`;

// --- CACHING ---
const CANONICAL_CACHE = new Map();
const PAGE_DATA_CACHE = new Map();
const MAX_CACHE_SIZE = 500;

function pruneCache(map) {
    while (map.size > MAX_CACHE_SIZE) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
    }
}

// --- UTILITIES ---
function getFullSizeImageUrl(url) {
    if (!url || !url.includes('/thumb/')) return url;
    try {
        const urlObj = new URL(url);
        if (urlObj.pathname.includes('/thumb/')) {
            // Remove /thumb/ from pathname
            urlObj.pathname = urlObj.pathname.replace(/\/thumb\//, '/');
            // Remove the last segment (thumbnail size part)
            const pathParts = urlObj.pathname.split('/');
            pathParts.pop();
            urlObj.pathname = pathParts.join('/');
            return urlObj.href;
        }
    } catch (e) {
        // Fallback for weird URLs
        let newUrl = url.replace(/\/thumb\//, '/');
        const lastSlash = newUrl.lastIndexOf('/');
        if (lastSlash !== -1) {
            newUrl = newUrl.substring(0, lastSlash);
        }
        return newUrl;
    }
    return url;
}

function linkIntroductionPageName(content, pageTitle, wikiConfig) {
    if (!content || !pageTitle || !wikiConfig) return content;

    const firstParagraphEnd = content.search(/\n\s*\n/);
    const firstParagraph = firstParagraphEnd === -1 ? content : content.slice(0, firstParagraphEnd);
    const boldMatch = firstParagraph.match(/(?<!\[)\*\*([^*\n]+)\*\*/);
    if (!boldMatch) return content;

    const pageName = String(pageTitle).split("#")[0].replace(/_/g, " ").trim();
    if (!pageName || !boldMatch[1].toLowerCase().includes(pageName.toLowerCase())) return content;

    const pageOnly = String(pageTitle).split("#")[0];
    const parts = pageOnly.split(":").map(part => encodeURIComponent(part.replace(/ /g, "_")));
    const url = `<${wikiConfig.articlePath}${parts.join(":")}>`;
    const linked = `[**${boldMatch[1]}**](${url})`;
    const start = boldMatch.index;
    const end = start + boldMatch[0].length;
    return firstParagraph.slice(0, start) + linked + firstParagraph.slice(end) + content.slice(firstParagraph.length);
}

function htmlToMarkdown(html, baseUrl, $existing = null) {
    if (!html && !$existing) return "";
    const $ = $existing || cheerio.load(html);

    if (!html && $existing) {
        // If we are using an existing cheerio instance, we should work with it as is.
    }

    // Remove unwanted elements
    $('style, script, .thumb, figure, table, .mw-editsection, sup.reference, .noprint, .nomobile, .error, input, .ext-floatingui-content, .infobox, .portable-infobox, table[class*="infobox"], ol.references, .mw-collapsed, .template-navplate').remove();

    function convertNode(node) {
        if (node.type === 'text') {
            return node.data;
        }

        const $node = $(node);
        let childrenContent = '';
        if (node.children) {
            node.children.forEach((child) => {
                childrenContent += convertNode(child);
            });
        }

        switch (node.name) {
            case 'b':
            case 'strong':
                return childrenContent.trim() ? `**${childrenContent.trim()}**` : '';
            case 'i':
            case 'em':
                return childrenContent.trim() ? `*${childrenContent.trim()}*` : '';
            case 'a':
                let href = $node.attr('href');
                if (href) {
                    if (href.startsWith('/')) {
                        href = new URL(href, baseUrl).href;
                    } else if (!href.startsWith('http')) {
                        try { href = new URL(href, baseUrl).href; } catch (e) {}
                    }
                    const text = childrenContent.trim().replace(/\[/g, '\\[').replace(/\]/g, '\\]');
                    return text ? `[${text}](<${href}>)` : '';
                }
                return childrenContent;
            case 'br':
                return '\n';
            case 'p':
            case 'div':
                return `${childrenContent}\n\n`;
            case 'ul':
            case 'ol':
                return `${childrenContent}\n`;
            case 'li': {
                const isOrdered = node.parent && node.parent.name === 'ol';
                const prefix = isOrdered
                    ? `${Array.from(node.parent.children).filter(c => c.name === 'li').indexOf(node) + 1}. `
                    : '* ';
                return `${prefix}${childrenContent.trim()}\n`;
            }
            case 'h1':
            case 'h2':
                return childrenContent.trim() ? `## ${childrenContent.trim()}\n` : '';
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                return childrenContent.trim() ? `### ${childrenContent.trim()}\n` : '';
            default:
                return childrenContent;
        }
    }

    let text = '';
    const root = $('.mw-parser-output').length ? $('.mw-parser-output') : $.root();
    root.contents().each((i, node) => {
        text += convertNode(node);
    });

    // Fix formatting: collapse multiple spaces and handle newlines
    text = text.replace(/[ \t]+/g, ' '); // Collapse spaces/tabs
    text = text.replace(/\n\s*\n/g, '\n\n'); // Max two newlines
    text = text.replace(/ +/g, ' '); // One more pass for space cleanup after newline adjustments

    return text.trim();
}

// --- WIKI API FUNCTIONS ---

async function findCanonicalTitle(input, wikiConfig) {
    if (!input) return null;
    const raw = String(input).trim();
    const wikiKey = wikiConfig.prefix || wikiConfig.baseUrl;
    const cacheKey = `${wikiKey}:${raw.toLowerCase()}`;

    if (CANONICAL_CACHE.has(cacheKey)) return CANONICAL_CACHE.get(cacheKey);

    try {
        // direct lookup
        const directParams = new URLSearchParams({
            action: "query",
            format: "json",
            titles: raw,
            redirects: "1",
            indexpageids: "1"
        });

        const res = await fetch(`${wikiConfig.apiEndpoint}?${directParams.toString()}`, { 
            headers: { "User-Agent": BOT_USER_AGENT } 
        });
        const json = await res.json();
        const pageId = json.query?.pageids?.[0];
        const page = json.query?.pages?.[pageId];

        // if found directly or through redirect return the canonical title
        if (page && page.missing === undefined) {
            const canonical = page.title;
            CANONICAL_CACHE.set(cacheKey, canonical);
            pruneCache(CANONICAL_CACHE);
            return canonical;
        }

        // use case insensitive search
        const searchParams = new URLSearchParams({
            action: "query",
            list: "search",
            srsearch: `intitle:${raw}`,
            srlimit: "1",
            format: "json"
        });

        const searchRes = await fetch(`${wikiConfig.apiEndpoint}?${searchParams.toString()}`, {
            headers: { "User-Agent": BOT_USER_AGENT }
        });
        const searchJson = await searchRes.json();
        const topResult = searchJson.query?.search?.[0];

        // return the title of the top search result if it exists
        if (topResult) {
            const canonical = topResult.title;
            CANONICAL_CACHE.set(cacheKey, canonical);
            pruneCache(CANONICAL_CACHE);
            return canonical;
        }
    } catch (err) {
        console.warn("findCanonicalTitle lookup failed:", err?.message || err);
    }

    return null;
}

async function getPageData(input, wikiConfig) {
    if (!input) return null;
    const raw = String(input).trim();
    const wikiKey = wikiConfig.prefix || wikiConfig.baseUrl;
    const cacheKey = `${wikiKey}:${raw.toLowerCase()}`;

    // 1. Check Cache
    if (CANONICAL_CACHE.has(cacheKey)) {
        const canonical = CANONICAL_CACHE.get(cacheKey);
        const pageCacheKey = `${wikiKey}:${canonical}`;
        if (PAGE_DATA_CACHE.has(pageCacheKey)) {
            return { canonical, ...PAGE_DATA_CACHE.get(pageCacheKey) };
        }
    }

    try {
        // 2. Try combined query
        const params = new URLSearchParams({
            action: "query",
            format: "json",
            titles: raw,
            prop: "extracts|pageimages",
            exintro: "1",
            pithumbsize: "512",
            redirects: "1",
            indexpageids: "1"
        });

        const res = await fetch(`${wikiConfig.apiEndpoint}?${params.toString()}`, {
            headers: { "User-Agent": BOT_USER_AGENT }
        });
        const json = await res.json();

        let pageId = json.query?.pageids?.[0];
        let page = json.query?.pages?.[pageId];

        // 3. If missing, try intitle search
        if (!page || page.missing !== undefined) {
            const canonical = await findCanonicalTitle(raw, wikiConfig);
            if (canonical && canonical !== raw) {
                return await getPageData(canonical, wikiConfig);
            }
            return null;
        }

        // 4. Extract data
        const canonical = page.title;
        const extract = page.extract ? htmlToMarkdown(page.extract, wikiConfig.baseUrl) : null;
        const imageUrl = getFullSizeImageUrl(page.thumbnail?.source || null);

        const data = { extract, imageUrl };

        // 5. Update Cache
        CANONICAL_CACHE.set(cacheKey, canonical);
        pruneCache(CANONICAL_CACHE);

        PAGE_DATA_CACHE.set(`${wikiKey}:${canonical}`, data);
        pruneCache(PAGE_DATA_CACHE);

        return { canonical, ...data };

    } catch (err) {
        console.warn("getPageData failed:", err.message);
        return null;
    }
}

async function getRandomPage(wikiConfig) {
    const params = new URLSearchParams({
        action: "query",
        format: "json",
        list: "random",
        rnnamespace: "0",
        rnlimit: "1"
    });
    try {
        const res = await fetch(`${wikiConfig.apiEndpoint}?${params.toString()}`, { headers: { "User-Agent": BOT_USER_AGENT } });
        if (!res.ok) return null;
        const json = await res.json();
        return json.query?.random?.[0]?.title || null;
    } catch (err) {
        console.warn("getRandomPage failed:", err.message);
        return null;
    }
}

function firstValue(value, keys) {
    if (!value || typeof value !== "object") return null;
    for (const key of keys) {
        if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
    }
    for (const child of Object.values(value)) {
        if (child && typeof child === "object") {
            const result = firstValue(child, keys);
            if (result) return result;
        }
    }
    return null;
}

async function getUserProfile(username, wikiConfig) {
    const normalized = String(username).trim().replace(/^User\s*:\s*/i, "").replace(/^@/, "");
    if (!normalized) return null;
    const userParams = new URLSearchParams({
        action: "query",
        format: "json",
        list: "users",
        ususers: normalized,
        usprop: "groups|editcount"
    });

    try {
        const userRes = await fetch(`${wikiConfig.apiEndpoint}?${userParams.toString()}`, { headers: { "User-Agent": BOT_USER_AGENT } });
        if (!userRes.ok) return null;
        const userJson = await userRes.json();
        const user = userJson.query?.users?.[0];
        if (!user || user.invalid !== undefined || user.userid === 0) return null;

        let avatarUrl = null;
        try {
            const profilePageUrl = `${wikiConfig.articlePath}User:${encodeURIComponent(normalized.replace(/ /g, "_"))}`;
            const profilePageRes = await fetch(profilePageUrl, { headers: { "User-Agent": BOT_USER_AGENT } });
            if (profilePageRes.ok) {
                const $profile = cheerio.load(await profilePageRes.text());
                avatarUrl = $profile("img.profile-avatar-image").first().attr("src") || null;
                if (avatarUrl?.startsWith("//")) avatarUrl = `https:${avatarUrl}`;
                else if (avatarUrl?.startsWith("/")) avatarUrl = new URL(avatarUrl, wikiConfig.baseUrl).href;
            }
        } catch (err) {
            console.warn("Failed to fetch profile avatar:", err.message);
        }
        const page = await getPageData(`User:${normalized}`, wikiConfig);
        const profileUrl = `${wikiConfig.articlePath}User:${normalized.replace(/ /g, "_")}`;
        const fallbackGroupLabels = {
            bureaucrat: "Bureaucrat",
            "interface-admin": "Interface administrator",
            sysop: "Administrator",
            autoconfirmed: "Autoconfirmed",
            confirmed: "Confirmed",
            bot: "Bot"
        };
        const visibleGroups = (Array.isArray(user.groups) ? user.groups : [])
            .filter(group => !["*", "user"].includes(group));
        const messageNames = visibleGroups.map(group => `group-${group}-member`).join("|");
        let wikiGroupLabels = {};
        if (messageNames) {
            try {
                const labelParams = new URLSearchParams({
                    action: "query",
                    format: "json",
                    meta: "allmessages",
                    ammessages: messageNames,
                    amlang: "content"
                });
                const labelRes = await fetch(`${wikiConfig.apiEndpoint}?${labelParams.toString()}`, { headers: { "User-Agent": BOT_USER_AGENT } });
                const messages = (await labelRes.json()).query?.allmessages || [];
                wikiGroupLabels = Object.fromEntries(messages
                    .filter(message => message['*'] && !message['*'].includes("⧼"))
                    .map(message => [message.name, message['*']]));
            } catch (err) {
                console.warn("Failed to fetch on-wiki group labels:", err.message);
            }
        }
        const cleanGroupLabel = label => String(label)
            .replace(/\{\{\s*GENDER\s*:\s*[^|}]+\|([^{}]*)\}\}/gi, "$1")
            .replace(/\{\{[^{}]*\}\}/g, "")
            .trim()
            .replace(/[-_]+/g, " ")
            .toLowerCase();
        const groups = visibleGroups.map(group => cleanGroupLabel(
            wikiGroupLabels[`group-${group}-member`] || fallbackGroupLabels[group] || group
        )).map((group, index) => index === 0
            ? group.charAt(0).toUpperCase() + group.slice(1)
            : group);

        return {
            username: user.name || normalized,
            groups: [...new Set(groups)],
            editCount: Number.isFinite(Number(user.editcount)) ? Number(user.editcount) : null,
            avatarUrl,
            profileUrl,
            contribsUrl: `${wikiConfig.articlePath}Special:Contributions/${encodeURIComponent(user.name || normalized)}`,
            content: page?.extract || ""
        };
    } catch (err) {
        console.warn("getUserProfile failed:", err.message);
        return null;
    }
}

async function getSectionChoices(pageTitle, prefix, wikiConfig) {
    if (!pageTitle || !wikiConfig) return [];
    const canonical = await findCanonicalTitle(pageTitle, wikiConfig) || pageTitle;
    const params = new URLSearchParams({ action: "parse", format: "json", prop: "sections", page: canonical });
    try {
        const res = await fetch(`${wikiConfig.apiEndpoint}?${params}`, { headers: { "User-Agent": BOT_USER_AGENT } });
        const sections = (await res.json()).parse?.sections || [];
        const search = String(prefix || "").toLowerCase();
        return sections
            .map(section => {
                const name = section.line.replace(/<[^>]*>?/gm, "");
                return { name, value: name };
            })
            .filter(choice => choice.name.toLowerCase().includes(search))
            .slice(0, 25);
    } catch (err) {
        console.warn("getSectionChoices failed:", err.message);
        return [];
    }
}

async function getWikiContent(pageTitle, wikiConfig) {
    const params = new URLSearchParams({
        action: "parse",
        page: pageTitle,
        format: "json",
        prop: "text",
    });

    try {
        const res = await fetch(`${wikiConfig.apiEndpoint}?${params.toString()}`, {
            headers: {
                "User-Agent": BOT_USER_AGENT,
                "Origin": wikiConfig.baseUrl,
            },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const json = await res.json();

        if (json?.parse?.text?.["*"]) {
            return htmlToMarkdown(json.parse.text["*"], wikiConfig.baseUrl);
        }
        return null;
    } catch (err) {
        console.error(`Failed to fetch content for "${pageTitle}":`, err.message);
        return null;
    }
}

async function getSectionIndex(pageTitle, sectionName, wikiConfig) {
    const canonical = await findCanonicalTitle(pageTitle, wikiConfig) || pageTitle;
    const params = new URLSearchParams({
        action: "parse",
        format: "json",
        prop: "sections",
        page: canonical
    });

    try {
        const res = await fetch(`${wikiConfig.apiEndpoint}?${params}`, {
            headers: { "User-Agent": BOT_USER_AGENT }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const json = await res.json();

        const sections = json.parse?.sections || [];
        if (!sections.length) return null;

        const match = sections.find(
            s => s.line.replace(/<[^>]*>?/gm, "").toLowerCase() === sectionName.toLowerCase()
        );

        if (!match) return null;

        return {
            index: match.index,
            line: match.line.replace(/<[^>]*>?/gm, "")
        };
    } catch (err) {
        console.error(`Failed to fetch section index for "${sectionName}" in "${pageTitle}":`, err.message);
        return null;
    }
}

async function getSectionContent(pageTitle, sectionName, wikiConfig) {
    const sectionInfo = await getSectionIndex(pageTitle, sectionName, wikiConfig);
    if (!sectionInfo) {
        console.warn(`Section "${sectionName}" not found in "${pageTitle}"`);
        return null;
    }

    const params = new URLSearchParams({
        action: "parse",
        format: "json",
        prop: "text",
        page: pageTitle,
        section: sectionInfo.index
    });

    try {
        const res = await fetch(`${wikiConfig.apiEndpoint}?${params}`, {
            headers: { "User-Agent": BOT_USER_AGENT }
        });
        const json = await res.json();

        const html = json.parse?.text?.["*"];
        if (!html) return null;

        const $ = cheerio.load(html);
        const galleryItems = [];

        $('ul.gallery .gallerybox').each((i, el) => {
            const $el = $(el);
            const img = $el.find('img').first();
            const video = $el.find('video').first();
            let src = img.attr('src') || video.attr('src') || video.find('source').first().attr('src');

            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                else if (src.startsWith('/')) src = new URL(src, wikiConfig.baseUrl).href;

                // Transform to full-size URL
                src = getFullSizeImageUrl(src);

                const caption = $el.find('.gallerytext').text().trim();
                galleryItems.push({ url: src, caption });
            }
        });

        // Remove gallery from HTML to avoid duplicating captions in content
        if (galleryItems.length > 0) {
            $('ul.gallery').remove();
        }
        
        return {
            content: htmlToMarkdown(null, wikiConfig.baseUrl, $),
            displayTitle: sectionInfo.line,
            gallery: galleryItems.length > 0 ? galleryItems : null
        };
    } catch (err) {
        console.error(`Failed to fetch section content for "${pageTitle}#${sectionName}":`, err.message);
        return null;
    }
}

async function getLeadSection(pageTitle, wikiConfig) {
    const params = new URLSearchParams({
        action: "query",
        prop: "extracts",
        exintro: "1",
        redirects: "1",
        titles: pageTitle,
        format: "json"
    });

    try {
        const res = await fetch(`${wikiConfig.apiEndpoint}?${params.toString()}`, {
            headers: { "User-Agent": BOT_USER_AGENT }
        });
        const json = await res.json();
        const pages = json.query?.pages;
        if (!pages) return null;
        const page = Object.values(pages)[0];
        const html = page?.extract;
        if (!html) return null;
        return htmlToMarkdown(html, wikiConfig.baseUrl);
    } catch (err) {
        console.error(`Failed to fetch lead section for "${pageTitle}":`, err.message);
        return null;
    }
}

async function parseWikiLinks(text, wikiConfig) {
    const regex = /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g;
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        matches.push({
            index: match.index,
            length: match[0].length,
            page: match[1].trim(),
            label: match[2] ? match[2].trim() : null
        });
    }

    const processed = await Promise.all(matches.map(async m => {
        const display = m.label || m.page;
        const canonical = await findCanonicalTitle(m.page, wikiConfig) || m.page;

        let pageOnly = canonical;
        let fragment = null;
        if (canonical.includes("#")) {
            [pageOnly, fragment] = canonical.split("#");
            fragment = fragment.trim();
        }

        const parts = pageOnly.split(':').map(seg => encodeURIComponent(seg.replace(/ /g, "_")));
        const anchor = fragment ? `#${encodeURIComponent(fragment.replace(/ /g, "_"))}` : '';
        const url = `<${wikiConfig.articlePath}${parts.join(':')}${anchor}>`;

        return { index: m.index, length: m.length, replacement: `[**${display}**](${url})` };
    }));

    let res = text;
    processed.sort((a,b)=> b.index - a.index);
    for (const { index, length, replacement } of processed) {
        res = res.slice(0, index) + replacement + res.slice(index + length);
    }
    return res;
}

async function parseTemplates(text, wikiConfig) {
    const regex = /\{\{([^{}|]+)(?:\|([^{}]*))?\}\}/g;
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        matches.push({
            fullMatch: match[0],
            templateName: match[1].trim(),
            param: match[2]?.trim(),
            index: match.index, 
            length: match[0].length,
        });
    }

    const processedMatches = await Promise.all(matches.map(async (m) => {
        const { fullMatch, templateName, param, index, length } = m;
        let replacement = fullMatch; 

        const canonical = await findCanonicalTitle(templateName, wikiConfig);
        if (!canonical) {
            return { index, length, replacement: "I don't know." };
        }

        let pageOnly = canonical;
        let fragment = null;
        if (canonical.includes("#")) {
            [pageOnly, fragment] = canonical.split("#");
            fragment = fragment.trim();
        }

        let wikiText = null;
        try {
            if (fragment) {
                wikiText = await getSectionContent(pageOnly, fragment, wikiConfig);
            } else {
                wikiText = await getLeadSection(pageOnly, wikiConfig);
            }
        } catch (err) {
            wikiText = null;
        }

        const actualText = (wikiText && typeof wikiText === 'object') ? wikiText.content : wikiText;

        if (actualText) {
            const parts = pageOnly.split(':').map(seg => encodeURIComponent(seg.replace(/ /g, "_")));
            const anchor = fragment ? `#${encodeURIComponent(fragment.replace(/ /g, "_"))}` : '';
            const link = `<${wikiConfig.articlePath}${parts.join(':')}${anchor}>`;

            replacement = `**${templateName}** → ${truncateContentToParagraphs(actualText)}\n${link}`;
        } else {
            replacement = "I don't know.";
        }

        return { index, length, replacement };
    }));

    let result = text;
    processedMatches.sort((a, b) => b.index - a.index);
    for (const { index, length, replacement } of processedMatches) {
        result = result.slice(0, index) + replacement + result.slice(index + length);
    }

    return result;
}

module.exports = { 
    findCanonicalTitle, 
    getPageData,
    getWikiContent, 
    getSectionContent, 
    getLeadSection, 
    getRandomPage,
    getUserProfile,
    getSectionChoices,
    parseWikiLinks, 
    parseTemplates,
    getFullSizeImageUrl,
    linkIntroductionPageName
};


