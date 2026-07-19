import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './utils/config';
import logger from './utils/logger';
import { stopAllSchedules } from './services/autoPoster';
import { stopVoteTimer } from './services/voteTimer';
import { initDataStore } from './data/store';
import fs from 'fs';
import path from 'path';

const CRASH_LOG = path.join(process.cwd(), 'logs', 'crash-evidence.log');
function syncLog(msg: string): void {
  try {
    fs.appendFileSync(CRASH_LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

// SIGINT forensics constants
const STARTUP_GRACE_MS = 15000;
const SIGINT_DEBOUNCE_MS = 5000;
const LOOP_DETECTION_WINDOW_MS = 10000;
const LOOP_DETECTION_THRESHOLD = 3;
const LOOP_IGNORE_MS = 30000;
const processStartTime = Date.now();
let sigintCount = 0;
let lastSigintTime: number | null = null;
let ignoringUntil: number | null = null;

function detectRestartLoop(): number | null {
  try {
    if (!fs.existsSync(CRASH_LOG)) return null;
    const raw = fs.readFileSync(CRASH_LOG, 'utf-8');
    const lines = raw.trim().split('\n').filter(l => l.includes('SIGINT'));
    const now = Date.now();
    const recent: number[] = [];
    for (const line of lines) {
      const match = line.match(/^\[([^\]]+)\]/);
      if (match) {
        const t = new Date(match[1]).getTime();
        if (now - t < LOOP_DETECTION_WINDOW_MS) recent.push(t);
      }
    }
    if (recent.length >= LOOP_DETECTION_THRESHOLD) {
      const until = Math.max(...recent) + LOOP_IGNORE_MS;
      return until > now ? until : null;
    }
  } catch {}
  return null;
}

// Clear old evidence so the next restart starts fresh
function clearCrashLog(): void {
  try {
    fs.writeFileSync(CRASH_LOG, '');
  } catch {}
}

function getSigintForensics(): Record<string, unknown> {
  return {
    pid: process.pid,
    ppid: process.ppid,
    uptimeMs: Date.now() - processStartTime,
    sigintCount,
    timeSinceLastSigintMs: lastSigintTime ? Date.now() - lastSigintTime : null,
    cwd: process.cwd(),
    argv: process.argv,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PM2_HOME: process.env.PM2_HOME,
      PM2_USAGE: process.env.PM2_USAGE,
    },
  };
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.cooldowns = new Collection();

async function loadCommands(): Promise<void> {
  const commandFiles = [
    './commands/meme',
    './commands/arena',
    './commands/favorites',
    './commands/myfavorites',
    './commands/leaderboard',
    './commands/submit',
    './commands/submit-meme',
    './commands/profile',
    './commands/mymemes',
    './commands/stats',
    './commands/help',
    './commands/pending-memes',
    './commands/mystats',
    './commands/topmemes',
    './commands/topcreators',
    './commands/config/index',
  ];

  for (const filePath of commandFiles) {
    try {
      const command = await import(filePath);
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command: /${command.data.name}`);
      }
    } catch (error) {
      console.error(`[FATAL] Failed to load command from ${filePath}`, error);
      logger.error(`Failed to load command from ${filePath}`, { error });
    }
  }
}

async function loadEvents(): Promise<void> {
  const eventFiles = [
    './events/ready',
    './events/interactionCreate',
  ];

  for (const filePath of eventFiles) {
    try {
      const event = await import(filePath);
      if (event.name) {
        if (event.once) {
          client.once(event.name, (...args: any[]) => event.execute(...args));
        } else {
          client.on(event.name, (...args: any[]) => event.execute(...args));
        }
        logger.info(`Loaded event: ${event.name}`);
      }
    } catch (error) {
      console.error(`[FATAL] Failed to load event from ${filePath}`, error);
      logger.error(`Failed to load event from ${filePath}`, { error });
    }
  }
}

async function start(): Promise<void> {
  try {
    logger.info('Initializing data store...');
    initDataStore();
    logger.info('✅ Data store initialized');

    logger.info('Loading commands...');
    await loadCommands();

    logger.info('Loading events...');
    await loadEvents();

    logger.info('Logging in to Discord...');
    await client.login(config.token);
  } catch (error) {
    logger.error('Failed to start bot', { error });
    logAndExit(1, 'start_failure', error);
  }
}

async function shutdown(source: string): Promise<void> {
  const forensics = getSigintForensics();
  syncLog(`shutdown() ENTERED from source=${source}`);
  logger.info('Shutting down gracefully...', { source, ...forensics });
  stopAllSchedules();
  stopVoteTimer();
  try {
    await client.destroy();
  } catch {
    // ignore destroy errors during shutdown
  }
  logAndExit(0, 'graceful_shutdown', null, { source, ...forensics });
}

// --- Instrumented process.exit interceptor ---
const originalExit = process.exit;
function logAndExit(code: number, reason: string, error?: unknown, extra?: Record<string, unknown>): never {
  syncLog(`logAndExit(code=${code}, reason=${reason}) CALLED`);
  const stack = new Error('EXIT_TRACE').stack!.split('\n').slice(2).join('\n');
  logger.error(`[EXIT] process.exit(${code}) called`, {
    reason,
    exitCode: code,
    exitStack: stack,
    error: error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error,
    ...extra,
  });
  // Flush logger before exit
  setTimeout(() => {
    syncLog(`process.exit(${code}) EXECUTED`);
    originalExit(code);
  }, 500);
  // Escape hatch
  return undefined as never;
}

// Track what signal triggered the shutdown
process.on('SIGINT', () => {
  const now = Date.now();
  sigintCount++;
  const forensics = getSigintForensics();
  
  syncLog(`SIGINT handler FIRED (count=${sigintCount})`);
  logger.warn('SIGINT received', { 
    source: 'SIGINT', 
    ...forensics,
    stack: new Error('SIGINT_TRACE').stack,
  });

  if (ignoringUntil && now < ignoringUntil) {
    syncLog(`SIGINT IGNORED (restart loop suppression active, ${ignoringUntil - now}ms remaining)`);
    logger.error('SIGINT ignored - restart loop suppression active', {
      remainingMs: ignoringUntil - now,
      sigintCount,
    });
    return;
  }

  const timeSinceStart = now - processStartTime;
  const timeSinceLastSigint = lastSigintTime ? now - lastSigintTime : Infinity;

  if (timeSinceStart < STARTUP_GRACE_MS) {
    logger.warn('SIGINT received during startup grace period - possible spurious signal', {
      timeSinceStartMs: timeSinceStart,
      gracePeriodMs: STARTUP_GRACE_MS,
    });
  }

  if (timeSinceLastSigint < SIGINT_DEBOUNCE_MS) {
    logger.error('SIGINT received too frequently - possible external restart loop', {
      timeSinceLastSigintMs: timeSinceLastSigint,
      debounceMs: SIGINT_DEBOUNCE_MS,
      sigintCount,
      action: 'ignoring_this_signal_to_prevent_loop',
    });
    lastSigintTime = now;
    return;
  }

  lastSigintTime = now;
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  const forensics = getSigintForensics();
  syncLog('SIGTERM handler FIRED');
  logger.warn('SIGTERM received', { 
    source: 'SIGTERM', 
    ...forensics,
    stack: new Error('SIGTERM_TRACE').stack,
  });
  shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  syncLog(`unhandledRejection FIRED: ${reason instanceof Error ? reason.message : String(reason)}`);
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('=== UNHANDLED REJECTION ===', {
    timestamp: new Date().toISOString(),
    errorName: error.name,
    errorMessage: error.message,
    stackTrace: error.stack,
    rawReason: reason,
    promiseConstructor: promise?.constructor?.name,
  });
  logAndExit(1, 'unhandled_rejection', error);
});

process.on('uncaughtException', (error: Error) => {
  syncLog(`uncaughtException FIRED: ${error.message}`);
  logger.error('=== UNCAUGHT EXCEPTION ===', {
    timestamp: new Date().toISOString(),
    errorName: error.name,
    errorMessage: error.message,
    stackTrace: error.stack,
  });
  logAndExit(1, 'uncaught_exception', error);
});

ignoringUntil = detectRestartLoop();
if (ignoringUntil) {
  const remain = ignoringUntil - Date.now();
  logger.warn('External restart loop detected via crash evidence - ignoring SIGINT for startup window', {
    ignoreDurationMs: remain,
    until: new Date(ignoringUntil).toISOString(),
  });
  syncLog(`RESTART_LOOP_DETECTED ignoring SIGINT until ${new Date(ignoringUntil).toISOString()}`);
  clearCrashLog();
}

start();

