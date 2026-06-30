import { config } from './config';
import { client } from './client';
import { initDb } from './database/connection';
import { initializeSchema } from './database/schema';
import { seedDatabase } from './database/seed';
import { registerReadyEvent } from './events/ready';
import { registerInteractionEvent } from './events/interactionCreate';
async function main() {
  if (!config.token) {
    console.error('❌ لم يتم تعيين BOT_TOKEN في ملف .env');
    process.exit(1);
  }

  console.log('⏳ جاري تهيئة قاعدة البيانات...');
  await initDb();
  initializeSchema();

  console.log('⏳ جاري بذر البيانات...');
  await seedDatabase();

  registerReadyEvent();
  registerInteractionEvent();

  await client.login(config.token);
  console.log('✅ البوت يعمل!');
}

main().catch((err) => {
  console.error('❌ خطأ:', err);
  process.exit(1);
});
