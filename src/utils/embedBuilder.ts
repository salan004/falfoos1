import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { Question, ParticipantData } from '../types/quiz';
import { LETTER_LABELS, getCorrectAnswerLabel, getQuestionOptions, ANSWER_LETTERS } from './quizHelpers';

export function buildActiveQuizEmbed(
  question: Question,
  questionNumber: number,
  totalQuestions: number,
  remainingSeconds: number,
  totalRegistered: number,
): EmbedBuilder {
  const difficultyStars = '⭐'.repeat(question.difficulty);
  const options = getQuestionOptions(question);

  return new EmbedBuilder()
    .setColor('#1a7c3a' as ColorResolvable)
    .setTitle(`📖 ${question.categoryNameAr || 'مسابقة إسلامية'}`)
    .setDescription(
      `**السؤال ${questionNumber}/${totalQuestions}** | ${difficultyStars}\n\n` +
      `> ${question.questionAr}\n\n` +
      `**⏱ الوقت المتبقي: ${remainingSeconds}ث**\n\n` +
      `**${LETTER_LABELS.A}** ─ ${options.A}\n` +
      `**${LETTER_LABELS.B}** ─ ${options.B}\n` +
      `**${LETTER_LABELS.C}** ─ ${options.C}\n` +
      `**${LETTER_LABELS.D}** ─ ${options.D}\n\n` +
      `👥 **المسجلون:** ${totalRegistered}\n\n` +
      'صوّت باستخدام الاستطلاع أدناه للإجابة.\n' +
      '⚠️ فقط المسجلون تحتسب أصواتهم.',
    )
    .setFooter({ text: 'صوّت في الاستطلاع • إجابة واحدة فقط' })
    .setTimestamp();
}

export function buildQuizRevealEmbed(
  question: Question,
  questionNumber: number,
  totalQuestions: number,
  durationMs: number,
  winnerIds: string[],
  totalRegistered: number,
): EmbedBuilder {
  const difficultyStars = '⭐'.repeat(question.difficulty);
  const correctLabel = getCorrectAnswerLabel(question);
  const correctLetter = LETTER_LABELS[question.correctAnswer];
  const durationSeconds = Math.max(1, Math.round(durationMs / 1000));

  const winnersSection = winnerIds.length > 0
    ? winnerIds.map(id => `• <@${id}>`).join('\n')
    : 'لم يجب أحد بشكل صحيح هذه المرة.';

  const explanationLine = question.source
    ? `\n📖 **الشرح:** ${question.source}\n`
    : '';

  return new EmbedBuilder()
    .setColor('#f5a623' as ColorResolvable)
    .setTitle(`📖 ${question.categoryNameAr || 'مسابقة إسلامية'} — النتيجة`)
    .setDescription(
      `**السؤال ${questionNumber}/${totalQuestions}** | ${difficultyStars}\n\n` +
      `> ${question.questionAr}\n\n` +
      `✅ **الإجابة الصحيحة:** ${correctLetter} ─ ${correctLabel}\n` +
      explanationLine +
      `⏱ **مدة السؤال:** ${durationSeconds}ث\n` +
      `👥 **المسجلون:** ${totalRegistered}\n\n` +
      `🏆 **الإجابات الصحيحة**\n${winnersSection}`,
    )
    .setTimestamp();
}

