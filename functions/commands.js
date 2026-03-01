const { WIKIS } = require("../config.js");

const wikiChoices = Object.entries(WIKIS).map(([key, wiki]) => ({
    name: wiki.name,
    value: key
}));

const SB64_CATEGORY_IDS = {
    ANY_PERCENT: 'z27jz052',
    HUNDRED_PERCENT: 'jdzzxgxd',
    HUNDRED_TWENTY_TWO_PERCENT: '8244zv32',
    W1_HUB: '920j3n7d',
    W2_HUB: '9vmyj5q9',
    W3_HUB: 'd406nrq9',
    W4_HUB: 'd0k0l3m9',
    W5_HUB: 'w6qvrepd',
    STARBURST_GALAXY: '93q08m2w',
    ALL_DELUXE: '9gy3mxk9'
};

const SB64_CATEGORIES = [
    { name: 'Any%', value: SB64_CATEGORY_IDS.ANY_PERCENT },
    { name: '100%', value: SB64_CATEGORY_IDS.HUNDRED_PERCENT },
    { name: '122%', value: SB64_CATEGORY_IDS.HUNDRED_TWENTY_TWO_PERCENT },
    { name: 'W1 Hub + Breezy Plains', value: SB64_CATEGORY_IDS.W1_HUB },
    { name: 'W2 Hub + Sunshine Beach', value: SB64_CATEGORY_IDS.W2_HUB },
    { name: 'W3 Hub + Sodacan Canyon', value: SB64_CATEGORY_IDS.W3_HUB },
    { name: 'W4 Hub + Freezy Fields', value: SB64_CATEGORY_IDS.W4_HUB },
    { name: 'W5 Hub + Mechanical Museum', value: SB64_CATEGORY_IDS.W5_HUB },
    { name: 'Starburst Galaxy', value: SB64_CATEGORY_IDS.STARBURST_GALAXY },
    { name: 'All deluxe challenges', value: SB64_CATEGORY_IDS.ALL_DELUXE }
];

const SB64_VARIABLES = {
    CHARACTER: 'ylqxg938',
    GLITCHES: 'gnx6d06n'
};

const SB64_CHARACTER_CHOICES = [
    { name: 'Bloxxer', value: 'q65xzdvl' },
    { name: 'Bloxera', value: 'qj74x37q' },
    { name: 'Both', value: '10v9vdjl' }
];

const SB64_GLITCHES_CHOICES = [
    { name: 'Glitchless', value: 'lmo4g581' },
    { name: 'NMG', value: '1w4d5ymq' },
    { name: 'Glitches', value: 'qox3r45q' }
];

const SR_CATEGORY_IDS = {
    ALL_MAPS: 'rkl63l6k',
    INDIVIDUAL_LEVELS_RECODE: '9d8qwwwd',
    INDIVIDUAL_LEVELS_LEGACY: 'xd1yxxzd'
};

const SR_CATEGORIES = [
    { name: 'All maps', value: SR_CATEGORY_IDS.ALL_MAPS },
    { name: 'Individual Recode maps', value: SR_CATEGORY_IDS.INDIVIDUAL_LEVELS_RECODE },
    { name: 'Individual pre-rewrite maps', value: SR_CATEGORY_IDS.INDIVIDUAL_LEVELS_LEGACY }
];

const SR_LEVEL_IDS = {
    ABANDONED_LAB: 'wkkp8rvw',
    BEDROOM: 'wp7q8kzw',
    FLOODED_CITY: 'we28mkrw',
    JUNGLE_UNDERPASS: 'w6qojrgd',
    LUCID_LANE: 'wlg7pxr9',
    MAGMA_BOMB_BLITZ: 'd1j54v6d',
    MARBLE_MANIA: 'dqz7o61d',
    MIDNIGHT_RUSH: 'dqz1n61d',
    RETRO_RACEWAY: '9zp4noow',
    SKY_HIGH_ROPEWAY: '9m5j40ld',
    SLIME_FACTORY: 'd7y326vd',
    SODACAN_CANYON: 'wo723gy9',
    SPACE_STATION: 'wj7evozw',
    SUNSET_OASIS: 'd1j78n5d',
    SURFERS_PARADISE: '95k8mvj9',
    SWEET_SPEEDWAY: '9gy37kk9',
    UNDERWATER_HIGHWAY: '9x1lxm1d',
    WINTER_WONDERLAND: '9gy3vpj9',
    LOBBY_EASY: 'wj75z50w',
    LOBBY_MEDIUM: 'wo7060j9',
    LOBBY_HARD: 'd1j727zd'
};

