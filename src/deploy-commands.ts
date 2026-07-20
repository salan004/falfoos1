import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from './utils/config';
import logger from './utils/logger';

async function deployCommands(): Promise<void> {
  try {
    const commands = [
      new SlashCommandBuilder()
        .setName('ميم')
        .setDescription('تم استبدال هذا الأمر بـ /الساحة'),

      new SlashCommandBuilder()
        .setName('الساحة')
        .setDescription('عرض أفضل 3 ميمات يتم التصويت عليها حالياً!'),

      new SlashCommandBuilder()
        .setName('إرسال')
        .setDescription('إرسال ميم إلى الساحة للمراجعة')
        .addAttachmentOption(option =>
          option
            .setName('الميم')
            .setDescription('ارفع صورة/GIF/فيديو الميم')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('العنوان')
            .setDescription('عنوان اختياري للميم (100 حرف كحد أقصى)')
            .setRequired(false)
            .setMaxLength(100)
        )
        .addStringOption(option =>
          option
            .setName('التصنيف')
            .setDescription('اختر تصنيفاً')
            .setRequired(false)
            .addChoices(
              { name: '🌍 عربي', value: 'arabic' },
              { name: '🎮 ألعاب', value: 'gaming' },
              { name: '💬 ديسكورد', value: 'discord' },
              { name: '📚 مدرسة', value: 'school' },
              { name: '🌐 إنترنت', value: 'internet' },
              { name: '🎲 عشوائي', value: 'random' },
            )
        ),

      new SlashCommandBuilder()
        .setName('الملف')
        .setDescription('عرض ملفك الشخصي وإحصائياتك في ساحة الميم')
        .addUserOption(option =>
          option
            .setName('المستخدم')
            .setDescription('المستخدم لعرض ملفه (الافتراضي أنت)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('ميماتي')
        .setDescription('عرض الميمات التي أرسلتها'),

      new SlashCommandBuilder()
        .setName('الإحصائيات')
        .setDescription('عرض إحصائيات ساحة الميم العامة'),

      new SlashCommandBuilder()
        .setName('مساعدة')
        .setDescription('تعلم كيفية استخدام بوت ساحة الميم'),

      new SlashCommandBuilder()
        .setName('الميمات-قيد-المراجعة')
        .setDescription('عرض الميمات التي تنتظر المراجعة')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder()
        .setName('إحصائياتي')
        .setDescription('عرض إحصائيات الميم الخاصة بك'),

      new SlashCommandBuilder()
        .setName('أفضل-الميمات')
        .setDescription('عرض أفضل الميمات المجتمعية')
        .addStringOption(option =>
          option
            .setName('التصنيف')
            .setDescription('تصفية حسب التصنيف')
            .setRequired(false)
            .addChoices(
              { name: '🌍 عربي', value: 'arabic' },
              { name: '🎮 ألعاب', value: 'gaming' },
              { name: '💬 ديسكورد', value: 'discord' },
              { name: '📚 مدرسة', value: 'school' },
              { name: '🌐 إنترنت', value: 'internet' },
              { name: '🎲 عشوائي', value: 'random' },
            )
        ),

      new SlashCommandBuilder()
        .setName('أفضل-المبدعين')
        .setDescription('عرض أفضل مبدعي الميمات'),

      new SlashCommandBuilder()
        .setName('المفضلة')
        .setDescription('عرض الميمات المفضلة لديك'),

      new SlashCommandBuilder()
        .setName('المتصدرين')
        .setDescription('عرض لوحات المتصدرين')
        .addStringOption(option =>
          option
            .setName('النوع')
            .setDescription('اختر نوع لوحة المتصدرين')
            .setRequired(false)
            .addChoices(
              { name: '👑 النقاط', value: 'points' },
              { name: '📊 الموسمي', value: 'seasonal' },
              { name: '📈 الأسبوعي', value: 'weekly' },
              { name: '🏛️ قاعة المشاهير', value: 'hall_of_fame' },
              { name: '🏆 أفضل الميمات تصويتاً', value: 'top_memes' },
              { name: '⭐ أفضل المساهمين', value: 'contributors' },
              { name: '👥 أكثر المستخدمين نشاطاً', value: 'active' },
            )
        ),

      new SlashCommandBuilder()
        .setName('الإعدادات')
        .setDescription('تكوين إعدادات بوت الميم')
        .setDefaultMemberPermissions(0x8)
        .addSubcommand(sub =>
          sub
            .setName('تعيين-القناة')
            .setDescription('تعيين القناة للنشر التلقائي للميمات')
            .addChannelOption(option =>
              option
                .setName('القناة')
                .setDescription('قناة النص للنشر التلقائي')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('تعيين-الفاصل')
            .setDescription('تعيين الفاصل الزمني للنشر التلقائي')
            .addStringOption(option =>
              option
                .setName('الفاصل')
                .setDescription('كم مرة يتم نشر الميمات')
                .setRequired(true)
                .addChoices(
                  { name: 'كل ساعة', value: 'hourly' },
                  { name: 'كل 3 ساعات', value: '3hours' },
                  { name: 'كل 6 ساعات', value: '6hours' },
                  { name: 'كل 12 ساعة', value: '12hours' },
                  { name: 'كل يوم', value: 'daily' },
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('تفعيل')
            .setDescription('تفعيل النشر التلقائي للميمات')
        )
        .addSubcommand(sub =>
          sub
            .setName('تعطيل')
            .setDescription('تعطيل النشر التلقائي للميمات')
        )
        .addSubcommand(sub =>
          sub
            .setName('تعيين-الهدوء')
            .setDescription('تعيين فترة الهدوء للأوامر بالثواني (1-3600)')
            .addIntegerOption(option =>
              option
                .setName('الثواني')
                .setDescription('فترة الهدوء بالثواني')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(3600)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('عرض')
            .setDescription('عرض الإعدادات الحالية')
        )
        .addSubcommand(sub =>
          sub
            .setName('تعيين-قناة-المراجعة')
            .setDescription('تعيين القناة لمراجعة الميمات')
            .addChannelOption(option =>
              option
                .setName('القناة')
                .setDescription('قناة النص لمراجعة الميمات')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('تعيين-قناة-الميم')
            .setDescription('تعيين قناة ساحة الميم العامة')
            .addChannelOption(option =>
              option
                .setName('القناة')
                .setDescription('قناة النص لعرض الميمات المعتمدة')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('تعيين-قناة-الإعلانات')
            .setDescription('تعيين قناة الإعلانات')
            .addChannelOption(option =>
              option
                .setName('القناة')
                .setDescription('قناة النص لإعلانات الساحة')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('تعيين-حد-الإرسال')
            .setDescription('تعيين الحد الأقصى للإرسال اليومي (1-10)')
            .addIntegerOption(option =>
              option
                .setName('الحد')
                .setDescription('عدد الميمات المسموح بها لكل مستخدم يومياً')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10)
            )
        ),
    ];

    const rest = new REST({ version: '10' }).setToken(config.token);

    logger.info('Registering slash commands...');
    for (const cmd of commands) {
      logger.info(`Registering command: ${cmd.name}`);
    }

    if (config.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      logger.info(`✅ Registered guild commands for guild ${config.guildId}`);
    } else {
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      logger.info('✅ Registered global commands');
    }

    logger.info(`Successfully registered ${commands.length} commands`);
  } catch (error) {
    logger.error('Failed to deploy commands', { error });
    process.exit(1);
  }
}

deployCommands();
