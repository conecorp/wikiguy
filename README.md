<p align="center">
  <img src="https://files.catbox.moe/bbp2yn.png" width="500" alt="banner">
</p>

<h3 align="center">the all-in-one bot for <a href="https://conecorp.cc">CONECORP</a> wikis</h3>

<p align="center">
  <a href="https://discord.com/oauth2/authorize?client_id=1472272697798037524">Add to server</a>
</p>

## Setup

### Requirements

- Node.js 17.3 or newer
- A Discord application and bot token from the [Discord Developer Portal](https://discord.com/developers/applications)

### Installation

1. Clone the repository and enter its directory:

   ```bash
   git clone https://github.com/conecorpwiki/wikiguy.git
   cd wikiguy
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Create your environment file from the example:

   ```bash
   cp .env.example .env
   ```

4. Open `.env` and replace `your_discord_token_here` with the bot token from the Discord Developer Portal. The web server uses port `3000` by default; set `PORT` to a different value if needed.

5. Start the bot:

   ```bash
   npm start
   ```

## Configuration

Most bot behavior is configured in [`config.js`](config.js). Restart the bot after making changes.

- **`WIKIS`** — Define the wikis supported by the bot. Each entry contains the wiki name, MediaWiki API endpoint, article URL, message prefix, and emoji.
- **`WIKI_MAP`** — Map Discord channel or category IDs to a wiki. This controls which wiki is used when a message does not include a wiki prefix.
- **`STATUS_OPTIONS`** — Customize the bot’s rotating Discord status messages and activity types.
- **`STATUS_INTERVAL_MS`** — Set how often the bot rotates its status. The default is five minutes.
- **`COMMANDS`** — Enable or disable individual slash commands. Set a command to `false` to prevent it from being registered with Discord. Available commands are `speedrun`, `contribs`, `wiki`, `parse`, `user`, and `random`.
- **`SPEEDRUN_EMOJI`** and **`CONTRIBSCORES_SCORE_EMOJI`** — Set the custom emoji IDs used by those features.

When adding a wiki, add its configuration to `WIKIS` and update `WIKI_MAP` or the relevant status messages as needed. Discord channel, category, and emoji IDs can be copied using Discord’s Developer Mode.

## Web server and Instatus

`bot/server.js` starts a small web server so Instatus can check whether the bot is active. It listens on `0.0.0.0` and uses the `PORT` value from `.env` (or port `3000` when it is unset). The file is part of the bot’s normal startup through `index.js`; it can be removed if Instatus monitoring is not needed, provided the corresponding `require("./bot/server")` line is also removed from `index.js`.
