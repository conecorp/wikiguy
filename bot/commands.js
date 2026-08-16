const { WIKIS } = require("../config.js");
const {
    SB64_CATEGORIES,
    SB64_CHARACTER_CHOICES,
    SR_FILTER_CHOICES,
    SR_VERSION_CHOICES,
    SR_LEVELS,
    SR_EVENTS_CHOICES,
    SB64_CATEGORY_IDS,
    SB64_LEVEL_IDS,
    SB64_VARIABLES,
    SB64_DEFAULTS,
    SR_CATEGORY_IDS,
    SR_VARIABLES,
    SR_DEFAULTS,
    ABJ_CATEGORIES
} = require("../functions/speedrun.js");

const wikiChoices = Object.entries(WIKIS).map(([key, wiki]) => ({
    name: wiki.name,
    value: key
}));

const commands = [
    {
        name: 'speedrun',
        description: 'View speedrun leaderboards',
        integrationTypes: [0, 1],
        contexts: [0, 1, 2],
        options: [
            {
                name: 'sb64',
                description: 'SUPER BLOX 64\'s speedrun leaderboard',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'category',
                        description: 'The category to view',
                        type: 3, // STRING
                        required: true,
                        choices: SB64_CATEGORIES
                    },
                    {
                        name: 'character',
                        description: 'Filter by character',
                        type: 3, // STRING
                        required: false,
                        choices: SB64_CHARACTER_CHOICES
                    },
                    {
                        name: 'glitches',
                        description: 'Filter by glitch category',
                        type: 5, // BOOLEAN
                        required: false
                    }
                ]
            },
            {
                name: 'sr',
                description: 'Superstar Racers\' speedrun leaderboard',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'filter',
                        description: 'The filter to apply',
                        type: 3, // STRING
                        required: true,
                        choices: SR_FILTER_CHOICES
                    },
                    {
                        name: 'version',
                        description: 'The version to view',
                        type: 3, // STRING
                        required: true,
                        choices: SR_VERSION_CHOICES
                    },
                    {
                        name: 'level',
                        description: 'The level to view (only works with Individual map filter)',
                        type: 3, // STRING
                        required: false,
                        choices: SR_LEVELS
                    },
                    {
                        name: 'events',
                        description: 'Filter by events',
                        type: 3, // STRING
                        required: false,
                        choices: SR_EVENTS_CHOICES
                    }
                ]
            },
            {
                name: 'abj',
                description: 'A Block\'s Journey\'s speedrun leaderboard',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'category',
                        description: 'The category to view',
                        type: 3, // STRING
                        required: true,
                        choices: ABJ_CATEGORIES
                    }
                ]
            }
        ]
    },
    {
        name: 'contribs',
        description: 'View wiki contribution scores',
        integrationTypes: [0, 1],
        contexts: [0, 1, 2],
        options: [
            {
                name: 'wiki',
                description: 'Select a wiki',
                type: 3, // STRING
                required: true,
                choices: wikiChoices
            }
        ]
    },
    {
        name: 'wiki',
        description: 'Get a link to a wiki',
        integrationTypes: [0, 1],
        contexts: [0, 1, 2],
        options: [
            {
                name: 'wiki',
                description: 'The wiki to link to',
                type: 3, // STRING
                required: true,
                choices: wikiChoices
            }
        ]
    },
    {
        name: 'parse',
        description: 'Search for a page or file on a wiki',
        integrationTypes: [0, 1],
        contexts: [0, 1, 2],
        options: [
            {
                name: 'page',
                description: 'Search for a wiki page',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'wiki',
                        description: 'The wiki to search in',
                        type: 3, // STRING
                        required: true,
                        choices: wikiChoices
                    },
                    {
                        name: 'page',
                        description: 'The page to search for',
                        type: 3, // STRING
                        required: true,
                        autocomplete: true
                    },
                    {
                        name: 'section',
                        description: 'An optional section to search for',
                        type: 3, // STRING
                        required: false,
                        autocomplete: true
                    }
                ]
            },
            {
                name: 'file',
                description: 'Search for a wiki file',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'wiki',
                        description: 'The wiki to search in',
                        type: 3, // STRING
                        required: true,
                        choices: wikiChoices
                    },
                    {
                        name: 'file',
                        description: 'The file to search for',
                        type: 3, // STRING
                        required: true,
                        autocomplete: true
                    }
                ]
            }
        ]
    },
    {
        name: 'user',
        description: 'View a wiki user profile',
        integrationTypes: [0, 1],
        contexts: [0, 1, 2],
        options: [
            { name: 'wiki', description: 'The wiki to search in', type: 3, required: true, choices: wikiChoices },
            { name: 'username', description: 'The wiki username', type: 3, required: true, autocomplete: true }
        ]
    },
    {
        name: 'random',
        description: 'View a random wiki page',
        integrationTypes: [0, 1],
        contexts: [0, 1, 2],
        options: [
            { name: 'wiki', description: 'The wiki to search in', type: 3, required: false, choices: wikiChoices }
        ]
    }
];

module.exports = {
    commands,
    SB64_CATEGORY_IDS,
    SB64_LEVEL_IDS,
    SB64_VARIABLES,
    SB64_DEFAULTS,
    SR_CATEGORY_IDS,
    SR_FILTER_CHOICES,
    SR_VERSION_CHOICES,
    SR_VARIABLES,
    SR_DEFAULTS
};
