import { useState } from 'react';
import { Search, Send, Sparkles } from 'lucide-react';
import { useToast } from '@/components/toast';
import { Thumb } from '@/components/thumb';
import { SegmentBadge } from '@/pages/feed';
import {
  Empty,
  Failed,
  Fold,
  Group,
  Sheet,
  Skeletons,
  Strip,
  StripItem,
} from '@/mobile/kit';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { ChatHit, ChatThreadDigest, ReplyTarget, Segment } from '@/lib/types';

const TIERS = ['superfan', 'potential', 'newcomer'] as const;
type Tier = 'all' | Segment;

const AVATAR: Record<Segment, string> = {
  superfan: 'bg-primary text-primary-foreground',
  potential: 'bg-warning/15 text-warning',
  newcomer: 'bg-muted text-muted-foreground',
};

export function MobileAudience() {
  const { t } = useI18n();
  const f = useFormat();
  const [tier, setTier] = useState<Tier>('all');
  const [limit, setLimit] = useState(40);
  const [round, setRound] = useState(0);
  const { data, loading, error } = useAsync(
    () => api.audience(tier === 'all' ? null : tier, limit),
    [tier, limit, round],
  );

  if (loading) return <Skeletons />;
  if (error || !data) return <Failed onRetry={() => setRound((n) => n + 1)} />;

  const counts = data.segmentCounts;
  const total = TIERS.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
  const inTier = tier === 'all' ? total : (counts[tier] ?? 0);

  return (
    <>
      <Strip snap="none" className="pb-3">
        {(['all', ...TIERS] as const).map((key) => (
          <StripItem key={key}>
            <button
              onClick={() => {
                setTier(key);
                setLimit(40);
              }}
              aria-pressed={key === tier}
              className={cn(
                focusRing,
                'min-h-11 rounded-full border px-4 text-sm font-medium',
                key === tier ? 'border-primary bg-primary/12 text-primary' : 'text-muted-foreground',
              )}
            >
              {t(`filter.${key}`)}
              <span className="tabular ml-2 opacity-70">
                {key === 'all' ? total : (counts[key] ?? 0)}
              </span>
            </button>
          </StripItem>
        ))}
      </Strip>

      <p className="text-muted-foreground px-4 pb-2 text-sm text-pretty">{t(`tier.hint.${tier}`)}</p>

      {/* the reply queue is the job; the roster is reference, so it starts folded */}
      <Group title={t('section.queue')}>
        <ReplyQueue segment={tier === 'all' ? null : tier} />
      </Group>

      <div className="mt-8">
        <Fold title={t('section.fans')} count={inTier}>
          {data.superfans.length ? (
            <>
              <div className="divide-y border-t">
                {data.superfans.map((fan) => (
                  <a
                    key={fan.ytAuthorId}
                    href={`#/viewer/${encodeURIComponent(fan.ytAuthorId)}`}
                    className={cn(focusRing, 'flex min-h-16 items-center gap-3 px-4 py-3')}
                  >
                    <span
                      className={cn(
                        'grid size-10 shrink-0 place-items-center rounded-full font-semibold',
                        AVATAR[fan.segment],
                      )}
                    >
                      {fan.displayName.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{fan.displayName}</span>
                        <SegmentBadge segment={fan.segment} />
                      </span>
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {t('fan.last', { when: f.since(fan.lastSeenAt) })}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm font-semibold">{fan.commentCount}</span>
                  </a>
                ))}
              </div>
              {inTier > data.superfans.length && (
                <button
                  onClick={() => setLimit((n) => n + 40)}
                  className={cn(focusRing, 'text-primary min-h-12 w-full text-sm font-medium')}
                >
                  {t('queue.more', { n: String(inTier - data.superfans.length) })}
                </button>
              )}
            </>
          ) : (
            <Empty>{t(tier === 'all' ? 'empty.fans' : 'empty.tierFans')}</Empty>
          )}
        </Fold>
      </div>
    </>
  );
}

const PAGE = 5;

function ReplyQueue({ segment }: { segment: Segment | null }) {
  const { t } = useI18n();
  const [round, setRound] = useState(0);
  const [shown, setShown] = useState(PAGE);
  const [answered, setAnswered] = useState<string[]>([]);
  const [target, setTarget] = useState<ReplyTarget | null>(null);
  const { data, loading, error } = useAsync(() => api.replies(), [round]);

  if (loading) return <Skeletons rows={2} />;
  if (error) return <Failed onRetry={() => setRound((n) => n + 1)} />;

  const queue = (data?.queue ?? [])
    .filter((item) => !answered.includes(item.ytCommentId))
    .filter((item) => !segment || item.segment === segment);

  if (!queue.length) return <Empty>{t('empty.queue')}</Empty>;

  return (
    <>
      {!data!.enabled && (
        <p className="text-muted-foreground px-4 pb-2 text-sm">{t('reply.disabled')}</p>
      )}

      <div className="space-y-3 px-4">
        {queue.slice(0, shown).map((item) => (
          <QueueCard
            key={item.ytCommentId}
            target={item}
            canSend={data!.enabled}
            onOpen={() => setTarget(item)}
          />
        ))}
      </div>

      {queue.length > shown && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          className={cn(focusRing, 'text-primary min-h-12 w-full text-sm font-medium')}
        >
          {t('queue.more', { n: String(queue.length - shown) })}
        </button>
      )}

      {target && (
        <Composer
          target={target}
          onClose={() => setTarget(null)}
          onSent={() => {
            setAnswered((ids) => [...ids, target.ytCommentId]);
            setTarget(null);
          }}
        />
      )}
    </>
  );
}

