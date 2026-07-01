import fetch from 'node-fetch';
import { MemeData, MemeCategory, MemeSourceType } from '../types';
import { filterMeme } from './contentFilter';
import { addCachedMeme, getCachedMeme, getFallbackMemes } from '../data/store';
import logger from './logger';

const REDDIT_API_BASE = 'https://api.reddit.com';
const REQUEST_TIMEOUT = 10000;
const MAX_RETRIES = 2;
const POSTS_PER_FETCH = 100;
const RETRY_DELAY_MS = 1000;

let redditDisabled = false;

const ARABIC_SUBREDDITS: Record<string, string[]> = {
  arabic: [
    'arabs', 'arabfunny', 'arabcringe', 'middleeast',
    'saudiarabia', 'egypt', 'lebanon', 'jordan',
    'morocco', 'sudan', 'iraq', 'palestine',
    'syria', 'kuwait', 'qatar', 'bahrain',
    'oman', 'uae', 'yemen', 'algeria', 'tunisia',
    'libya',
  ],
  gaming: [
    'arabs', 'arabfunny', 'gaming', 'middleeast',
    'gamingmemes', 'gamer',
  ],
  discord: [
    'arabs', 'arabfunny', 'discordapp', 'discordmemes',
  ],
  school: [
    'arabs', 'arabfunny', 'students', 'school',
  ],
  internet: [
    'arabs', 'arabfunny', 'memes', 'funny', 'me_irl',
  ],
  random: [
    'arabs', 'arabfunny', 'arabcringe', 'middleeast',
    'saudiarabia', 'egypt', 'lebanon', 'jordan',
    'morocco', 'sudan', 'iraq', 'palestine',
    'syria', 'kuwait', 'qatar', 'bahrain',
    'oman', 'uae', 'yemen', 'algeria', 'tunisia',
    'libya',
  ],
};

const INTERNATIONAL_SUBREDDITS = [
  'wholesomememes', 'memes', 'funny', 'me_irl',
  'reactionpics',
];

const SEEN_URLS: Record<string, Set<string>> = {};
const MAX_SEEN = 100;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function unescapeHtml(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/');
}

function isImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0].split('#')[0];
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/.test(lower) || /^https:\/\/i\.redd\.it\//.test(lower) || /^https:\/\/i\.imgur\.com\//.test(lower);
}

function extractImageUrl(post: any): string | null {
  if (post.data.is_video) return null;
  if (post.data.is_gallery) return null;

  const url = post.data.url || '';

  if (isImageUrl(url)) {
    return url;
  }

  const preview = post.data.preview?.images?.[0]?.source?.url;
  if (preview) {
    const clean = unescapeHtml(preview);
    if (isImageUrl(clean)) return clean;
  }

  const resolutions = post.data.preview?.images?.[0]?.resolutions || [];
  for (const res of resolutions) {
    const clean = unescapeHtml(res.url);
    if (isImageUrl(clean)) return clean;
  }

  if (url.startsWith('https://www.reddit.com/gallery/')) return null;

  return null;
}

async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT, sourceLabel: string = ''): Promise<{ response: any; finalUrl: string } | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DiscordMemeBot/1.0',
        'Accept': 'application/json',
      },
      redirect: 'follow',
      signal: controller.signal as any,
    });
    clearTimeout(id);

    const finalUrl = response.url || url;
    logger.info(`[MEME FETCH] ${sourceLabel}: Final URL=${finalUrl}, Status=${response.status}`);

    return { response, finalUrl };
  } catch {
    return null;
  }
}

async function validateImageUrl(imageUrl: string): Promise<boolean> {
  try {
    const result = await fetchWithTimeout(imageUrl, 5000, 'Image-Validation');
    if (!result || !result.response.ok) return false;

    const contentType: string = result.response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return false;

    const contentLength = parseInt(result.response.headers.get('content-length') || '0', 10);
    if (contentLength > 15 * 1024 * 1024) return false;
    if (contentLength > 0 && contentLength < 500) return false;

    return true;
  } catch {
    return false;
  }
}

interface ParseResult {
  meme: MemeData | null;
  rejectionReason?: string;
}

