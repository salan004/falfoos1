import {
  REST,
  Routes,
  SlashCommandBuilder,
  SlashCommandStringOption,
  SlashCommandIntegerOption,
  SlashCommandAttachmentOption,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from '../config';
import { initDb } from '../database/connection';
import { getCategories } from '../database/questions';

const ADMIN_PERMISSIONS = PermissionFlagsBits.Administrator;

async function getCategoryChoices() {
  const rows = getCategories();
  return rows.map(r => ({ name: r.name_ar, value: String(r.id) }));
}

function addQuizOptionsEn(builder: SlashCommandBuilder, categories: { name: string; value: string }[]) {
  return builder
    .addIntegerOption(
      new SlashCommandIntegerOption()
        .setName('questions')
        .setDescription('Number of questions (1-20, default 5)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption()
        .setName('category')
        .setDescription('Question category')
        .addChoices(...categories)
        .setRequired(false),
    );
}

function addQuizOptionsAr(builder: SlashCommandBuilder, categories: { name: string; value: string }[]) {
  return builder
    .addIntegerOption(
      new SlashCommandIntegerOption()
        .setName('عدد_الأسئلة')
        .setDescription('عدد الأسئلة (1-20، افتراضي 5)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption()
        .setName('التصنيف')
        .setDescription('تصنيف الأسئلة')
        .addChoices(...categories)
        .setRequired(false),
    );
}

async function buildCommands() {
  await initDb();
  const categories = await getCategoryChoices();

  const quizCommandAr = addQuizOptionsAr(
    new SlashCommandBuilder().setName('مسابقة').setDescription('بدء مسابقة إسلامية'),
    categories,
  );

  const quizCommandEn = addQuizOptionsEn(
    new SlashCommandBuilder().setName('quiz').setDescription('Start an Islamic quiz'),
    categories,
  );

  const leaderboardCommandAr = new SlashCommandBuilder()
    .setName('المتصدرون')
    .setDescription('عرض لوحة المتصدرين')
    .addIntegerOption(
      new SlashCommandIntegerOption()
        .setName('الصفحة')
        .setDescription('رقم الصفحة')
        .setMinValue(1)
        .setRequired(false),
    );

  const leaderboardCommandEn = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the leaderboard')
    .addIntegerOption(
      new SlashCommandIntegerOption()
        .setName('page')
        .setDescription('Page number')
        .setMinValue(1)
        .setRequired(false),
    );

  const profileCommandAr = new SlashCommandBuilder()
    .setName('ملفي')
    .setDescription('عرض ملفك الشخصي');

  const profileCommandEn = new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your profile');

  const rankCommand = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your server rank');

  const skipCommand = new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current quiz question');

  const addQuestionCommandEn = new SlashCommandBuilder()
    .setName('addquestion')
    .setDescription('Add a new question (admins only)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
    .addStringOption(
      new SlashCommandStringOption().setName('question').setDescription('Question text').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('option_a').setDescription('Option A').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('option_b').setDescription('Option B').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('option_c').setDescription('Option C').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('option_d').setDescription('Option D').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption()
        .setName('correct_answer')
        .setDescription('Correct letter: A, B, C, or D')
        .setRequired(true)
        .addChoices(
          { name: 'A', value: 'A' },
          { name: 'B', value: 'B' },
          { name: 'C', value: 'C' },
          { name: 'D', value: 'D' },
        ),
    )
    .addStringOption(
      new SlashCommandStringOption()
        .setName('category')
        .setDescription('Category')
        .addChoices(...categories)
        .setRequired(true),
    )
    .addIntegerOption(
      new SlashCommandIntegerOption()
        .setName('difficulty')
        .setDescription('Difficulty level (1-5)')
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('source').setDescription('Source or explanation').setRequired(false),
    );

  const addQuestionCommandAr = new SlashCommandBuilder()
    .setName('إضافة_سؤال')
    .setDescription('إضافة سؤال جديد (للمشرفين)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
    .addStringOption(
      new SlashCommandStringOption().setName('السؤال').setDescription('نص السؤال').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('الخيار_أ').setDescription('الخيار الأول').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('الخيار_ب').setDescription('الخيار الثاني').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('الخيار_ج').setDescription('الخيار الثالث').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('الخيار_د').setDescription('الخيار الرابع').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption()
        .setName('الإجابة_الصحيحة')
        .setDescription('الحرف الصحيح: أ، ب، ج، د')
        .setRequired(true)
        .addChoices(
          { name: 'أ', value: 'A' },
          { name: 'ب', value: 'B' },
          { name: 'ج', value: 'C' },
          { name: 'د', value: 'D' },
        ),
    )
    .addStringOption(
      new SlashCommandStringOption()
        .setName('التصنيف')
        .setDescription('التصنيف')
        .addChoices(...categories)
        .setRequired(true),
    )
    .addIntegerOption(
      new SlashCommandIntegerOption()
        .setName('الصعوبة')
        .setDescription('مستوى الصعوبة (1-5)')
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('المصدر').setDescription('مصدر السؤال').setRequired(false),
    );

  const editQuestionCommandAr = new SlashCommandBuilder()
    .setName('تعديل_سؤال')
    .setDescription('تعديل سؤال موجود (للمشرفين)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
    .addIntegerOption(
      new SlashCommandIntegerOption().setName('رقم_السؤال').setDescription('رقم السؤال').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('السؤال').setDescription('نص السؤال الجديد').setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('الخيار_أ').setDescription('الخيار الأول').setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('الخيار_ب').setDescription('الخيار الثاني').setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('الخيار_ج').setDescription('الخيار الثالث').setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('الخيار_د').setDescription('الخيار الرابع').setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption()
        .setName('الإجابة_الصحيحة')
        .setDescription('الحرف الصحيح: أ، ب، ج، د')
        .setRequired(false)
        .addChoices(
          { name: 'أ', value: 'A' },
          { name: 'ب', value: 'B' },
          { name: 'ج', value: 'C' },
          { name: 'د', value: 'D' },
        ),
    )
    .addStringOption(
      new SlashCommandStringOption()
        .setName('التصنيف')
        .setDescription('التصنيف الجديد')
        .addChoices(...categories)
        .setRequired(false),
    )
    .addIntegerOption(
      new SlashCommandIntegerOption()
        .setName('الصعوبة')
        .setDescription('مستوى الصعوبة (1-5)')
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false),
    );

  const editQuestionCommandEn = new SlashCommandBuilder()
    .setName('editquestion')
    .setDescription('Edit an existing question (admins only)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
    .addIntegerOption(
      new SlashCommandIntegerOption().setName('question_id').setDescription('Question ID').setRequired(true),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('question').setDescription('New question text').setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('option_a').setDescription('Option A').setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('option_b').setDescription('Option B').setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('option_c').setDescription('Option C').setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption().setName('option_d').setDescription('Option D').setRequired(false),
    )
    .addStringOption(
      new SlashCommandStringOption()
        .setName('correct_answer')
        .setDescription('Correct letter: A, B, C, or D')
        .setRequired(false)
        .addChoices(
          { name: 'A', value: 'A' },
          { name: 'B', value: 'B' },
          { name: 'C', value: 'C' },
          { name: 'D', value: 'D' },
        ),
    )
    .addStringOption(
      new SlashCommandStringOption()
        .setName('category')
        .setDescription('New category')
        .addChoices(...categories)
        .setRequired(false),
    )
    .addIntegerOption(
      new SlashCommandIntegerOption()
        .setName('difficulty')
        .setDescription('Difficulty level (1-5)')
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false),
    );

  const deleteQuestionCommandAr = new SlashCommandBuilder()
    .setName('حذف_سؤال')
    .setDescription('حذف سؤال (للمشرفين)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
    .addIntegerOption(
      new SlashCommandIntegerOption().setName('رقم_السؤال').setDescription('رقم السؤال').setRequired(true),
    );

  const deleteQuestionCommandEn = new SlashCommandBuilder()
    .setName('removequestion')
    .setDescription('Delete a question (admins only)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
    .addIntegerOption(
      new SlashCommandIntegerOption().setName('question_id').setDescription('Question ID').setRequired(true),
    );

  const importCommandAr = new SlashCommandBuilder()
    .setName('استيراد')
    .setDescription('استيراد أسئلة من ملف JSON (للمشرفين)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
    .addAttachmentOption(
      new SlashCommandAttachmentOption().setName('الملف').setDescription('ملف JSON يحتوي على الأسئلة').setRequired(true),
    );

  const importCommandEn = new SlashCommandBuilder()
    .setName('import')
    .setDescription('Import questions from a JSON file (admins only)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
    .addAttachmentOption(
      new SlashCommandAttachmentOption().setName('file').setDescription('JSON file containing questions').setRequired(true),
    );

  const exportCommandAr = new SlashCommandBuilder()
    .setName('تصدير')
    .setDescription('تصدير الأسئلة إلى JSON (للمشرفين)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
    .addStringOption(
      new SlashCommandStringOption()
        .setName('التصنيف')
        .setDescription('تصدير تصنيف معين')
        .addChoices(...categories, { name: 'جميع التصنيفات', value: 'all' })
        .setRequired(false),
    );

  const exportCommandEn = new SlashCommandBuilder()
    .setName('export')
    .setDescription('Export questions to JSON (admins only)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
    .addStringOption(
      new SlashCommandStringOption()
        .setName('category')
        .setDescription('Export a specific category')
        .addChoices(...categories, { name: 'All categories', value: 'all' })
        .setRequired(false),
    );

  const setupCommand = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Show bot setup instructions (admins only)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS);

  const settingsCommand = new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Show bot settings (admins only)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS);

  const reloadCommand = new SlashCommandBuilder()
    .setName('reload')
    .setDescription('Reload database seed data (admins only)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS);

  const permissionsCommand = new SlashCommandBuilder()
    .setName('permissions')
    .setDescription('Show command permissions (admins only)')
    .setDefaultMemberPermissions(ADMIN_PERMISSIONS);

  return [
    quizCommandAr.toJSON(),
    quizCommandEn.toJSON(),
    leaderboardCommandAr.toJSON(),
    leaderboardCommandEn.toJSON(),
    profileCommandAr.toJSON(),
    profileCommandEn.toJSON(),
    rankCommand.toJSON(),
    skipCommand.toJSON(),
    addQuestionCommandAr.toJSON(),
    addQuestionCommandEn.toJSON(),
    editQuestionCommandAr.toJSON(),
    editQuestionCommandEn.toJSON(),
    deleteQuestionCommandAr.toJSON(),
    deleteQuestionCommandEn.toJSON(),
    importCommandAr.toJSON(),
    importCommandEn.toJSON(),
    exportCommandAr.toJSON(),
    exportCommandEn.toJSON(),
    setupCommand.toJSON(),
    settingsCommand.toJSON(),
    reloadCommand.toJSON(),
    permissionsCommand.toJSON(),
  ];
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log('⏳ Registering commands...');
    const commands = await buildCommands();

    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands },
    );

    console.log(`✅ Registered ${commands.length} commands successfully!`);
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
}

registerCommands();