export function buildFinalResultsEmbed(
  totalQuestions: number,
  correctCount: number,
  wrongCount: number,
  skippedCount: number,
  pointsEarned: number,
  coinsEarned: number,
  level: number,
  nextLevelPoints: number,
  levelUp: boolean,
  topParticipants: ParticipantData[],
  positions: Map<string, number>,
  totalParticipants: number,
  accuracyRate: number,
  quizDuration: number,
  winnerAvatarUrl: string = '',
): EmbedBuilder {
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const topLines: string[] = [];
  const positionEmojis: Record<number, string> = { 1: '🥇👑', 2: '🥈', 3: '🥉' };

  for (const p of topParticipants) {
    const pos = positions.get(p.userId) || 0;
    const emoji = positionEmojis[pos] || `${pos}.`;
    const pTotal = p.correctCount + p.wrongCount;
    const pAcc = pTotal > 0 ? Math.round((p.correctCount / pTotal) * 100) : 0;
    topLines.push(
      `${emoji} **<@${p.userId}>** — ✅${p.correctCount} ❌${p.wrongCount} 🎯+${p.pointsEarned} (${pAcc}%)`,
    );
  }

  const participantsSection = topLines.length > 0 ? topLines.join('\n') : 'لا يوجد مشاركون';

  const description = [
    `━━━━━━━━━━━━━━━━━━\n`,
    participantsSection,
    `\n━━━━━━━━━━━━━━━━━━`,
    `📊 **نتائجك:** ✅ ${correctCount}/${totalQuestions} | ❌ ${wrongCount} | ⏭ ${skippedCount}`,
    `👥 **المشاركون:** ${totalParticipants} | 🎯 **الدقة:** ${accuracyRate}% | ⏱ **المدة:** ${Math.floor(quizDuration / 60)}:${(quizDuration % 60).toString().padStart(2, '0')}`,
    `━━━━━━━━━━━━━━━━━━`,
    `**نقاطك:** +${pointsEarned} 🎯`,
    `**المستوى:** ${level} 📈`,
    levelUp ? '🎉 **تهانينا! لقد ارتفع مستواك!**' : '',
  ].filter(Boolean).join('\n');

  const embed = new EmbedBuilder()
    .setColor(levelUp ? '#ffd700' : '#1a7c3a' as ColorResolvable)
    .setTitle('🏆 نتائج المسابقة')
    .setDescription(description)
    .setTimestamp();

  if (winnerAvatarUrl) {
    embed.setThumbnail(winnerAvatarUrl);
  }

  return embed;
}

export function buildLeaderboardEmbed(
  entries: { rank: number; username: string; points: number; level: number; correctAnswers: number; wrongAnswers: number; firstPlace: number }[],
  page: number,
  totalPages: number,
): EmbedBuilder {
  const medals: Record<number, string> = { 1: '🥇👑', 2: '🥈', 3: '🥉' };

  const lines = entries.map(e => {
    const medal = medals[e.rank] || `${e.rank}.`;
    const total = e.correctAnswers + e.wrongAnswers;
    const acc = total > 0 ? Math.round((e.correctAnswers / total) * 100) : 0;
    return `${medal} **${e.username}** — ${e.points} نقطة | دقة ${acc}% | ${e.firstPlace} فوز`;
  });

  return new EmbedBuilder()
    .setColor('#1a7c3a' as ColorResolvable)
    .setTitle('🏆 قائمة المتصدرين')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `الصفحة ${page}/${totalPages}` })
    .setTimestamp();
}

export function buildProfileEmbed(data: {
  username: string;
  points: number;
  coins: number;
  level: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalQuizzes: number;
  nextLevelPoints: number;
  rank?: number;
  currentStreak: number;
  bestStreak: number;
  firstPlace: number;
  secondPlace: number;
  thirdPlace: number;
  totalWins: number;
}): EmbedBuilder {
  const total = data.correctAnswers + data.wrongAnswers;
  const accuracy = total > 0 ? Math.round((data.correctAnswers / total) * 100) : 0;
  const top3 = data.firstPlace + data.secondPlace + data.thirdPlace;
  const rankLine = data.rank ? `**الترتيب:** #${data.rank}\n` : '';

  const crownPrefix = data.rank && data.rank === 1 ? '👑 ' : '';

  return new EmbedBuilder()
    .setColor('#1a7c3a' as ColorResolvable)
    .setTitle(`📊 إحصائيات ${crownPrefix}${data.username}`)
    .setDescription(
      rankLine +
      `**المستوى:** ${data.level} 📈\n` +
      `**النقاط:** ${data.points} 🎯\n` +
      `**النقاط للمستوى التالي:** ${data.nextLevelPoints}\n\n` +
      `**✅ الإجابات الصحيحة:** ${data.correctAnswers}\n` +
      `**❌ الإجابات الخاطئة:** ${data.wrongAnswers}\n` +
      `**📈 نسبة النجاح:** ${accuracy}%\n` +
      `**🎮 عدد المسابقات:** ${data.totalQuizzes}\n\n` +
      `**🔥 السلسلة الحالية:** ${data.currentStreak}\n` +
      `**⭐ أفضل سلسلة:** ${data.bestStreak}\n\n` +
      `**🥇 المركز الأول:** ${data.firstPlace}\n` +
      `**🥈 المركز الثاني:** ${data.secondPlace}\n` +
      `**🥉 المركز الثالث:** ${data.thirdPlace}\n` +
      `**🏆 إجمالي الفوز:** ${data.totalWins}`,
    )
    .setTimestamp();
}