function parseRedditPost(
  post: any,
  category: string,
  sourceType: MemeSourceType,
  requireArabic: boolean,
): ParseResult {
  try {
    const data = post.data;
    if (!data) return { meme: null, rejectionReason: 'No post data' };

    const subreddit = data.subreddit || 'unknown';
    const rawTitle = data.title?.trim() || '';

    if (!rawTitle) return { meme: null, rejectionReason: 'Empty title' };

    if (data.over_18) {
      return { meme: null, rejectionReason: 'NSFW (over_18 flag)' };
    }

    if (data.is_video) {
      return { meme: null, rejectionReason: 'Video post' };
    }

    if (data.is_gallery) {
      return { meme: null, rejectionReason: 'Gallery post' };
    }

    if (data.stickied) {
      return { meme: null, rejectionReason: 'Stickied post' };
    }

    const title = rawTitle;

    if (requireArabic) {
      const containsArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(title);
      if (!containsArabic) {
        return { meme: null, rejectionReason: 'Title does not contain Arabic script' };
      }
    }

    const filterResult = filterMeme(title, data.over_18);
    if (!filterResult.safe) {
      return { meme: null, rejectionReason: `Content filter: ${filterResult.reason}` };
    }

    const imageUrl = extractImageUrl(post);
    if (!imageUrl) {
      return { meme: null, rejectionReason: 'No extractable image URL' };
    }

    const permalink = `https://www.reddit.com${data.permalink || ''}`;
    const source = `r/${data.subreddit}`;

    return {
      meme: {
        title,
        url: permalink,
        imageUrl,
        source,
        sourceType,
        category: category as MemeCategory,
        nsfw: false,
        author: data.author || undefined,
        ups: data.ups || 0,
      },
    };
  } catch {
    return { meme: null, rejectionReason: 'Parse error' };
  }
}

function markAsSeen(url: string, category: string): void {
  if (!SEEN_URLS[category]) {
    SEEN_URLS[category] = new Set();
  }
  SEEN_URLS[category].add(url);
  if (SEEN_URLS[category].size > MAX_SEEN) {
    const iterator = SEEN_URLS[category].values();
    const first = iterator.next();
    if (first.value) SEEN_URLS[category].delete(first.value);
  }
}

