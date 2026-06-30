import {
  Collection,
  Message,
  TextChannel,
  Guild,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { config } from '../config';
import { QuizState, AnswerRecord, QuestionRoundState, ParticipantData } from '../types/quiz';
import { getRandomQuestion } from '../database/questions';
import {
  upsertUser,
  getUser,
  incrementUserPlacement,
} from '../database/users';
import { calculateLevel } from './levelService';
import { calculateCoins } from './coinService';
import {
  buildActiveQuizEmbed,
  buildQuizRevealEmbed,
  buildFinalResultsEmbed,
  buildErrorEmbed,
  buildRegistrationEmbed,
  buildQuestionResultsEmbed,
} from '../utils/embedBuilder';
import {
  ANSWER_ID_MAP,
  ANSWER_ID_TO_LETTER,
  LETTER_LABELS,
} from '../utils/quizHelpers';
import {
  execInTransaction,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  queryOne,
  queryAll,
} from '../database/helpers';

const REGISTRATION_DURATION = 30_000;
const DELAY_BETWEEN_QUESTIONS = 5_000;

const activeQuizzes = new Collection<string, QuizState>();
const messageQuizMap = new Collection<string, string>();

function getChannelQuizKey(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

function createRoundState(): QuestionRoundState {
  return {
    votes: new Map(),
    ended: false,
    questionStartedAt: Date.now(),
    timerInterval: null,
    endTimeout: null,
  };
}

function clearRoundTimers(round: QuestionRoundState | null): void {
  if (!round) return;
  if (round.timerInterval) {
    clearInterval(round.timerInterval);
    round.timerInterval = null;
  }
  if (round.endTimeout) {
    clearTimeout(round.endTimeout);
    round.endTimeout = null;
  }
}

function clearRegistrationTimers(quiz: QuizState): void {
  if (!quiz.registration) return;
  if (quiz.registration.timerInterval) {
    clearInterval(quiz.registration.timerInterval);
    quiz.registration.timerInterval = null;
  }
  if (quiz.registration.endTimeout) {
    clearTimeout(quiz.registration.endTimeout);
    quiz.registration.endTimeout = null;
  }
}

export function isQuizActiveInChannel(guildId: string, channelId: string): boolean {
  const quiz = activeQuizzes.get(getChannelQuizKey(guildId, channelId));
  return quiz !== undefined && (quiz.status === 'active' || quiz.registration !== null);
}

export function getActiveQuizByChannel(guildId: string, channelId: string): QuizState | undefined {
  return activeQuizzes.get(getChannelQuizKey(guildId, channelId));
}

export function getQuizByMessageId(messageId: string): QuizState | undefined {
  const key = messageQuizMap.get(messageId);
  return key ? activeQuizzes.get(key) : undefined;
}

export async function startQuiz(
  channel: TextChannel,
  userId: string,
  totalQuestions: number = 5,
  categoryId?: number,
): Promise<void> {
  const guildId = channel.guildId;
  const key = getChannelQuizKey(guildId, channel.id);

  if (isQuizActiveInChannel(guildId, channel.id)) {
    await channel.send({
      embeds: [buildErrorEmbed('يوجد اختبار نشط بالفعل في هذه القناة.')],
    });
    return;
  }

  totalQuestions = Math.min(totalQuestions, config.maxQuestionsPerQuiz);
  const questions: QuizState['questions'] = [];

  for (let i = 0; i < totalQuestions; i++) {
    const q = getRandomQuestion(categoryId);
    if (q && !questions.find(ex => ex.id === q.id)) {
      questions.push(q);
    }
  }

  if (questions.length === 0) {
    await channel.send({ embeds: [buildErrorEmbed('لا توجد أسئلة متاحة حالياً.')] });
    return;
  }

  const startUser = getUser(userId, guildId);

  const quizState: QuizState = {
    guildId,
    channelId: channel.id,
    userId,
    questions,
    currentIndex: 0,
    totalQuestions: questions.length,
    answers: [],
    startTime: Date.now(),
    status: 'active',
    messageId: null,
    sessionId: null,
    pointsEarned: 0,
    coinsEarned: 0,
    round: null,
    registration: {
      messageId: null,
      registeredUsers: new Set<string>(),
      timerInterval: null,
      endTimeout: null,
    },
    totalRegistered: 0,
    registeredUsers: new Set<string>(),
    participants: new Map(),
    preQuizUserSnapshot: startUser
      ? {
          points: startUser.points,
          coins: startUser.coins,
          level: startUser.level,
          correct_answers: startUser.correct_answers,
          wrong_answers: startUser.wrong_answers,
          current_streak: startUser.current_streak || 0,
        }
      : null,
  };

  activeQuizzes.set(key, quizState);
  await startRegistrationPhase(channel, quizState);
}

async function startRegistrationPhase(channel: TextChannel, quizState: QuizState): Promise<void> {
  const endTimestamp = Math.floor((Date.now() + REGISTRATION_DURATION) / 1000);

  const joinButton = new ButtonBuilder()
    .setCustomId('quiz_join')
    .setLabel('انضمام')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton);

  let message: Message;
  try {
    message = await channel.send({
      embeds: [buildRegistrationEmbed(30, 0, endTimestamp, quizState.registration?.registeredUsers || new Set())],
      components: [row],
    });
  } catch (err) {
    console.error('[REGISTRATION ERROR] Failed to send registration message:', err);
    await channel.send({
      embeds: [buildErrorEmbed('فشل في بدء التسجيل. تأكد من صلاحيات البوت.')],
    });
    activeQuizzes.delete(getChannelQuizKey(quizState.guildId, quizState.channelId));
    return;
  }

  if (!quizState.registration) return;
  quizState.registration.messageId = message.id;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: i => i.customId === 'quiz_join',
    time: REGISTRATION_DURATION,
  });

  collector.on('collect', async i => {
    if (!quizState.registration) return;

    if (quizState.registration.registeredUsers.has(i.user.id)) {
      await i.reply({
        content: '✅ أنت مسجل بالفعل في المسابقة!',
        ephemeral: true,
      });
      return;
    }

    quizState.registration.registeredUsers.add(i.user.id);

    const count = quizState.registration.registeredUsers.size;
    const remainingSeconds = Math.max(0, Math.ceil((REGISTRATION_DURATION - (Date.now() - quizState.startTime)) / 1000));

    try {
      await message.edit({
        embeds: [buildRegistrationEmbed(remainingSeconds, count, endTimestamp, quizState.registration.registeredUsers)],
        components: [row],
      });
    } catch { /* ignore */ }

    await i.reply({
      content: `✅ تم تسجيلك في المسابقة! عدد المسجلين: ${count}`,
      ephemeral: true,
    });
  });

  collector.on('end', async () => {
    try {
      await message.edit({ components: [] });
    } catch { /* ignore */ }
  });

  let remainingSeconds = 30;
  quizState.registration.timerInterval = setInterval(async () => {
    remainingSeconds--;
    if (remainingSeconds <= 0 || !quizState.registration) {
      if (quizState.registration?.timerInterval) {
        clearInterval(quizState.registration.timerInterval);
        quizState.registration.timerInterval = null;
      }
      return;
    }

    try {
      await message.edit({
        embeds: [buildRegistrationEmbed(remainingSeconds, quizState.registration.registeredUsers.size, endTimestamp, quizState.registration.registeredUsers)],
        components: [row],
      });
    } catch {
      clearRegistrationTimers(quizState);
    }
  }, 1000);

  quizState.registration.endTimeout = setTimeout(async () => {
    clearRegistrationTimers(quizState);
    await endRegistrationPhase(channel, quizState);
  }, REGISTRATION_DURATION);
}

