/** localStorage helpers that never throw (storage can be blocked inside iframes). */

export const load = <T>(
  key: string,
  guard: (value: unknown) => value is T
): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return guard(value) ? value : null;
  } catch {
    return null;
  }
};

export const save = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore: progress simply will not survive a reload.
  }
};

export const remove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
};

export const flag = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

export const setFlag = (key: string): void => {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Ignore.
  }
};
