const LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;
type Level = (typeof LEVELS)[number];

const envLevel = (process.env.LOG_LEVEL ?? 'info') as Level;
const levelIndex = (l: Level) => LEVELS.indexOf(l);
const isEnabled = (l: Level) => levelIndex(l) >= levelIndex(envLevel);

const ts = () => new Date().toISOString();

export const debug = (...args: unknown[]): void => {
  if (isEnabled('debug')) console.log(ts(), '[debug]', ...args);
};
export const info = (...args: unknown[]): void => {
  if (isEnabled('info')) console.log(ts(), ...args);
};
export const warn = (...args: unknown[]): void => {
  if (isEnabled('warn')) console.warn(ts(), ...args);
};
export const error = (...args: unknown[]): void => {
  if (isEnabled('error')) console.error(ts(), ...args);
};