async function fetchRedditPosts(
  subreddits: string[],
  category: string,
  sourceType: MemeSourceType,
  requireArabic: boolean,
): Promise<MemeData[]> {
  if (redditDisabled) {
    logger.info(`[MEME FETCH] Reddit disabled (403), skipping`);
    return [];
  }

  const memes: MemeData[] = [];
  const shuffled = [...subreddits].sort(() => Math.random() - 0.5);
  const batch = shuffled.slice(0, 5);
  let totalPosts = 0;
  const allRejections: string[] = [];

  for (const subreddit of batch) {
    try {
      const url = `${REDDIT_API_BASE}/r/${subreddit}/hot?limit=${POSTS_PER_FETCH}`;
      logger.info(`[MEME FETCH] Request URL: ${url}`);

      const result = await fetchWithTimeout(url, REQUEST_TIMEOUT, `Reddit-r/${subreddit}`);

      if (!result) {
        logger.warn(`[MEME FETCH] No response for r/${subreddit} (timeout or network error)`);
        continue;
      }

      const { response, finalUrl } = result;

      if (response.status === 403) {
        logger.warn(`[MEME FETCH] HTTP 403 for r/${subreddit} — disabling Reddit`);
        redditDisabled = true;
        return memes;
      }

      if (!response.ok) {
        logger.warn(`[MEME FETCH] Failed r/${subreddit}: HTTP ${response.status}`);
        continue;
      }

      const json = await response.json() as any;
      const posts = json?.data?.children || [];
      totalPosts += posts.length;

      logger.info(`[MEME FETCH] r/${subreddit}: ${posts.length} posts returned (final URL: ${finalUrl})`);

      let subAccepted = 0;
      let subRejected = 0;
      const subRejections: Record<string, number> = {};

      for (const post of posts) {
        const parseResult = parseRedditPost(post, category, sourceType, requireArabic);

        if (parseResult.meme && !SEEN_URLS[category]?.has(parseResult.meme.imageUrl)) {
          memes.push(parseResult.meme);
          subAccepted++;
        } else if (parseResult.rejectionReason) {
          subRejected++;
          subRejections[parseResult.rejectionReason] = (subRejections[parseResult.rejectionReason] || 0) + 1;
        }
      }

      const rejectionSummary = Object.entries(subRejections)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => `${reason}: ${count}`)
        .join('; ');

      logger.info(
        `[MEME FETCH] r/${subreddit}: ${subAccepted} accepted, ${subRejected} rejected (${rejectionSummary})`,
      );

      allRejections.push(`${subreddit}: ${subAccepted}/${posts.length} accepted`);

      if (memes.length >= 10) break;
    } catch (err) {
      logger.warn(`[MEME FETCH] Error fetching r/${subreddit}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
  }

  logger.info(
    `[MEME FETCH] Summary: ${memes.length} valid memes from ${totalPosts} posts across ${batch.length} subreddits ` +
    `(${allRejections.join(' | ')}) [${sourceType}]`,
  );

  return memes;
}

async function fetchMemeApi(): Promise<MemeData | null> {
  try {
    const urls = [
      'https://meme-api.com/gimme',
      'https://meme-api.com/gimme/wholesomememes',
      'https://meme-api.com/gimme/memes',
    ];
    const shuffled = urls.sort(() => Math.random() - 0.5);

    for (const url of shuffled) {
      const result = await fetchWithTimeout(url, REQUEST_TIMEOUT, 'meme-api');
      if (!result || !result.response.ok) continue;

      const json = await result.response.json() as any;
      if (!json || json.nsfw) continue;

      const title: string = (json.title || '').trim();
      if (!title) continue;

      const filterResult = filterMeme(title, false);
      if (!filterResult.safe) continue;

      const imageUrl: string = json.url || json.preview?.[0] || '';
      if (!imageUrl || !isImageUrl(imageUrl)) continue;

      const meme: MemeData = {
        title,
        url: json.postLink || imageUrl,
        imageUrl,
        source: json.subreddit ? `r/${json.subreddit}` : 'meme-api',
        sourceType: 'api',
        category: 'random' as MemeCategory,
        nsfw: false,
        author: json.author || undefined,
        ups: json.ups || 0,
      };

      logger.info(`[MEME FETCH] meme-api.com meme found: "${meme.title.substring(0, 50)}"`);
      return meme;
    }
  } catch (err) {
    logger.warn(`[MEME FETCH] meme-api.com error: ${err instanceof Error ? err.message : err}`);
  }

  return null;
}

async function fetchImgflip(): Promise<MemeData | null> {
  try {
    const result = await fetchWithTimeout('https://api.imgflip.com/get_memes', REQUEST_TIMEOUT, 'Imgflip');
    if (!result || !result.response.ok) return null;

    const json = await result.response.json() as any;
    if (!json.success || !json.data?.memes?.length) return null;

    const memes: any[] = json.data.memes;
    const shuffled = [...memes].sort(() => Math.random() - 0.5);
    const batch = shuffled.slice(0, 20);

    for (const template of batch) {
      const name: string = (template.name || '').trim();
      if (!name) continue;

      const filterResult = filterMeme(name, false);
      if (!filterResult.safe) continue;

      const imageUrl: string = template.url || '';
      if (!imageUrl || !isImageUrl(imageUrl)) continue;

      const meme: MemeData = {
        title: name,
        url: imageUrl,
        imageUrl,
        source: 'imgflip.com',
        sourceType: 'api',
        category: 'random' as MemeCategory,
        nsfw: false,
      };

      logger.info(`[MEME FETCH] Imgflip meme found: "${meme.title.substring(0, 50)}"`);
      return meme;
    }
  } catch (err) {
    logger.warn(`[MEME FETCH] Imgflip error: ${err instanceof Error ? err.message : err}`);
  }

  return null;
}

async function tryRedditFetch(
  subreddits: string[],
  category: string,
  sourceType: MemeSourceType,
  requireArabic: boolean,
): Promise<MemeData | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`[MEME FETCH] Retry attempt ${attempt + 1}/${MAX_RETRIES} for ${sourceType}`);
        await delay(RETRY_DELAY_MS);
      }

      const memes = await fetchRedditPosts(subreddits, category, sourceType, requireArabic);

      for (const meme of memes) {
        const isValid = await validateImageUrl(meme.imageUrl);
        if (isValid) {
          logger.info(`[MEME FETCH] Selected validated ${sourceType} meme: "${meme.title.substring(0, 50)}" from ${meme.source}`);
          addCachedMeme(meme);
          markAsSeen(meme.imageUrl, category);
          return meme;
        }
      }

      if (memes.length > 0) {
        const unchecked = memes[0];
        logger.info(`[MEME FETCH] Selected ${sourceType} meme (no validated image, using anyway): "${unchecked.title.substring(0, 50)}" from ${unchecked.source}`);
        addCachedMeme(unchecked);
        markAsSeen(unchecked.imageUrl, category);
        return unchecked;
      }

      logger.warn(`[MEME FETCH] No memes found in attempt ${attempt + 1}/${MAX_RETRIES} for ${sourceType}`);
    } catch (err) {
      logger.warn(`[MEME FETCH] Error in ${sourceType} attempt ${attempt + 1}: ${err instanceof Error ? err.message : err}`);
      if (attempt < MAX_RETRIES - 1) continue;
    }
  }

  return null;
}

export async function fetchMeme(category: MemeCategory = 'random'): Promise<MemeData> {
  const cat = category;

  const cacheResult = getCachedMeme(cat);
  if (cacheResult) {
    logger.info(`[MEME FETCH] Using cached meme: "${cacheResult.title.substring(0, 50)}" (sourceType: ${cacheResult.sourceType})`);
    markAsSeen(cacheResult.imageUrl, cat);
    return {
      ...cacheResult,
      category: cat as MemeCategory,
    } as MemeData;
  }

  const arabicSubs = ARABIC_SUBREDDITS[cat] || ARABIC_SUBREDDITS.random;

  logger.info(`[MEME FETCH] Phase 1: Arabic Reddit sources for "${cat}"`);
  const arabicMeme = await tryRedditFetch(arabicSubs, cat, 'arabic', true);
  if (arabicMeme) return arabicMeme;

  if (!redditDisabled) {
    logger.info(`[MEME FETCH] Phase 2: International Reddit sources for "${cat}"`);
    const intlMeme = await tryRedditFetch(INTERNATIONAL_SUBREDDITS, cat, 'reddit', false);
    if (intlMeme) return intlMeme;
  }

  logger.info(`[MEME FETCH] Phase 3: meme-api.com fallback for "${cat}"`);
  const apiMeme = await fetchMemeApi();
  if (apiMeme) {
    const tagged: MemeData = { ...apiMeme, category: cat as MemeCategory };
    addCachedMeme(tagged);
    markAsSeen(tagged.imageUrl, cat);
    return tagged;
  }

  logger.info(`[MEME FETCH] Phase 4: Imgflip fallback for "${cat}"`);
  const imgflipMeme = await fetchImgflip();
  if (imgflipMeme) {
    const tagged: MemeData = { ...imgflipMeme, category: cat as MemeCategory };
    addCachedMeme(tagged);
    markAsSeen(tagged.imageUrl, cat);
    return tagged;
  }

  logger.info(`[MEME FETCH] Phase 5: Local JSON fallback for "${cat}"`);
  const fallback = getFallbackMemes(cat);
  if (fallback) {
    const fixed: MemeData = {
      ...fallback,
      sourceType: 'local',
      category: cat as MemeCategory,
    };
    logger.info(`[MEME FETCH] Using local fallback meme: "${fixed.title.substring(0, 50)}"`);
    markAsSeen(fixed.imageUrl, cat);
    return fixed;
  }

  logger.warn(`[MEME FETCH] All sources exhausted for "${cat}"`);
  return {
    title: 'لا توجد ميمات عربية مناسبة حالياً.',
    url: '',
    imageUrl: '',
    source: 'none',
    sourceType: 'local',
    category: cat as MemeCategory,
    nsfw: false,
  };
}
