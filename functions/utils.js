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
function truncateToParagraphs(text, maxParagraphs = 2) {
    if (!text) return "";
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

    const ellipsis = (value) => value.replace(/\.\s*$/, '') + '...';
    let result;
    if (paragraphs.length <= maxParagraphs) {
        result = text;
    } else {
        result = ellipsis(paragraphs.slice(0, maxParagraphs).join('\n\n'));
    }

    // Ensure the result doesn't exceed Discord's 2000 character limit
    if (result.length > 2000) {
        // Try to truncate at paragraph boundaries
        let truncated = "";
        for (const para of paragraphs) {
            const testResult = truncated ? truncated + '\n\n' + para : para;
            if (testResult.length + 3 > 2000) break; // +3 for '...'
            truncated = testResult;
        }
        result = ellipsis(truncated);

        // If still too long, hard truncate
        if (result.length > 2000) {
            result = result.substring(0, 1997) + '...';
        }
    }

    return result;
}

module.exports = { fetch, truncateToParagraphs };
