import { sql } from './client.ts';
import type { ChatMessage, ChatSubject, ChatThread } from '../types.ts';

export type Ref = { kind: string; refId: string };

export async function ensureThread(input: {
  channelId: string;
  subjectKind: ChatSubject;
  subjectId: string;
  alias: string;
  title: string;
}): Promise<ChatThread> {
  const [row] = await sql<ChatThread[]>`
    insert into chat_threads ${sql(input)}
    on conflict (channel_id, subject_kind, subject_id) do update set title = excluded.title
    returning *`;
  return row!;
}

export async function appendMessage(
  threadId: string,
  role: 'creator' | 'mind',
  body: string,
  refs: Ref[] = [],
): Promise<ChatMessage> {
  return sql.begin(async (tx) => {
    const [message] = await tx<ChatMessage[]>`
      insert into chat_messages (thread_id, role, body)
      values (${threadId}, ${role}, ${body})
      returning *`;

    if (refs.length > 0) {
      await tx`
        insert into chat_refs ${tx(refs.map((ref) => ({ messageId: message!.id, ...ref })))}
        on conflict do nothing`;
    }

    await tx`update chat_threads set last_message_at = now() where id = ${threadId}`;
    return message!;
  });
}

export async function threadMessages(threadId: string, limit = 60): Promise<ChatMessage[]> {
  return sql<ChatMessage[]>`
    select * from chat_messages where thread_id = ${threadId}
    order by created_at limit ${limit}`;
}

export async function findThread(
  channelId: string,
  subjectKind: ChatSubject,
  subjectId: string,
): Promise<ChatThread | undefined> {
  const [row] = await sql<ChatThread[]>`
    select * from chat_threads
    where channel_id = ${channelId} and subject_kind = ${subjectKind} and subject_id = ${subjectId}`;
  return row;
}

export type ThreadDigest = {
  id: string;
  subjectKind: ChatSubject;
  subjectId: string;
  title: string;
  lastMessageAt: Date;
  messageCount: number;
  lastBody: string;
};

const DIGEST = sql`
  select t.id, t.subject_kind, t.subject_id, t.title, t.last_message_at,
         count(m.id)::int as message_count,
         coalesce((select body from chat_messages
                   where thread_id = t.id order by created_at desc limit 1), '') as last_body
  from chat_threads t left join chat_messages m on m.thread_id = t.id`;

export async function recentThreads(channelId: string, limit = 30): Promise<ThreadDigest[]> {
  return sql<ThreadDigest[]>`
    ${DIGEST}
    where t.channel_id = ${channelId}
    group by t.id
    having count(m.id) > 0
    order by t.last_message_at desc
    limit ${limit}`;
}

/** Every thread that mentioned this thing, so a person's history splits by video. */
export async function threadsMentioning(
  channelId: string,
  kind: string,
  refId: string,
): Promise<ThreadDigest[]> {
  return sql<ThreadDigest[]>`
    ${DIGEST}
    where t.channel_id = ${channelId}
      and exists (
        select 1 from chat_messages cm join chat_refs r on r.message_id = cm.id
        where cm.thread_id = t.id and r.kind = ${kind} and r.ref_id = ${refId}
      )
    group by t.id
    order by t.last_message_at desc`;
}

export type ChatHit = {
  threadId: string;
  title: string;
  subjectKind: ChatSubject;
  subjectId: string;
  role: string;
  body: string;
  createdAt: Date;
};

/** Tag filter plus free text, the way a Discord search narrows before it matches. */
export async function searchChat(
  channelId: string,
  opts: { text?: string; refs?: Ref[]; limit?: number },
): Promise<ChatHit[]> {
  const refs = opts.refs ?? [];
  const text = opts.text?.trim();

  return sql<ChatHit[]>`
    select m.thread_id, t.title, t.subject_kind, t.subject_id, m.role, m.body, m.created_at
    from chat_messages m join chat_threads t on t.id = m.thread_id
    where t.channel_id = ${channelId}
      ${text ? sql`and to_tsvector('simple', m.body) @@ plainto_tsquery('simple', ${text})` : sql``}
      ${
        refs.length > 0
          ? // a row-constructor IN list is not something postgres can parse from a bind
            // parameter, so the pairs go in as two parallel arrays and get zipped back
            sql`and exists (
              select 1 from chat_refs r
              join unnest(${refs.map((ref) => ref.kind)}::text[], ${refs.map((ref) => ref.refId)}::text[])
                as wanted(kind, ref_id)
                on wanted.kind = r.kind and wanted.ref_id = r.ref_id
              where r.message_id = m.id
            )`
          : sql``
      }
    order by m.created_at desc
    limit ${opts.limit ?? 25}`;
}