async function endRegistrationPhase(channel: TextChannel, quizState: QuizState): Promise<void> {
  const registeredCount = quizState.registration?.registeredUsers.size || 0;

  if (quizState.registration?.messageId) {
    try {
      const msg = await channel.messages.fetch(quizState.registration.messageId).catch(() => null);
      if (msg) {
        await msg.edit({ components: [] });
      }
    } catch { /* ignore */ }
  }

  if (quizState.registration) {
    quizState.registeredUsers = quizState.registration.registeredUsers;
    quizState.totalRegistered = quizState.registration.registeredUsers.size;
  }
  quizState.registration = null;

  if (registeredCount < 2) {
    await channel.send('❌ تم إلغاء المسابقة لعدم اكتمال الحد الأدنى من المشاركين.');
    activeQuizzes.delete(getChannelQuizKey(quizState.guildId, quizState.channelId));
    return;
  }

  await sendNextQuestion(channel, quizState);
}

export async function skipCurrentQuestion(channel: TextChannel, requesterId: string): Promise<boolean> {
  const quiz = getActiveQuizByChannel(channel.guildId, channel.id);
  if (!quiz || quiz.status !== 'active') {
    return false;
  }

  if (requesterId !== quiz.userId) {
    const requester = await channel.guild.members.fetch(requesterId).catch(() => null);
    if (!requester?.permissions.has('Administrator')) {
      return false;
    }
  }

  if (!quiz.round || quiz.round.ended) {
    return false;
  }

  await endQuestionRound(channel, quiz, 'skipped');
  return true;
}

