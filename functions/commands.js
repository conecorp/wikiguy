const { WIKIS } = require("../config.js");

const wikiChoices = Object.entries(WIKIS).map(([key, wiki]) => ({
    name: wiki.name,
    value: key
}));

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
                        choices: [
                            { name: 'Any%', value: 'z27jz052' },
                            { name: '100%', value: 'jdzzxgxd' },
                            { name: '122%', value: '8244zv32' },
                            { name: 'W1 Hub + Breezy Plains', value: '920j3n7d' },
                            { name: 'W2 Hub + Sunshine Beach', value: '9vmyj5q9' },
                            { name: 'W3 Hub + Sodacan Canyon', value: 'd406nrq9' },
                            { name: 'W4 Hub + Freezy Fields', value: 'd0k0l3m9' },
                            { name: 'W5 Hub + Mechanical Museum', value: 'w6qvrepd' },
                            { name: 'Starburst Galaxy', value: '93q08m2w' },
                            { name: 'All Deluxe Challenges', value: '9gy3mxk9' }
                        ]
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
                        choices: [
                            { name: 'All Maps!', value: 'rkl63l6k' },
                            { name: 'Individual Levels (Recode)', value: '9d8qwwwd' },
                            { name: 'Individual Levels (Legacy)', value: 'xd1yxxzd' }
                        ]
                    },
                    {
                        name: 'level',
                        description: 'The level to view (for Individual Levels)',
                        type: 3, // STRING
                        required: false,
                        choices: [
                            { name: 'Abandoned Lab', value: 'wkkp8rvw' },
                            { name: 'Bedroom', value: 'wp7q8kzw' },
                            { name: 'Flooded City', value: 'we28mkrw' },
                            { name: 'Jungle Underpass', value: 'w6qojrgd' },
                            { name: 'Lucid Lane', value: 'wlg7pxr9' },
                            { name: 'Magma Bomb Blitz', value: 'd1j54v6d' },
                            { name: 'Marble Mania', value: 'dqz7o61d' },
                            { name: 'Midnight Rush', value: 'dqz1n61d' },
                            { name: 'Retro Raceway', value: '9zp4noow' },
                            { name: 'Sky-High Ropeway', value: '9m5j40ld' },
                            { name: 'Slime Factory', value: 'd7y326vd' },
                            { name: 'Sodacan Canyon', value: 'wo723gy9' },
                            { name: 'Space Station', value: 'wj7evozw' },
                            { name: 'Sunset Oasis', value: 'd1j78n5d' },
                            { name: 'Surfer\'s Paradise', value: '95k8mvj9' },
                            { name: 'Sweet Speedway', value: '9gy37kk9' },
                            { name: 'Underwater Highway', value: '9x1lxm1d' },
                            { name: 'Winter Wonderland', value: '9gy3vpj9' },
                            { name: '(Lobby) Easy Section', value: 'wj75z50w' },
                            { name: '(Lobby) Medium Section', value: 'wo7060j9' },
                            { name: '(Lobby) Hard Section', value: 'd1j727zd' }
                        ]
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

module.exports = { commands };
