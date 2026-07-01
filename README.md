# 🎯 Meme Arena — Discord Bot

A modern, competitive meme platform for Discord communities. Users submit memes, the community votes, and winners earn points to climb the leaderboard.

## Features

### 🎪 Meme Arena (Competitive)
- **`/submit`** — Submit your meme for review (images, GIFs, videos)
- **Admin Review** — Mods approve/reject submissions in a private channel
- **🗳️ 24-Hour Voting** — Each approved meme gets 24h of voting
- **😂🔥❤️ Voting** — Three vote types: Funny, Legendary, Like
- **🏆 Winner System** — Every 24h, winners earn points automatically

### 👑 Progression
- **`/profile`** — View your arena stats, rank, points, and wins
- **`/leaderboard`** — Top memers ranked by points
- **`/mymemes`** — Browse your personal submission history

### 📊 Community
- **`/meme [category]** — Browse random arena memes
- **`/stats`** — Server-wide arena statistics
- **`/topmemes`** — Top voted memes of all time
- **`/topcreators`** — Best meme creators by score

### ⚙️ Admin
- **`/config set-meme-channel`** — Set the public arena channel
- **`/config set-review-channel`** — Set the mod review channel
- **`/config show`** — View current config

## Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/submit` | Submit a meme to the arena | Everyone |
| `/profile [user]` | View arena profile | Everyone |
| `/mymemes` | View your submissions | Everyone |
| `/leaderboard` | View top memers | Everyone |
| `/stats` | Server arena statistics | Everyone |
| `/help` | How to use the bot | Everyone |
| `/meme [category]` | Browse memes | Everyone |
| `/pending-memes` | Review submissions | Moderator |
| `/config` | Bot configuration | Administrator |

## Point System

- 😂 **Funny** = 1 pt
- 🔥 **Legendary** = 3 pts
- ❤️ **Like** = 2 pts
- 🏆 **Winner** = +1 point to creator every 24h

## Installation

### Prerequisites
- Node.js 20+
- Discord Bot with appropriate intents

### Setup
```bash
npm install
cp .env.example .env  # Edit with your bot token
npm run deploy:commands
npm run dev            # Development
```

### Docker
```bash
docker-compose up -d
```

## Tech Stack
- Discord.js v14
- TypeScript
- JSON file-based storage
- Winston logging
- i18n (English/Arabic)