async function sendNextQuestion(channel: TextChannel, quizState: QuizState): Promise<void> {
  if (quizState.currentIndex >= quizState.questions.length) {
    await finishQuiz(channel, quizState);
    return;
  }

  const question = quizState.questions[quizState.currentIndex];
  const totalSeconds = Math.floor(config.quizTimeLimit / 1000);
  const round = createRoundState();
  quizState.round = round;
  round.questionStartedAt = Date.now();

  const buttonRows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...(['A', 'B'] as const).map(letter =>
        new ButtonBuilder()
          .setCustomId(`ans_${letter}_q${quizState.currentIndex}`)
          .setLabel(LETTER_LABELS[letter])
          .setStyle(ButtonStyle.Primary),
      ),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...(['C', 'D'] as const).map(letter =>
        new ButtonBuilder()
          .setCustomId(`ans_${letter}_q${quizState.currentIndex}`)
          .setLabel(LETTER_LABELS[letter])
          .setStyle(ButtonStyle.Primary),
      ),
    ),
  ];

  let message: Message;
  try {
    message = await channel.send({
      embeds: [buildActiveQuizEmbed(question, quizState.currentIndex + 1, quizState.totalQuestions, totalSeconds, quizState.totalRegistered)],
      components: buttonRows,
    });
  } catch (err) {
    console.error('[QUIZ ERROR] Failed to send question message:', err);
    await channel.send({
      embeds: [buildErrorEmbed('فشل في بدء الاختبار. تأكد من صلاحيات البوت.')],
    });
    activeQuizzes.delete(getChannelQuizKey(quizState.guildId, quizState.channelId));
    return;
  }

  quizState.messageId = message.id;
  messageQuizMap.set(message.id, getChannelQuizKey(quizState.guildId, quizState.channelId));

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: i => i.customId.startsWith('ans_') && i.customId.endsWith(`_q${quizState.currentIndex}`),
    time: config.quizTimeLimit,
  });

  collector.on('collect', async i => {
    if (round.ended) return;

    const letter = i.customId.split('_')[1] as 'A' | 'B' | 'C' | 'D';

    round.votes.set(i.user.id, {
      answerId: ANSWER_ID_MAP[letter],
      votedAt: Date.now(),
    });

    await i.reply({
      content: `✅ تم تسجيل إجابتك: ${LETTER_LABELS[letter]}`,
      ephemeral: true,
    });
  });

  collector.on('end', () => {
    if (!round.ended) {
      endQuestionRound(channel, quizState, 'timeout');
    }
  });

  let remainingSeconds = totalSeconds;

  round.timerInterval = setInterval(async () => {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      clearRoundTimers(round);
      return;
    }

    try {
      await message.edit({
        embeds: [buildActiveQuizEmbed(question, quizState.currentIndex + 1, quizState.totalQuestions, remainingSeconds, quizState.totalRegistered)],
      });
    } catch {
      clearRoundTimers(round);
    }
  }, 1000);

  round.endTimeout = setTimeout(async () => {
    if (!round.ended) {
      await endQuestionRound(channel, quizState, 'timeout');
    }
  }, config.quizTimeLimit);
}

