import { createMindsClient } from '@animocabrands/minds-client-lib';
import { env } from '../env.ts';

export const mindEnabled = Boolean(env.MINDS_BUILDER_API_KEY);

type Client = ReturnType<typeof createMindsClient>;

let session: Promise<{ client: Client; mindId: string }> | null = null;
const conversations = new Map<string, Promise<void>>();

export function mindSession() {
  // a rejected promise left in place would turn one network blip into a dead Mind until restart
  session ??= (async () => {
    // passing the key explicitly: the library reads process.env when its module loads,
    // which happens before env.ts gets a chance to read .env
    const client = createMindsClient({ builderApiKey: env.MINDS_BUILDER_API_KEY });
    const minds = await client.listMinds();
    const mindId = env.MIND_ID ?? minds[0]?.mindId;
    if (!mindId) throw new Error('no Mind available on this builder account');
    return { client, mindId };
  })();
  session.catch(() => {
    session = null;
  });
  return session;
}

export async function conversation(alias: string): Promise<{ client: Client; alias: string }> {
  const { client, mindId } = await mindSession();
  let ready = conversations.get(alias);
  if (!ready) {
    ready = client.ensureConversation(alias, mindId).then(() => undefined);
    conversations.set(alias, ready);
    ready.catch(() => conversations.delete(alias));
  }
  await ready;
  return { client, alias };
}

const BALANCE_TTL_MS = 60_000;
let balance: { at: number; cognition: number | null } = { at: 0, cognition: null };

let refreshing: Promise<void> | null = null;

/**
 * Last known cognition balance. Never awaits the network: /api/me is on the critical path of
 * every page load, and the first call after a restart would otherwise block on Minds. A stale
 * or null answer only delays the warning by one request.
 */
export function cognition(): number | null {
  if (!mindEnabled) return null;
  if (Date.now() - balance.at > BALANCE_TTL_MS) void refreshCognition();
  return balance.cognition;
}

export function refreshCognition(): Promise<void> {
  refreshing ??= mindSession()
    .then(({ client, mindId }) => client.getCognitionBalance(mindId))
    .then((row) => {
      balance = { at: Date.now(), cognition: typeof row.cognition === 'number' ? row.cognition : null };
    })
    .catch(() => {
      balance = { at: Date.now(), cognition: balance.cognition };
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function notifyMind(messageText: string): Promise<void> {
  if (!mindEnabled) {
    console.warn('[mind] MINDS_BUILDER_API_KEY unset, skipping:', messageText.slice(0, 120));
    return;
  }
  const { client, alias } = await conversation(env.MIND_CONVERSATION_ALIAS);
  await client.sendMessage({ alias, messageText });
}
