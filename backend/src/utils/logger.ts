const LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;
type Level = (typeof LEVELS)[number];

const envLevel = (process.env.LOG_LEVEL ?? 'info') as Level;
const levelIndex = (l: Level) => LEVELS.indexOf(l);
const isEnabled = (l: Level) => levelIndex(l) >= levelIndex(envLevel);

const ts = () => new Date().toISOString();
const USE_COLOR = process.stdout.isTTY && process.env.NODE_ENV !== 'production';
const RESET = '\x1b[0m';

export const debug = (...args: unknown[]): void => {
  if (isEnabled('debug')) console.log(ts(), '[debug]', ...args);
};
export const info = (...args: unknown[]): void => {
  if (isEnabled('info')) console.log(ts(), '[info]', ...args);
};
export const warn = (...args: unknown[]): void => {
  if (isEnabled('warn')) console.warn(ts(), '[warn]', ...args);
};
export const error = (...args: unknown[]): void => {
  if (isEnabled('error')) console.error(ts(), ...args);
};

export function createTaggedLogger(tag: string, ansiColor: string) {
  const prefix = USE_COLOR ? `${ansiColor}${tag}${RESET}` : tag;
  return {
    debug: (...args: unknown[]) => { if (isEnabled('debug')) console.log(ts(), '[debug]', prefix, ...args); },
    info:  (...args: unknown[]) => { if (isEnabled('info'))  console.log(ts(), '[info]',  prefix, ...args); },
    warn:  (...args: unknown[]) => { if (isEnabled('warn'))  console.warn(ts(), '[warn]',  prefix, ...args); },
    error: (...args: unknown[]) => { if (isEnabled('error')) console.error(ts(), '[error]', prefix, ...args); },
  };
}