async function endQuestionRound(
  channel: TextChannel,
  quizState: QuizState,
  reason: 'timeout' | 'skipped',
): Promise<void> {
  const round = quizState.round;
  if (!round || round.ended) return;

  round.ended = true;
  clearRoundTimers(round);

  const question = quizState.questions[quizState.currentIndex];
  const questionIndex = quizState.currentIndex;
  const durationMs = Date.now() - round.questionStartedAt;
  const correctAnswerId = ANSWER_ID_MAP[question.correctAnswer];
  const deadline = round.questionStartedAt + config.quizTimeLimit;

  const winnerIds = getCorrectVoters(round, correctAnswerId, deadline, quizState.registeredUsers);

  await recordRoundResults(quizState, question, round, winnerIds, channel.guild);

  const starterVote = round.votes.get(quizState.userId);
  const starterAnswer = starterVote ? ANSWER_ID_TO_LETTER[starterVote.answerId] : null;
  const starterCorrect = starterAnswer === question.correctAnswer;

  quizState.answers[questionIndex] = {
    answer: starterAnswer,
    isCorrect: starterCorrect,
    time: starterVote ? starterVote.votedAt - round.questionStartedAt : config.quizTimeLimit,
    status: starterVote ? 'answered' : 'skipped',
  };

  const totalVoters = round.votes.size;

  const disabledRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(['A', 'B'] as const).map(letter =>
      new ButtonBuilder()
        .setCustomId(`ans_${letter}_q${quizState.currentIndex}`)
        .setLabel(LETTER_LABELS[letter])
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    ),
  );
  const disabledRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(['C', 'D'] as const).map(letter =>
      new ButtonBuilder()
        .setCustomId(`ans_${letter}_q${quizState.currentIndex}`)
        .setLabel(LETTER_LABELS[letter])
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    ),
  );

  if (quizState.messageId) {
    try {
      const msg = await channel.messages.fetch(quizState.messageId).catch(() => null);
      if (msg) {
        await msg.edit({
          embeds: [
            buildQuizRevealEmbed(
              question,
              quizState.currentIndex + 1,
              quizState.totalQuestions,
              durationMs,
              winnerIds,
              quizState.totalRegistered,
            ),
          ],
          components: [disabledRow1, disabledRow2],
        });
      }
    } catch (err) {
      console.error('[QUIZ ERROR] Failed to update quiz message:', err);
    }
  }

  try {
    await channel.send({
      embeds: [buildQuestionResultsEmbed(
        question,
        quizState.currentIndex + 1,
        quizState.totalQuestions,
        winnerIds,
        totalVoters,
        quizState.totalRegistered,
      )],
    });
  } catch (err) {
    console.error('[QUIZ ERROR] Failed to send results embed:', err);
  }

  if (quizState.messageId) {
    messageQuizMap.delete(quizState.messageId);
  }
  quizState.messageId = null;
  quizState.round = null;
  quizState.currentIndex++;

  await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_QUESTIONS));

  await sendNextQuestion(channel, quizState);
}

function getCorrectVoters(
  round: QuestionRoundState,
  correctAnswerId: number,
  deadline: number,
  registeredUsers: Set<string>,
): string[] {
  const winners: string[] = [];

  for (const [userId, vote] of round.votes.entries()) {
    if (!registeredUsers.has(userId)) continue;
    if (vote.answerId === correctAnswerId && vote.votedAt <= deadline) {
      winners.push(userId);
    }
  }

  return winners;
}

async function recordRoundResults(
  quizState: QuizState,
  question: QuizState['questions'][number],
  round: QuestionRoundState,
  winnerIds: string[],
  guild: Guild,
): Promise<void> {
  const correctAnswerId = ANSWER_ID_MAP[question.correctAnswer];
  const deadline = round.questionStartedAt + config.quizTimeLimit;

  for (const [userId, vote] of round.votes.entries()) {
    if (!quizState.registeredUsers.has(userId)) continue;
    if (vote.votedAt > deadline) continue;

    const isCorrect = vote.answerId === correctAnswerId;
    const responseTime = vote.votedAt - round.questionStartedAt;

    let participant = quizState.participants.get(userId);
    if (!participant) {
      let username = 'مستخدم';
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        username = member?.user.username || 'مستخدم';
      } catch { /* ignore */ }

      participant = {
        userId,
        username,
        correctCount: 0,
        wrongCount: 0,
        totalTime: 0,
        pointsEarned: 0,
        answerSequence: [],
      };
      quizState.participants.set(userId, participant);
    }

    if (isCorrect) {
      participant.correctCount++;
      participant.totalTime += responseTime;
      const pts = config.pointsPerCorrect(question.difficulty);
      const isSpeedBonus = responseTime <= config.speedBonusWindow;
      const earnedPoints = pts + (isSpeedBonus ? config.speedBonusPoints : 0);

      participant.pointsEarned += earnedPoints;
      participant.answerSequence.push(true);

      if (userId === quizState.userId) {
        quizState.pointsEarned += earnedPoints;
        quizState.coinsEarned += calculateCoins(question.difficulty);
      }
    } else {
      participant.wrongCount++;
      participant.answerSequence.push(false);
    }
  }
}

