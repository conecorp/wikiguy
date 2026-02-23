const { WIKIS } = require("../config.js");

const wikiChoices = Object.entries(WIKIS).map(([key, wiki]) => ({
    name: wiki.name,
    value: key
}));

const commands = [
    {
        name: 'contribscores',
        description: 'Get contribution scores for a wiki',
        options: [
            {
                name: 'wiki',
                description: 'The wiki to get scores from',
                type: 3, // STRING
                required: true,
                choices: wikiChoices
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
