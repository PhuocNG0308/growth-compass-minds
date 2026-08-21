import { useEffect, useState } from 'react';
import { Bot, Search, User } from 'lucide-react';
import { Empty, Failed, List, Loading, SectionTitle } from '@/components/shell';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { ChatHit, ChatThreadDigest } from '@/lib/types';

const href = (kind: string, id: string) =>
  kind === 'video' ? `#/post/${encodeURIComponent(id)}` : `#/viewer/${encodeURIComponent(id)}`;

export function Chats() {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [round, setRound] = useState(0);

  // searching on every keystroke would fire a full-text query per character
  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), 300);
    return () => clearTimeout(timer);
  }, [typed]);

  const threads = useAsync(() => api.chats(), [round]);
  const hits = useAsync(() => (query.length < 2 ? Promise.resolve([]) : api.searchChat(query)), [query]);

  return (
    <>
      <SectionTitle>{t('section.chats')}</SectionTitle>

      <div className="relative mb-4">
        <Search className="text-muted-foreground pointer-events-none absolute top-3 left-4 size-4" />
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={t('chats.search')}
          aria-label={t('chats.search')}
          className={cn(
            focusRing,
            'focus-visible:border-primary w-full rounded-lg border py-3 pr-4 pl-11 text-[15px] outline-none',
          )}
        />
      </div>

      {query.length >= 2 ? (
        <Results query={query} state={hits} />
      ) : threads.loading ? (
        <Loading rows={3} height="h-20" />
      ) : threads.error ? (
        <Failed onRetry={() => setRound((n) => n + 1)} />
      ) : threads.data?.length ? (
        <List>
          {threads.data.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} />
          ))}
        </List>
      ) : (
        <Empty>{t('empty.chats')}</Empty>
      )}
    </>
  );
}

function Results({ query, state }: { query: string; state: ReturnType<typeof useAsync<ChatHit[]>> }) {
  const { t } = useI18n();
  const f = useFormat();

  if (state.loading) return <Loading rows={2} height="h-20" />;
  if (state.error) return <Failed />;
  if (!state.data?.length) return <Empty>{t('chats.noHits', { q: query })}</Empty>;

  return (
    <>
      <p className="text-muted-foreground mb-3 text-sm">
        {t('chats.hits', { n: String(state.data.length) })}
      </p>
      <List>
        {state.data.map((hit) => (
          <a
            key={`${hit.threadId}-${hit.createdAt}`}
            href={href(hit.subjectKind, hit.subjectId)}
            className={cn(focusRing, 'hover:bg-accent block p-4')}
          >
            <div className="flex items-center gap-2">
              {hit.role === 'mind' ? (
                <Bot className="text-primary size-4 shrink-0" />
              ) : (
                <User className="text-muted-foreground size-4 shrink-0" />
              )}
              <span className="truncate text-sm font-medium">{hit.title}</span>
              <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                {f.since(hit.createdAt)}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{hit.body}</p>
          </a>
        ))}
      </List>
    </>
  );
}

function ThreadRow({ thread }: { thread: ChatThreadDigest }) {
  const { t, plural } = useI18n();
  const f = useFormat();

  return (
    <a
      href={href(thread.subjectKind, thread.subjectId)}
      className={cn(focusRing, 'hover:bg-accent block p-4')}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[15px] font-medium">{thread.title}</span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {f.since(thread.lastMessageAt)}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{thread.lastBody}</p>
      <p className="text-muted-foreground mt-1 text-xs">
        {plural('chat.messages', thread.messageCount)} · {t(`subject.${thread.subjectKind}`)}
      </p>
    </a>
  );
}
