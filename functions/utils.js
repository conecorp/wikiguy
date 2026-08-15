let fetchInstance;
/**
 * Lazy-loading node-fetch wrapper.
 * Requires Node.js >= 17.3.0 for AbortSignal.timeout support in callers.
 */
const fetch = async (...args) => {
    if (!fetchInstance) {
        const module = await import("node-fetch");
        fetchInstance = module.default;
    }

    let [urlOrRequest, options = {}] = args;
    const newOptions = { ...options };

    // Add a default 10s timeout if no signal is explicitly provided in options.
    // This prevents hanging requests from leaking resources.
    if (AbortSignal.timeout && !newOptions.signal) {
        newOptions.signal = AbortSignal.timeout(10000);
    }

    return fetchInstance(urlOrRequest, newOptions);
};

/**
 * Truncates a markdown string to a certain number of paragraphs.
 * Paragraphs are assumed to be separated by double newlines (\n\n).
 * @param {string} text - The markdown text to truncate.
 * @param {number} maxParagraphs - Maximum number of paragraphs to keep.
 * @returns {string} - The truncated text.
 */
function truncateToParagraphs(text, maxParagraphs = 2, maxCharacters = null) {
    if (!text) return "";
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

    const ellipsis = (value) => value.replace(/\.\s*$/, '') + '...';
    let result = paragraphs.length <= maxParagraphs
        ? text
        : ellipsis(paragraphs.slice(0, maxParagraphs).join('\n\n'));

    if (maxCharacters && result.length > maxCharacters) {
        result = result.slice(0, Math.max(0, maxCharacters - 3)).replace(/\s+$/, '') + '...';
    }

    // Preserve the original Discord message limit for general page content.
    if (result.length > 2000) {
        let truncated = "";
        for (const para of paragraphs) {
            const testResult = truncated ? truncated + '\n\n' + para : para;
            if (testResult.length + 3 > 2000) break;
            truncated = testResult;
        }
        result = ellipsis(truncated);

        if (result.length > 2000) {
            result = result.substring(0, 1997) + '...';
        }
    }

    return result;
}

module.exports = { fetch, truncateToParagraphs };