function determineTopParticipants(quizState: QuizState): Map<string, number> {
  const sorted = Array.from(quizState.participants.values())
    .filter(p => p.correctCount > 0 || p.wrongCount > 0)
    .sort((a, b) => {
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.totalTime - b.totalTime;
    });

  const positions = new Map<string, number>();

  for (let i = 0; i < sorted.length; i++) {
    const position = i + 1;
    positions.set(sorted[i].userId, position);
  }

  return positions;
}

function awardPlacementPoints(positions: Map<string, number>, quizState: QuizState): void {
  for (const [userId, position] of positions) {
    const participant = quizState.participants.get(userId);
    if (!participant) continue;

    let bonus = 0;
    if (position === 1) bonus = config.pointsFirstPlace;
    else if (position === 2) bonus = config.pointsSecondPlace;
    else if (position === 3) bonus = config.pointsThirdPlace;

    if (bonus > 0) {
      participant.pointsEarned += bonus;
      if (userId === quizState.userId) {
        quizState.pointsEarned += bonus;
      }
    }
  }
}

function computeStreaks(participant: ParticipantData, preStreak: number): { currentStreak: number; bestStreak: number } {
  let curStreak = preStreak;
  let best = curStreak;

  for (const isCorrect of participant.answerSequence) {
    if (isCorrect) {
      curStreak++;
      if (curStreak > best) best = curStreak;
    } else {
      curStreak = 0;
    }
  }

  return { currentStreak: curStreak, bestStreak: best };
}

export function validateResults(quizState: QuizState): {
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalPoints: number;
  totalCoins: number;
} {
  const totalQuestions = quizState.totalQuestions;

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < totalQuestions; i++) {
    const record = quizState.answers[i];
    if (!record || record.status === 'skipped') {
      skippedCount++;
    } else if (record.isCorrect) {
      correctCount++;
    } else {
      wrongCount++;
    }
  }

  const validationSum = correctCount + wrongCount + skippedCount;
  if (validationSum !== totalQuestions) {
    console.error(
      `[VALIDATION FAILED] Quiz ${quizState.channelId}: correct(${correctCount}) + wrong(${wrongCount}) + skipped(${skippedCount}) = ${validationSum} !== total(${totalQuestions})`,
    );
  }

  return {
    correctCount,
    wrongCount,
    skippedCount,
    totalPoints: quizState.pointsEarned,
    totalCoins: quizState.coinsEarned,
  };
}

export function recalculatePointsFromAnswers(quizState: QuizState): { points: number; coins: number } {
  let points = 0;
  let coins = 0;

  for (let i = 0; i < quizState.totalQuestions; i++) {
    const record = quizState.answers[i];
    if (!record || record.status === 'skipped' || !record.isCorrect) continue;

    const q = quizState.questions[i];
    let pts = config.pointsPerCorrect(q.difficulty);
    if (record.time <= config.speedBonusWindow) pts += config.speedBonusPoints;
    points += pts;
    coins += calculateCoins(q.difficulty);
  }

  return { points, coins };
}

