import { createMindsClient } from '@animocabrands/minds-client-lib';
import { env } from '../env.ts';

export const mindEnabled = Boolean(env.MINDS_BUILDER_API_KEY);

type Client = ReturnType<typeof createMindsClient>;

let session: Promise<{ client: Client; mindId: string }> | null = null;
const conversations = new Map<string, Promise<void>>();

function connect() {
  session ??= (async () => {
    // passing the key explicitly: the library reads process.env when its module loads,
    // which happens before env.ts gets a chance to read .env
    const client = createMindsClient({ builderApiKey: env.MINDS_BUILDER_API_KEY });
    const minds = await client.listMinds();
    const mindId = env.MIND_ID ?? minds[0]?.mindId;
    if (!mindId) throw new Error('no Mind available on this builder account');
    return { client, mindId };
  })();
  return session;
}

export async function conversation(alias: string): Promise<{ client: Client; alias: string }> {
  const { client, mindId } = await connect();
  let ready = conversations.get(alias);
  if (!ready) {
    ready = client.ensureConversation(alias, mindId).then(() => undefined);
    conversations.set(alias, ready);
  }
  await ready;
  return { client, alias };
}

export async function notifyMind(messageText: string): Promise<void> {
  if (!mindEnabled) {
    console.warn('[mind] MINDS_BUILDER_API_KEY unset, skipping:', messageText.slice(0, 120));
    return;
  }
  const { client, alias } = await conversation(env.MIND_CONVERSATION_ALIAS);
  await client.sendMessage({ alias, messageText });
}
