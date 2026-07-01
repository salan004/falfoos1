import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import { UserProfile } from '../types';
import { t } from '../utils/i18n';

const WIDTH = 900;
const HEIGHT = 600;
const BG_COLOR = '#1a1a2e';
const CARD_COLOR = '#16213e';
const ACCENT_COLOR = '#9B59B6';
const GOLD = '#FFD700';
const SILVER = '#C0C0C0';
const BRONZE = '#CD7F32';
const TEXT_COLOR = '#FFFFFF';
const MUTED_COLOR = '#8888AA';

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

export async function generateLeaderboardImage(users: UserProfile[]): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0);
  gradient.addColorStop(0, '#9B59B6');
  gradient.addColorStop(1, '#6C3483');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, 80);

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(t('lbi.title'), WIDTH / 2, 52);

  const startY = 110;
  const cardHeight = 65;
  const cardGap = 10;

  const displayUsers = users.slice(0, 10);

  for (let i = 0; i < displayUsers.length; i++) {
    const user = displayUsers[i];
    const y = startY + i * (cardHeight + cardGap);

    ctx.fillStyle = CARD_COLOR;
    ctx.beginPath();
    ctx.roundRect(30, y, WIDTH - 60, cardHeight, 10);
    ctx.fill();

    const medalX = 60;
    const medalColor = i === 0 ? GOLD : i === 1 ? SILVER : i === 2 ? BRONZE : null;
    if (medalColor) {
      ctx.fillStyle = medalColor;
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(MEDAL_EMOJIS[i], medalX, y + 42);
    } else {
      ctx.fillStyle = MUTED_COLOR;
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`#${i + 1}`, medalX, y + 42);
    }

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';

    const nameX = 110;
    const displayName = user.username || `User ${user.userId.slice(0, 6)}`;
    const truncatedName = displayName.length > 20 ? displayName.slice(0, 18) + '..' : displayName;
    ctx.fillText(truncatedName, nameX, y + 28);

    ctx.fillStyle = MUTED_COLOR;
    ctx.font = '14px Arial';
    ctx.fillText(`${user.totalSubmissions} ${t('lbi.submissions')}`, nameX, y + 52);

    const pointsX = WIDTH - 200;
    ctx.fillStyle = ACCENT_COLOR;
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${user.totalPoints} ${t('lbi.points_abbr')}`, pointsX, y + 30);

    ctx.fillStyle = GOLD;
    ctx.font = '16px Arial';
    ctx.fillText(`${user.totalWins} ${t('lbi.wins_abbr')}`, pointsX, y + 54);

    if (user.achievements && user.achievements.length > 0) {
      const unlocked = user.achievements.filter(a => a.unlockedAt);
      if (unlocked.length > 0) {
        ctx.textAlign = 'left';
        ctx.font = '14px Arial';
        const badgeX = nameX + 250;
        const badges = unlocked.slice(0, 3).map(a => a.emoji).join(' ');
        ctx.fillStyle = MUTED_COLOR;
        ctx.fillText(badges, badgeX, y + 30);
      }
    }
  }

  ctx.fillStyle = MUTED_COLOR;
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(t('lbi.footer'), WIDTH / 2, HEIGHT - 15);

  return canvas.toBuffer('image/png');
}
