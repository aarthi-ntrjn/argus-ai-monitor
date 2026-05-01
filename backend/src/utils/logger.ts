const LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;
type Level = (typeof LEVELS)[number];

const envLevel = (process.env.LOG_LEVEL ?? 'info') as Level;
const levelIndex = (l: Level) => LEVELS.indexOf(l);
const isEnabled = (l: Level) => levelIndex(l) >= levelIndex(envLevel);

const ts = () => {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `[${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}]`;
};
const USE_COLOR = process.stdout.isTTY && process.env.NODE_ENV !== 'production';
const RESET = '\x1b[0m';

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '\x1b[34m', // blue
  INFO:  '\x1b[32m', // green
  WARN:  '\x1b[33m', // yellow
  ERROR: '\x1b[31m', // red
};
const lvl = (label: string) => USE_COLOR ? `${LEVEL_COLORS[label]}${label}${RESET}` : label;

export const debug = (...args: unknown[]): void => {
  if (isEnabled('debug')) console.log(ts(), lvl('DEBUG'), ...args);
};
export const info = (...args: unknown[]): void => {
  if (isEnabled('info')) console.log(ts(), lvl('INFO'), ...args);
};
export const warn = (...args: unknown[]): void => {
  if (isEnabled('warn')) console.warn(ts(), lvl('WARN'), ...args);
};
export const error = (...args: unknown[]): void => {
  if (isEnabled('error')) console.error(ts(), lvl('ERROR'), ...args);
};

export function createTaggedLogger(tag: string, ansiColor: string) {
  const prefix = USE_COLOR ? `${ansiColor}${tag}${RESET}` : tag;
  return {
    debug: (...args: unknown[]) => { if (isEnabled('debug')) console.log(ts(), lvl('DEBUG'), prefix, ...args); },
    info:  (...args: unknown[]) => { if (isEnabled('info'))  console.log(ts(), lvl('INFO'),  prefix, ...args); },
    warn:  (...args: unknown[]) => { if (isEnabled('warn'))  console.warn(ts(), lvl('WARN'),  prefix, ...args); },
    error: (...args: unknown[]) => { if (isEnabled('error')) console.error(ts(), lvl('ERROR'), prefix, ...args); },
  };
}