export function buildRegistrationEmbed(
  remainingSeconds: number,
  registeredCount: number,
  endTimestamp: number,
  registeredUsers: Set<string> = new Set(),
): EmbedBuilder {
  const membersList = registeredUsers.size > 0
    ? Array.from(registeredUsers).map(id => `• <@${id}>`).join('\n')
    : 'لا يوجد مسجلين بعد.';

  return new EmbedBuilder()
    .setColor('#1a7c3a' as ColorResolvable)
    .setTitle('📖 بدأت المسابقة الدينية')
    .setDescription(
      '⏳ بدأ تسجيل المتسابقين.\n\n' +
      `⌛ **الوقت المتبقي:** <t:${endTimestamp}:R>\n` +
      `　　（${remainingSeconds} ثانية）\n\n` +
      `👥 **عدد المسجلين:** ${registeredCount}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `**المسجلون:**\n${membersList}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ **الحد الأدنى:** 2 متسابقين\n\n` +
      'اضغط على زر **انضمام** للمشاركة.',
    )
    .setFooter({ text: 'سيبدأ الاختبار تلقائياً بعد انتهاء التسجيل' })
    .setTimestamp();
}

export function buildQuestionResultsEmbed(
  question: Question,
  questionNumber: number,
  totalQuestions: number,
  winnerIds: string[],
  totalVoters: number,
  totalRegistered: number,
): EmbedBuilder {
  const correctLabel = getCorrectAnswerLabel(question);
  const options = getQuestionOptions(question);

  const correctLetterAr = LETTER_LABELS[question.correctAnswer];

  const optionsLines = ANSWER_LETTERS.map(letter => {
    const label = options[letter];
    if (letter === question.correctAnswer) {
      return `✅ **${LETTER_LABELS[letter]}** ─ ~~${label}~~ **(الإجابة الصحيحة)**`;
    }
    return `❌ ~~**${LETTER_LABELS[letter]}** ─ ${label}~~`;
  });

  const winnersSection = winnerIds.length > 0
    ? winnerIds.map((id, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        const prefix = i < 3 ? medals[i] : '•';
        return `${prefix} <@${id}>`;
      }).join('\n')
    : '❌ لم يجب أحد بشكل صحيح.';

  const correctCount = winnerIds.length;

  return new EmbedBuilder()
    .setColor('#f5a623' as ColorResolvable)
    .setTitle(`📊 نتائج السؤال ${questionNumber}/${totalQuestions}`)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ **الإجابة الصحيحة:**\n${correctLetterAr} ─ ${correctLabel}\n\n` +
      `${optionsLines.join('\n')}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `👥 **المسجلون في المسابقة:** ${totalRegistered}\n` +
      `👥 **المصوتون في هذا السؤال:** ${totalVoters}\n\n` +
      `🎯 **عدد الإجابات الصحيحة:** ${correctCount}\n\n` +
      `🏆 **الذين أجابوا بشكل صحيح:**\n${winnersSection}\n\n` +
      `━━━━━━━━━━━━━━━━━━`,
    )
    .setFooter({ text: 'استعد للسؤال التالي...' })
    .setTimestamp();
}

export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('#e74c3c' as ColorResolvable)
    .setTitle('⚠️ خطأ')
    .setDescription(message)
    .setTimestamp();
}

export function buildRankEmbed(
  username: string,
  rank: number,
  points: number,
  level: number,
  totalPlayers: number,
): EmbedBuilder {
  const crownPrefix = rank === 1 ? '👑 ' : '';

  return new EmbedBuilder()
    .setColor('#1a7c3a' as ColorResolvable)
    .setTitle(`🏅 ترتيب ${crownPrefix}${username}`)
    .setDescription(
      `**${crownPrefix}${username}** في المرتبة **#${rank}** من **${totalPlayers}** لاعباً.\n\n` +
      `**النقاط:** ${points} 🎯\n` +
      `**المستوى:** ${level} 📈`,
    )
    .setTimestamp();
}