const SR_LEVELS = [
    { name: 'Abandoned Lab', value: SR_LEVEL_IDS.ABANDONED_LAB },
    { name: 'Bedroom', value: SR_LEVEL_IDS.BEDROOM },
    { name: 'Flooded City', value: SR_LEVEL_IDS.FLOODED_CITY },
    { name: 'Jungle Underpass', value: SR_LEVEL_IDS.JUNGLE_UNDERPASS },
    { name: 'Lucid Lane', value: SR_LEVEL_IDS.LUCID_LANE },
    { name: 'Magma Bomb Blitz', value: SR_LEVEL_IDS.MAGMA_BOMB_BLITZ },
    { name: 'Marble Mania', value: SR_LEVEL_IDS.MARBLE_MANIA },
    { name: 'Midnight Rush', value: SR_LEVEL_IDS.MIDNIGHT_RUSH },
    { name: 'Retro Raceway', value: SR_LEVEL_IDS.RETRO_RACEWAY },
    { name: 'Sky-High Ropeway', value: SR_LEVEL_IDS.SKY_HIGH_ROPEWAY },
    { name: 'Slime Factory', value: SR_LEVEL_IDS.SLIME_FACTORY },
    { name: 'Sodacan Canyon', value: SR_LEVEL_IDS.SODACAN_CANYON },
    { name: 'Space Station', value: SR_LEVEL_IDS.SPACE_STATION },
    { name: 'Sunset Oasis', value: SR_LEVEL_IDS.SUNSET_OASIS },
    { name: "Surfer's Paradise", value: SR_LEVEL_IDS.SURFERS_PARADISE },
    { name: 'Sweet Speedway', value: SR_LEVEL_IDS.SWEET_SPEEDWAY },
    { name: 'Underwater Highway', value: SR_LEVEL_IDS.UNDERWATER_HIGHWAY },
    { name: 'Winter Wonderland', value: SR_LEVEL_IDS.WINTER_WONDERLAND },
    { name: 'Lobby Easy Time Trial', value: SR_LEVEL_IDS.LOBBY_EASY },
    { name: 'Lobby Medium Time Trial', value: SR_LEVEL_IDS.LOBBY_MEDIUM },
    { name: 'Lobby Hard Time Trial', value: SR_LEVEL_IDS.LOBBY_HARD }
];

const SR_VARIABLES = {
    EVENTS: 'p85y11vl'
};

const SR_EVENTS_CHOICES = [
    { name: 'No Events', value: 'qkem56nq' },
    { name: 'Raised Speed Cap', value: 'q75rpkv1' },
    { name: 'Low Gravity', value: 'qoxd952q' },
    { name: 'RSC + LG', value: 'qyzog9d1' }
];

const commands = [
    {
        name: 'lb',
        description: 'View leaderboards',
        options: [
            {
                name: 'sb64',
                description: 'Super Blox 64 Leaderboard',
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
                        type: 3, // STRING
                        required: false,
                        choices: SB64_GLITCHES_CHOICES
                    }
                ]
            },
            {
                name: 'sr',
                description: 'Superstar Racers Leaderboard',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'category',
                        description: 'The category to view',
                        type: 3, // STRING
                        required: true,
                        choices: SR_CATEGORIES
                    },
                    {
                        name: 'level',
                        description: 'The level to view (only works with Individual Levels categories)',
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
                name: 'contribs',
                description: 'Get contribution scores for a wiki',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'wiki',
                        description: 'The wiki to get scores from',
                        type: 3, // STRING
                        required: true,
                        choices: wikiChoices
                    }
                ]
            }
        ]
    },
    {
        name: 'wiki',
        description: 'Get a link to a wiki',
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
    }
];

module.exports = {
    commands,
    SB64_VARIABLES,
    SR_VARIABLES
};
