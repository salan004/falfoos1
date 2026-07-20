export interface ContentFilterResult {
  safe: boolean;
  reason?: string;
}

const ARABIC_BLOCKED_WORDS = [
  'جنس', 'سكس', 'إباحي', 'عارية', 'عري', 'عريان',
  'مثير', 'شهواني', 'فاحش', 'منحرف',
  'شرموطة', 'متناك',
  'احا', 'كس', 'زب', 'طيز', 'بزاز',
  'اغتصاب', 'نيك', 'يكس',
  'لواط', 'خنيث', 'إباحية',
];

const ENGLISH_BLOCKED_WORDS = [
  'nsfw', 'sex', 'sexual', 'porn', 'xxx', '18\\+',
  'nude', 'naked', 'explicit', 'erotic',
  'gore',
  'onlyfans', 'pornhub', 'xvideos', 'redtube', 'xnxx',
  'hentai', 'rule34', 'gangbang',
];

const ALLOWED_CATEGORY_KEYWORDS: Record<string, RegExp[]> = {
  gaming: [/لعبة/i, /\bgame\b/i, /\bgaming\b/i, /بلاي/i, /فورت/i, /ماين/i, /ببجي/i, /فيفا/i, /بلايستيشن/i, /\bxbox\b/i, /\bnintendo\b/i, /\bplaystation\b/i, /\bvalorant\b/i, /\bcod\b/i, /\bpubg\b/i, /\bminecraft\b/i, /\bfortnite\b/i, /\bfifa\b/i],
  anime: [/انمي/i, /\banime\b/i, /مانجا/i, /\bmanga\b/i, /ناروتو/i, /ون بيس/i, /دراغون/i, /اتاك/i],
  programming: [/برمجة/i, /\bcoding?\b/i, /\bprogramming\b/i, /\bdeveloper\b/i, /\bbox\b/i, /\bcode\b/i, /\bgit\b/i, /\bweb\b/i, /\bapp\b/i],
  cats: [/قطة/i, /\bcat\b/i, /\bkitten\b/i, /\bقطط\b/i, /\bmeow\b/i, /\b喵\b/i],
  dogs: [/كلب/i, /\bdog\b/i, /\bpuppy\b/i, /\bجرو\b/i, /\bwoof\b/i],
  wholesome: [/جميل/i, /حلو/i, /لطيف/i, /سعادة/i, /فرح/i, /حب/i, /عائلة/i, /\blove\b/i, /\bhappy\b/i, /\bcute\b/i, /\bwholesome\b/i, /\bblessed\b/i],
};

const BLOCKED_IMAGE_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'redtube.com', 'xnxx.com',
  'onlyfans.com', 'erome.com', 'imgur.com/gallery/', 'imgur.com/a/',
];

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp4', '.mov', '.webm'];

function containsBlockedWord(text: string, blockedWords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const word of blockedWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) {
      return word;
    }
  }
  return null;
}

function hasArabicScript(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

function hasBlockedImageDomain(url: string): boolean {
  const lower = url.toLowerCase();
  for (const domain of BLOCKED_IMAGE_DOMAINS) {
    if (lower.includes(domain)) return true;
  }
  return false;
}

function isValidImageExtension(url: string): boolean {
  const lower = url.toLowerCase();
  const queryStripped = lower.split('?')[0];
  return ALLOWED_IMAGE_EXTENSIONS.some(ext => queryStripped.endsWith(ext));
}

export function filterContent(title: string, nsfwFlag: boolean, imageUrl?: string): ContentFilterResult {
  if (nsfwFlag) {
    return { safe: false, reason: 'NSFW flag is set' };
  }

  const arabicMatch = containsBlockedWord(title, ARABIC_BLOCKED_WORDS);
  if (arabicMatch) {
    return { safe: false, reason: `Title contains blocked Arabic word: ${arabicMatch}` };
  }

  const englishMatch = containsBlockedWord(title, ENGLISH_BLOCKED_WORDS);
  if (englishMatch) {
    return { safe: false, reason: `Title contains blocked English word: ${englishMatch}` };
  }

  if (imageUrl) {
    if (hasBlockedImageDomain(imageUrl)) {
      return { safe: false, reason: 'Image from blocked domain' };
    }
    if (!isValidImageExtension(imageUrl)) {
      return { safe: false, reason: 'Image URL has no valid image extension' };
    }
  }

  return { safe: true };
}

export function isArabicContent(title: string): boolean {
  return hasArabicScript(title);
}

export function filterMeme(title: string, nsfwFlag: boolean, imageUrl?: string): ContentFilterResult {
  return filterContent(title, nsfwFlag, imageUrl);
}

export function matchesCategory(title: string, category: string): boolean {
  if (category === 'random') return true;
  const keywords = ALLOWED_CATEGORY_KEYWORDS[category];
  if (!keywords) return true;
  return keywords.some(regex => regex.test(title));
}
