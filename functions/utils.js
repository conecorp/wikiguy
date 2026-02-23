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
    return fetchInstance(...args);
};

module.exports = { fetch };
