import { initDb } from '../src/database/connection';
import { initializeSchema } from '../src/database/schema';
import { bulkImportQuestions, getCategories } from '../src/database/questions';
import { queryOne } from '../src/database/helpers';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('❌ الرجاء تحديد مسار ملف JSON.');
    console.log('▶️ مثال: npm run import -- ./data/questions.json');
    process.exit(1);
  }

  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ الملف غير موجود: ${fullPath}`);
    process.exit(1);
  }

  console.log('⏳ جاري تهيئة قاعدة البيانات...');
  await initDb();
  initializeSchema();

  const raw = fs.readFileSync(fullPath, 'utf-8');
  let data: any[];

  try {
    data = JSON.parse(raw);
  } catch {
    console.error('❌ فشل قراءة JSON. تأكد من صيغة الملف.');
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.error('❌ الملف فارغ أو غير صالح.');
    process.exit(1);
  }

  const categoryMap = new Map<string, number>();
  const catRows = getCategories();
  for (const c of catRows) {
    categoryMap.set(c.name_ar, c.id);
  }

  console.log(`📦 تم العثور على ${data.length} سؤال في الملف.`);
  console.log(`📁 التصنيفات المتوفرة: ${catRows.map(c => c.name_ar).join(', ')}`);

  const questions: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    if (!item.category || !categoryMap.has(item.category)) {
      errors.push(`السطر ${i + 1}: تصنيف "${item.category}" غير موجود. التصنيفات المتاحة: ${Array.from(categoryMap.keys()).join(', ')}`);
      continue;
    }

    if (!item.question_ar || !item.options?.A || !item.options?.B || !item.options?.C || !item.options?.D || !item.correct) {
      errors.push(`السطر ${i + 1}: بيانات ناقصة (تأكد من وجود question_ar, options.A/B/C/D, correct)`);
      continue;
    }

    if (!['A', 'B', 'C', 'D'].includes(item.correct)) {
      errors.push(`السطر ${i + 1}: الإجابة الصحيحة "${item.correct}" غير صالحة. يجب أن تكون A, B, C, أو D.`);
      continue;
    }

    questions.push({
      categoryId: categoryMap.get(item.category)!,
      questionAr: item.question_ar,
      optionA: item.options.A,
      optionB: item.options.B,
      optionC: item.options.C,
      optionD: item.options.D,
      correctAnswer: item.correct,
      difficulty: item.difficulty || 1,
      source: item.source || null,
    });
  }

  if (questions.length === 0) {
    console.error('❌ لم يتم العثور على أسئلة صالحة للاستيراد.');
    if (errors.length > 0) {
      console.log('\n⚠️ الأخطاء:');
      errors.forEach(e => console.log(`  ${e}`));
    }
    process.exit(1);
  }

  console.log(`\n⏳ جاري استيراد ${questions.length} سؤال...`);
  const imported = bulkImportQuestions(questions);
  console.log(`✅ تم استيراد ${imported} سؤال بنجاح!`);

  if (errors.length > 0) {
    console.log(`\n⚠️ ${errors.length} خطأ أثناء المعالجة:`);
    errors.slice(0, 10).forEach(e => console.log(`  ${e}`));
    if (errors.length > 10) {
      console.log(`  ... و ${errors.length - 10} خطأ آخر`);
    }
  }

  const totalQ = queryOne('SELECT COUNT(*) as count FROM questions');
  console.log(`\n📊 إجمالي الأسئلة في قاعدة البيانات الآن: ${(totalQ?.count as number) || 0}`);
}

main().catch(console.error);