async function finishQuiz(channel: TextChannel, quizState: QuizState): Promise<void> {
  const key = getChannelQuizKey(quizState.guildId, quizState.channelId);
  quizState.status = 'completed';
  clearRoundTimers(quizState.round);

  const positions = determineTopParticipants(quizState);
  awardPlacementPoints(positions, quizState);

  const results = validateResults(quizState);
  const recalculated = recalculatePointsFromAnswers(quizState);

  const earnedPoints = Math.max(results.totalPoints, recalculated.points);
  const earnedCoins = Math.max(results.totalCoins, recalculated.coins);

  const usernameMap = new Map<string, string>();
  const avatarUrlMap = new Map<string, string>();
  for (const [uid] of quizState.participants) {
    try {
      const member = await channel.guild.members.fetch(uid).catch(() => null);
      usernameMap.set(uid, member?.user.username || 'مستخدم');
      avatarUrlMap.set(uid, member?.user.displayAvatarURL({ size: 256 }) || '');
    } catch {
      usernameMap.set(uid, 'مستخدم');
      avatarUrlMap.set(uid, '');
    }
  }

  const firstPlaceUserId = Array.from(positions.entries()).find(([, pos]) => pos === 1)?.[0];
  const winnerAvatarUrl = firstPlaceUserId ? avatarUrlMap.get(firstPlaceUserId) || '' : '';

  try {
    beginTransaction();

    execInTransaction(
      `INSERT INTO quiz_sessions (guild_id, channel_id, user_id, total_questions, correct_count, wrong_count, skipped_count, points_earned, coins_earned, position, status, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'), datetime('now'))`,
      [
        quizState.guildId,
        quizState.channelId,
        quizState.userId,
        quizState.totalQuestions,
        results.correctCount,
        results.wrongCount,
        results.skippedCount,
        earnedPoints,
        earnedCoins,
        positions.get(quizState.userId) || 0,
      ],
    );

    const sessionId = queryOne('SELECT last_insert_rowid() as id')?.id as number;
    quizState.sessionId = sessionId;

    for (let i = 0; i < quizState.totalQuestions; i++) {
      const record = quizState.answers[i];
      if (!record || record.status === 'skipped') {
        execInTransaction(
          `INSERT INTO quiz_answers (session_id, user_id, question_id, selected_answer, is_correct, status, answered_at)
           VALUES (?, ?, ?, NULL, 0, 'skipped', datetime('now'))`,
          [sessionId, quizState.userId, quizState.questions[i].id],
        );
      } else {
        execInTransaction(
          `INSERT INTO quiz_answers (session_id, user_id, question_id, selected_answer, is_correct, status, answered_at)
           VALUES (?, ?, ?, ?, ?, 'answered', datetime('now'))`,
          [sessionId, quizState.userId, quizState.questions[i].id, record.answer, record.isCorrect ? 1 : 0],
        );
      }
    }

    for (const [, participant] of quizState.participants) {
      const preUser = queryOne(
        'SELECT current_streak, best_streak FROM users WHERE user_id = ? AND guild_id = ?',
        [participant.userId, quizState.guildId],
      );
      const preStreak = (preUser?.current_streak as number) || 0;
      const preBestStreak = (preUser?.best_streak as number) || 0;

      const { currentStreak, bestStreak } = computeStreaks(participant, preStreak);
      const finalBestStreak = Math.max(preBestStreak, bestStreak);

      const displayName = usernameMap.get(participant.userId) || participant.username;
      upsertUser(participant.userId, quizState.guildId, displayName);

      execInTransaction(
        `UPDATE users SET
          correct_answers = correct_answers + ?,
          wrong_answers = wrong_answers + ?,
          points = points + ?,
          coins = coins + ?,
          total_quizzes = total_quizzes + 1,
          current_streak = ?,
          best_streak = ?
         WHERE user_id = ? AND guild_id = ?`,
        [
          participant.correctCount,
          participant.wrongCount,
          participant.pointsEarned,
          calculateCoins(1) * participant.correctCount,
          currentStreak,
          finalBestStreak,
          participant.userId,
          quizState.guildId,
        ],
      );

      const position = positions.get(participant.userId) || 0;
      if (position >= 1 && position <= 3) {
        incrementUserPlacement(participant.userId, quizState.guildId, position);
      }

      const userRow = queryOne(
        'SELECT points, level FROM users WHERE user_id = ? AND guild_id = ?',
        [participant.userId, quizState.guildId],
      );

      if (userRow) {
        const newLevel = calculateLevel(userRow.points as number);
        if (newLevel !== (userRow.level as number)) {
          execInTransaction(
            'UPDATE users SET level = ? WHERE user_id = ? AND guild_id = ?',
            [newLevel, participant.userId, quizState.guildId],
          );
        }
      }

      execInTransaction(
        `INSERT INTO quiz_participants (session_id, user_id, correct_count, wrong_count, total_time, points_earned, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          participant.userId,
          participant.correctCount,
          participant.wrongCount,
          participant.totalTime,
          participant.pointsEarned,
          position,
        ],
      );
    }

    commitTransaction();
  } catch (err) {
    console.error('[QUIZ TRANSACTION ERROR]', err);
    try { rollbackTransaction(); } catch (_) { /* no active transaction */ }
    await channel.send({ embeds: [buildErrorEmbed('حدث خطأ أثناء حفظ نتائج الاختبار.')] }).catch(() => {});
    activeQuizzes.delete(key);
    return;
  }

  const finalRow = queryOne(
    'SELECT level, points FROM users WHERE user_id = ? AND guild_id = ?',
    [quizState.userId, quizState.guildId],
  );
  const finalLevel = finalRow ? (finalRow.level as number) : 1;
  const previousLevel = quizState.preQuizUserSnapshot?.level || 1;
  const levelUp = finalLevel > previousLevel;
  const nextLevelPoints = (finalLevel + 1) * (finalLevel + 1) * 50;

  const topParticipants = Array.from(quizState.participants.values())
    .filter(p => p.correctCount > 0 || p.wrongCount > 0)
    .sort((a, b) => {
      const posA = positions.get(a.userId) || 999;
      const posB = positions.get(b.userId) || 999;
      return posA - posB;
    })
    .slice(0, 10);

  const totalParticipants = quizState.participants.size;
  const totalCorrectAll = Array.from(quizState.participants.values())
    .reduce((sum, p) => sum + p.correctCount, 0);
  const totalWrongAll = Array.from(quizState.participants.values())
    .reduce((sum, p) => sum + p.wrongCount, 0);
  const totalAnswerAll = totalCorrectAll + totalWrongAll;
  const accuracyRate = totalAnswerAll > 0 ? Math.round((totalCorrectAll / totalAnswerAll) * 100) : 0;
  const quizDuration = Math.round((Date.now() - quizState.startTime) / 1000);

  const finalEmbed = buildFinalResultsEmbed(
    quizState.totalQuestions,
    results.correctCount,
    results.wrongCount,
    results.skippedCount,
    earnedPoints,
    earnedCoins,
    finalLevel,
    nextLevelPoints,
    levelUp,
    topParticipants,
    positions,
    totalParticipants,
    accuracyRate,
    quizDuration,
    winnerAvatarUrl,
  );

  try {
    await channel.send({ embeds: [finalEmbed] });
  } catch (err) {
    console.error('[QUIZ ERROR] Failed to send results embed:', err);
  }

  if (levelUp) {
    try {
      await channel.send({
        content: `<@${quizState.userId}> **🎉 تهانينا! لقد وصلت إلى المستوى ${finalLevel}!**`,
      });
    } catch (err) {
      console.error('[QUIZ ERROR] Failed to send level-up message:', err);
    }
  }

  activeQuizzes.delete(key);
}

export function recalculateQuizFromDb(sessionId: number): {
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  pointsEarned: number;
  coinsEarned: number;
} | null {
  const sessionRow = queryOne('SELECT * FROM quiz_sessions WHERE id = ?', [sessionId]);

  if (!sessionRow) return null;

  const answers = queryAll(
    'SELECT * FROM quiz_answers WHERE session_id = ?',
    [sessionId],
  );

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  for (const a of answers) {
    const status = a.status as string;
    if (status === 'skipped') {
      skippedCount++;
    } else if ((a.is_correct as number) === 1) {
      correctCount++;
    } else {
      wrongCount++;
    }
  }

  return {
    correctCount,
    wrongCount,
    skippedCount,
    totalQuestions: sessionRow.total_questions as number,
    pointsEarned: sessionRow.points_earned as number,
    coinsEarned: sessionRow.coins_earned as number,
  };
}
