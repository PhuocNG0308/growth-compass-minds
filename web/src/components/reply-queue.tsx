import { useRef, useState } from 'react';
import { MessageSquare, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, Failed, List, Loading } from '@/components/shell';
import { useToast } from '@/components/toast';
import { SegmentBadge } from '@/pages/feed';
import { Thumb } from '@/components/thumb';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { ReplyTarget, Segment } from '@/lib/types';

const PAGE = 8;

export function ReplyQueue({ segment }: { segment?: Segment | null }) {
  const { t } = useI18n();
  const [round, setRound] = useState(0);
  const [shown, setShown] = useState(PAGE);
  const [answered, setAnswered] = useState<string[]>([]);
  const cards = useRef<Array<HTMLDivElement | null>>([]);
  const { data, loading, error } = useAsync(() => api.replies(), [round]);

  if (loading) return <Loading rows={3} />;
  if (error) return <Failed onRetry={() => setRound((n) => n + 1)} />;

  const queue = (data?.queue ?? [])
    .filter((target) => !answered.includes(target.ytCommentId))
    .filter((target) => !segment || target.segment === segment);

  if (!queue.length) return <Empty>{t('empty.queue')}</Empty>;

  const rows = queue.slice(0, shown);

  return (
    <>
      {!data!.enabled ? (
        <p className="text-muted-foreground border-b py-3 text-sm">{t('reply.disabled')}</p>
      ) : (
        rows.length > 1 && <p className="text-muted-foreground mb-3 text-xs">{t('reply.keys')}</p>
      )}

      <List>
        {rows.map((target, index) => (
          <ReplyRow
            key={target.ytCommentId}
            target={target}
            canSend={data!.enabled}
            first={index === 0}
            bind={(node) => {
              cards.current[index] = node;
            }}
            onMove={(delta) =>
              cards.current[Math.min(Math.max(index + delta, 0), rows.length - 1)]?.focus()
            }
            onSent={() => setAnswered((ids) => [...ids, target.ytCommentId])}
          />
        ))}
      </List>

      {queue.length > shown && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          className={cn(
            focusRing,
            'text-muted-foreground hover:text-foreground w-full rounded-md py-4 text-sm font-medium',
          )}
        >
          {t('queue.more', { n: String(queue.length - shown) })}
        </button>
      )}
    </>
  );
}

function ReplyRow({
  target,
  canSend,
  first,
  bind,
  onMove,
  onSent,
}: {
  target: ReplyTarget;
  canSend: boolean;
  first: boolean;
  bind: (node: HTMLDivElement | null) => void;
  onMove: (delta: number) => void;
  onSent: () => void;
}) {
  const { t, plural } = useI18n();
  const f = useFormat();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'send' | 'overwrite' | null>(null);

  async function draft() {
    setConfirm(null);
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
    setConfirm(null);
    setSending(true);
    setNote(null);
    try {
      await api.sendReply(target.ytCommentId, text);
      notify(t('reply.sent'));
      onSent();
    } catch {
      setNote(t('reply.failed'));
      setSending(false);
    }
  }

  const SHORTCUTS: Record<string, () => void> = {
    j: () => onMove(1),
    k: () => onMove(-1),
    e: () => canSend && setOpen(true),
  };

  return (
    <div
      ref={bind}
      // one stop in the tab order for the whole queue; j/k walk it from there
      tabIndex={first ? 0 : -1}
      aria-keyshortcuts="j k e"
      onKeyDown={(event) => {
        // the moment focus is in the composer, every key belongs to the reply being written
        if (event.target !== event.currentTarget) return;
        const act = SHORTCUTS[event.key.toLowerCase()];
        if (!act) return;
        event.preventDefault();
        act();
      }}
      className={cn(focusRing, 'flex gap-4 py-4')}
    >
      <a
        href={`#/post/${encodeURIComponent(target.ytVideoId)}`}
        className={cn(focusRing, 'hidden w-24 shrink-0 self-start @md:block')}
      >
        <Thumb url={target.thumbnailUrl} title={target.videoTitle} />
      </a>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <a
            href={`#/viewer/${encodeURIComponent(target.ytAuthorId)}`}
            className={cn(focusRing, 'text-sm font-semibold hover:underline')}
          >
            {target.displayName}
          </a>
          <SegmentBadge segment={target.segment} />
          <span className="text-muted-foreground text-xs">
            {plural('fan.comments', target.viewerCommentCount)} · {f.since(target.publishedAt)}
          </span>
        </div>

        <p className="text-[15px] leading-relaxed">{target.text}</p>
        <p className="text-muted-foreground mt-1 truncate text-xs">{target.videoTitle}</p>

        {/* the composer stays shut until asked for: forty open textareas is not a queue */}
        {!open ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={!canSend}
            onClick={() => setOpen(true)}
          >
            <MessageSquare />
            {t('reply.open')}
          </Button>
        ) : (
          <div className="mt-3">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              autoFocus
              placeholder={t('reply.placeholder')}
              className={cn(
                focusRing,
                'focus-visible:border-primary w-full resize-y rounded-lg border px-4 py-2 text-[15px]',
              )}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => setConfirm('send')}
                disabled={sending || text.trim().length < 2}
              >
                <Send />
                {t('reply.send')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (text.trim() ? setConfirm('overwrite') : draft())}
                disabled={drafting || sending}
              >
                <Sparkles className={cn(drafting && 'animate-pulse')} />
                {t('reply.draft')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={sending}>
                {t('reply.cancel')}
              </Button>
            </div>
          </div>
        )}

        <p aria-live="polite" className="text-muted-foreground mt-2 text-sm empty:hidden">
          {note}
        </p>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(next) => !next && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(confirm === 'overwrite' ? 'reply.overwriteTitle' : 'reply.confirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {confirm === 'overwrite'
                ? t('reply.overwriteBody')
                : t('reply.confirmBody', { title: target.videoTitle })}
            </DialogDescription>
          </DialogHeader>

          {confirm === 'send' && (
            <p className="bg-muted rounded-lg px-4 py-3 text-[15px] whitespace-pre-wrap">{text}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t('reply.cancel')}
            </Button>
            <Button onClick={confirm === 'overwrite' ? draft : send}>
              {t(confirm === 'overwrite' ? 'reply.overwriteGo' : 'reply.confirmSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
