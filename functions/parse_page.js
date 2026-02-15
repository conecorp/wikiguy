const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cheerio = require('cheerio');

// --- UTILITIES ---
function htmlToMarkdown(html, baseUrl) {
    if (!html) return "";
    const $ = cheerio.load(html);

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
            headers: { "User-Agent": "DiscordBot/Orbital" } 
        });
        const json = await res.json();
        const pageId = json.query?.pageids?.[0];
        const page = json.query?.pages?.[pageId];

        // if found directly or through redirect return the canonical title
        if (page && page.missing === undefined) {
            return page.title; 
        }

        // use case insensitive search
        const searchParams = new URLSearchParams({
            action: "query",
            list: "search",
            srsearch: raw,
            srlimit: "1",
            format: "json"
        });

        const searchRes = await fetch(`${wikiConfig.apiEndpoint}?${searchParams.toString()}`, {
            headers: { "User-Agent": "DiscordBot/Orbital" }
        });
        const searchJson = await searchRes.json();
        const topResult = searchJson.query?.search?.[0];

        // return the title of the top search result if it exists
        if (topResult) {
            return topResult.title;
        }
    } catch (err) {
        console.warn("findCanonicalTitle lookup failed:", err?.message || err);
    }

    return null;
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
                "User-Agent": "DiscordBot/Orbital",
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
            headers: { "User-Agent": "DiscordBot/Orbital" }
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
            headers: { "User-Agent": "DiscordBot/Orbital" }
        });
        const json = await res.json();

        const html = json.parse?.text?.["*"];
        if (!html) return null;

        const $ = cheerio.load(html);
        const galleryItems = [];

        $('ul.gallery .gallerybox').each((i, el) => {
            const $el = $(el);
            const img = $el.find('img').first();
            let src = img.attr('src');

            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                else if (src.startsWith('/')) src = new URL(src, wikiConfig.baseUrl).href;

                const caption = $el.find('.gallerytext').text().trim();
                galleryItems.push({ url: src, caption });
            }
        });

        // Remove gallery from HTML to avoid duplicating captions in content
        if (galleryItems.length > 0) {
            $('ul.gallery').remove();
        }
        
        return {
            content: htmlToMarkdown($.html(), wikiConfig.baseUrl),
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
            headers: { "User-Agent": "DiscordBot/Orbital" }
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

            replacement = `**${templateName}** → ${actualText.slice(0,1000)}\n${link}`;
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
    getWikiContent, 
    getSectionContent, 
    getLeadSection, 
    parseWikiLinks, 
    parseTemplates
};
