/**
 * Local stand-in for `@devvit/web/server`, used only by `npm run dev:local`.
 * Implements the subset of Redis and Reddit APIs that Pakia Pakia! uses, in memory.
 */

type ZEntry = { member: string; score: number };

const strings = new Map<string, string>();
const hashes = new Map<string, Map<string, string>>();
const zsets = new Map<string, Map<string, number>>();

const hash = (key: string) => {
  let h = hashes.get(key);
  if (!h) hashes.set(key, (h = new Map()));
  return h;
};
const zset = (key: string) => {
  let z = zsets.get(key);
  if (!z) zsets.set(key, (z = new Map()));
  return z;
};
const sorted = (key: string): ZEntry[] =>
  [...zset(key).entries()]
    .map(([member, score]) => ({ member, score }))
    .sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));

export const resetStore = () => {
  strings.clear();
  hashes.clear();
  zsets.clear();
};

export const redis = {
  async get(key: string) {
    return strings.get(key);
  },
  async set(key: string, value: string, options?: { nx?: boolean }) {
    if (options?.nx && strings.has(key)) return '';
    strings.set(key, value);
    return 'OK';
  },
  async exists(...keys: string[]) {
    return keys.filter((k) => strings.has(k) || hashes.has(k) || zsets.has(k))
      .length;
  },
  async del(...keys: string[]) {
    for (const k of keys) {
      strings.delete(k);
      hashes.delete(k);
      zsets.delete(k);
    }
  },
  async incrBy(key: string, value: number) {
    const next = Number(strings.get(key) ?? 0) + value;
    strings.set(key, String(next));
    return next;
  },
  async expire() {},
  async zAdd(key: string, ...members: ZEntry[]) {
    for (const m of members) zset(key).set(m.member, m.score);
    return members.length;
  },
  async zIncrBy(key: string, member: string, value: number) {
    const next = (zset(key).get(member) ?? 0) + value;
    zset(key).set(member, next);
    return next;
  },
  async zScore(key: string, member: string) {
    return zset(key).get(member);
  },
  async zRank(key: string, member: string) {
    const index = sorted(key).findIndex((e) => e.member === member);
    return index < 0 ? undefined : index;
  },
  async zCard(key: string) {
    return zset(key).size;
  },
  async zRange(
    key: string,
    start: number,
    stop: number,
    options?: { reverse?: boolean }
  ) {
    const list = sorted(key);
    if (options?.reverse) list.reverse();
    return list.slice(start, stop < 0 ? undefined : stop + 1);
  },
  async zRem(key: string, members: string[]) {
    let n = 0;
    for (const m of members) if (zset(key).delete(m)) n++;
    return n;
  },
  async hGet(key: string, field: string) {
    return hashes.get(key)?.get(field);
  },
  async hSet(key: string, values: Record<string, string>) {
    for (const [f, v] of Object.entries(values)) hash(key).set(f, v);
    return Object.keys(values).length;
  },
  async hSetNX(key: string, field: string, value: string) {
    if (hash(key).has(field)) return 0;
    hash(key).set(field, value);
    return 1;
  },
  async hGetAll(key: string) {
    return Object.fromEntries(hashes.get(key) ?? []);
  },
  async hIncrBy(key: string, field: string, value: number) {
    const next = Number(hash(key).get(field) ?? 0) + value;
    hash(key).set(field, String(next));
    return next;
  },
  async hDel(key: string, fields: string[]) {
    let n = 0;
    for (const f of fields) if (hashes.get(key)?.delete(f)) n++;
    return n;
  },
};

/** Mutable per-request context, filled by tools/local/localApi.ts. */
export const context: {
  userId: string | undefined;
  username: string | undefined;
  snoovatar: string | undefined;
  postId: string | undefined;
  postData: unknown;
  subredditName: string;
} = {
  userId: undefined,
  username: undefined,
  snoovatar: undefined,
  postId: 't3_local',
  postData: undefined,
  subredditName: 'PakiaLocal',
};

let postSeq = 0;
export const comments: {
  postId: string;
  text: string;
  runAs: string;
  author: string;
}[] = [];

export const reddit = {
  async submitCustomPost(opts: { title: string; postData?: unknown }) {
    postSeq++;
    const id = `t3_local${postSeq}`;
    console.log(`[local] post created: ${opts.title}`);
    return { id, url: `http://localhost:5173/game.html?post=${id}` };
  },
  async submitComment(opts: { id: string; text: string; runAs?: string }) {
    comments.push({
      postId: opts.id,
      text: opts.text,
      runAs: opts.runAs ?? 'APP',
      author: context.username ?? 'app',
    });
    console.log(
      `[local] comment by ${opts.runAs === 'USER' ? `u/${context.username}` : 'the app'}:\n${opts.text}\n`
    );
    return { distinguish: async () => {} };
  },
  async setUserFlair(opts: { username: string; text?: string }) {
    console.log(`[local] flair for u/${opts.username}: ${opts.text}`);
  },
  async subscribeToCurrentSubreddit() {
    console.log(
      `[local] u/${context.username} joined r/${context.subredditName}`
    );
  },
  async getCurrentUsername() {
    return context.username;
  },
};

export const createServer = () => {
  throw new Error('Not available locally');
};
export const getServerPort = () => 0;