function QueueCard({
  target,
  canSend,
  onOpen,
}: {
  target: ReplyTarget;
  canSend: boolean;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const f = useFormat();

  return (
    <article className="bg-card rounded-2xl border p-4">
      <div className="flex items-center gap-2">
        <a
          href={`#/viewer/${encodeURIComponent(target.ytAuthorId)}`}
          className={cn(focusRing, 'text-sm font-semibold')}
        >
          {target.displayName}
        </a>
        <SegmentBadge segment={target.segment} />
        <span className="text-muted-foreground ml-auto text-xs">{f.since(target.publishedAt)}</span>
      </div>

      <p className="mt-2 text-[15px] leading-relaxed text-pretty">{target.text}</p>

      <div className="mt-3 flex items-center gap-2">
        <Thumb url={target.thumbnailUrl} title={target.videoTitle} className="w-12 shrink-0" />
        <span className="text-muted-foreground line-clamp-2 text-xs">{target.videoTitle}</span>
      </div>

      <button
        onClick={onOpen}
        disabled={!canSend}
        className={cn(
          focusRing,
          'border-input mt-3 min-h-12 w-full rounded-full border text-sm font-semibold disabled:opacity-40',
        )}
      >
        {t('reply.open')}
      </button>
    </article>
  );
}

/** Composing on a phone deserves the whole lower half of the screen, not a two-row box. */
function Composer({
  target,
  onClose,
  onSent,
}: {
  target: ReplyTarget;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useI18n();
  const notify = useToast();
  const [text, setText] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function draft() {
    setDrafting(true);
    setNote(null);
    try {
      const result = await api.draftReply(target.ytCommentId, target.ytAuthorId);
      if (result.reply) setText(result.reply);
      else setNote(t(result.mindOffline ? 'ask.offline' : 'ask.slow'));
    } catch {
      setNote(t('state.error'));
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    setConfirm(false);
    setSending(true);
    try {
      await api.sendReply(target.ytCommentId, text);
      notify(t('reply.sent'));
      onSent();
    } catch {
      setNote(t('reply.failed'));
      setSending(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      title={target.displayName}
      footer={
        <div className="flex gap-2">
          <button
            onClick={draft}
            disabled={drafting || sending}
            className={cn(
              focusRing,
              'border-input flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-semibold disabled:opacity-50',
            )}
          >
            <Sparkles className={cn('size-5', drafting && 'animate-pulse')} />
            {t('reply.draft')}
          </button>
          <button
            onClick={() => setConfirm(true)}
            disabled={sending || text.trim().length < 2}
            className={cn(
              focusRing,
              'bg-primary text-primary-foreground flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-50',
            )}
          >
            <Send className="size-5" />
            {t('reply.send')}
          </button>
        </div>
      }
    >
      <div className="px-4 pb-4">
        <p className="bg-muted rounded-xl px-4 py-3 text-[15px] leading-relaxed text-pretty">
          {target.text}
        </p>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          autoFocus
          placeholder={t('reply.placeholder')}
          className={cn(
            focusRing,
            'focus-visible:border-primary mt-3 w-full resize-none rounded-xl border px-4 py-3 text-[15px]',
          )}
        />

        <p aria-live="polite" className="text-muted-foreground mt-2 text-sm empty:hidden">
          {note}
        </p>

        {confirm && (
          <div className="border-destructive/30 bg-destructive/5 mt-3 rounded-xl border p-4">
            <p className="text-sm font-medium">{t('reply.confirmTitle')}</p>
            <p className="text-muted-foreground mt-1 text-sm text-pretty">
              {t('reply.confirmBody', { title: target.videoTitle })}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setConfirm(false)}
                className={cn(focusRing, 'border-input min-h-11 flex-1 rounded-full border text-sm font-medium')}
              >
                {t('reply.cancel')}
              </button>
              <button
                onClick={send}
                className={cn(
                  focusRing,
                  'bg-destructive min-h-11 flex-1 rounded-full text-sm font-semibold text-white',
                )}
              >
                {t('reply.confirmSend')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function MobileChats() {
  const { t } = useI18n();
  const f = useFormat();
  const [typed, setTyped] = useState('');
  const query = typed.trim();

  const threads = useAsync(() => api.chats(), []);
  const hits = useAsync<ChatHit[]>(
    () => (query.length < 2 ? Promise.resolve([]) : api.searchChat(query)),
    [query],
  );

  const href = (kind: string, id: string) =>
    kind === 'video' ? `#/post/${encodeURIComponent(id)}` : `#/viewer/${encodeURIComponent(id)}`;

  return (
    <>
      <div className="bg-background/90 sticky top-[var(--chrome)] z-20 px-4 pb-3 backdrop-blur">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-3.5 left-4 size-4" />
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={t('chats.search')}
            aria-label={t('chats.search')}
            className={cn(
              focusRing,
              'focus-visible:border-primary min-h-12 w-full rounded-full border pr-4 pl-11 text-[15px] outline-none',
            )}
          />
        </div>
      </div>

      {query.length >= 2 ? (
        hits.loading ? (
          <Skeletons rows={2} />
        ) : hits.data?.length ? (
          <div className="divide-y border-y">
            {hits.data.map((hit) => (
              <a
                key={`${hit.threadId}-${hit.createdAt}`}
                href={href(hit.subjectKind, hit.subjectId)}
                className={cn(focusRing, 'block px-4 py-4')}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{hit.title}</span>
                  <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                    {f.since(hit.createdAt)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{hit.body}</p>
              </a>
            ))}
          </div>
        ) : (
          <Empty>{t('chats.noHits', { q: query })}</Empty>
        )
      ) : threads.loading ? (
        <Skeletons rows={3} />
      ) : threads.data?.length ? (
        <div className="divide-y border-y">
          {threads.data.map((thread: ChatThreadDigest) => (
            <a
              key={thread.id}
              href={href(thread.subjectKind, thread.subjectId)}
              className={cn(focusRing, 'block px-4 py-4')}
            >
              <div className="flex items-center gap-3">
                <span className="truncate font-medium">{thread.title}</span>
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                  {f.since(thread.lastMessageAt)}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{thread.lastBody}</p>
            </a>
          ))}
        </div>
      ) : (
        <Empty>{t('empty.chats')}</Empty>
      )}
    </>
  );
}
