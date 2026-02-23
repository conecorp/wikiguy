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
        description: 'Get a link to a wiki or search for a page/file',
        options: [
            {
                name: 'wiki',
                description: 'The wiki to link to or search in',
                type: 3, // STRING
                required: true,
                choices: wikiChoices
            },
            {
                name: 'page',
                description: 'Search for a wiki page',
                type: 3, // STRING
                required: false,
                autocomplete: true
            },
            {
                name: 'file',
                description: 'Search for a wiki file (provide only page OR file)',
                type: 3, // STRING
                required: false,
                autocomplete: true
            }
        ]
    }
];

module.exports = { commands };
