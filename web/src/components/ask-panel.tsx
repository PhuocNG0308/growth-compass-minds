import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AtSign, ChartSpline, Quote, Send, Sparkles, User, Users, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, type AskStage } from '@/lib/api';
import { useI18n, type Translate } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';
import type { Mention, PostComment, Suggestion } from '@/lib/types';

// the Mind has answered as late as 153 seconds in; the request gives up long before it does
const OUTSTANDING_POLL_MS = 8_000;
const OUTSTANDING_TRIES = 40;

const ICON: Record<string, typeof User> = {
  viewer: User,
  segment: Users,
  video: Video,
  experiment: Sparkles,
};

/**
 * What the answer was drawn from, in the order the Mind was briefed with it, so a `[c3]` in
 * its reply resolves to the third comment it was given.
 */
export type Sources = {
  comments: PostComment[];
  at: (ratio: number) => string;
  onSeek: (ratio: number) => void;
};

export function AskPanel({
  subject,
  suggestions,
  draft,
  sources,
  highlight,
  title = 'ask.title',
  autoFocus = false,
  fill = false,
}: {
  subject: {
    /** `onStage` is optional on purpose: a subject with nothing to report simply never calls it. */
    ask: (question: string, mentions: Mention[], onStage?: (update: AskStage) => void) => Promise<AskResult>;
    chat: () => Promise<Turn[]>;
  };
  suggestions: string[];
  /** A question composed elsewhere — a retention drop-off, say — dropped in for editing. */
  draft?: string;
  /** What the Mind can cite. Without it, citations are dropped rather than shown raw. */
  sources?: Sources;
  /** A moment the reader is pointing at elsewhere; citations of it are marked. */
  highlight?: number | null;
  title?: string;
  autoFocus?: boolean;
  /** Fill the host surface — a drawer or a sheet — and keep the composer off the scroll. */
  fill?: boolean;
}) {
  const { t } = useI18n();
  const [question, setQuestion] = useState('');
  const [tagged, setTagged] = useState<Array<Mention & { label: string }>>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [stage, setStage] = useState<AskStage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    subject.chat().then(setTurns, () => setTurns([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // seeded rather than sent: the creator gets to reword it, and a stray click costs no credits
  useEffect(() => {
    if (draft) setQuestion(draft);
  }, [draft]);

  const busy = pending !== null;
  // the request timed out but the question did not: the server keeps the conversation and
  // reconciles a late reply into it, so the panel only has to keep looking
  const outstanding = !busy && turns.length > 0 && turns.at(-1)!.role === 'creator';

  useEffect(() => {
    if (!outstanding) return;
    let tries = 0;

    const timer = setInterval(() => {
      tries += 1;
      if (tries > OUTSTANDING_TRIES) {
        clearInterval(timer);
        return;
      }
      void subject.chat().then(
        (next) => next.length > turns.length && setTurns(next),
        () => undefined,
      );
    }, OUTSTANDING_POLL_MS);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outstanding, turns.length]);

  async function send(text: string) {
    if (text.trim().length < 3 || pending) return;
    setQuestion('');
    setNotice(null);
    setStage(null);
    setPending(text);
    try {
      const result = await subject.ask(text, tagged.map(({ kind, id }) => ({ kind, id })), setStage);
      // a Mind with no cognition left is not a slow Mind, and telling a creator to wait
      // longer for an answer that cannot come is the one thing this panel must not do
      if (result.outOfCognition) setNotice(t('ask.outOfCognition'));
      else if (result.mindOffline) setNotice(t('ask.offline'));
      else if (result.timedOut) setNotice(t('ask.slow'));
      else if (result.reply == null) setNotice(t('ask.noAnswer'));
      setTagged([]);
      setTurns(await subject.chat());
    } catch {
      setNotice(t('state.error'));
    } finally {
      setPending(null);
      setStage(null);
    }
  }

  const transcript = (turns.length > 0 || busy) && (
    // the answer can take a minute to land; a screen reader gets nothing from a bubble
    // quietly appearing
    <div
      aria-live="polite"
      className={cn('space-y-3 px-4 py-4', !fill && 'max-h-96 overflow-y-auto')}
    >
      {turns.map((turn, i) =>
        turn.role === 'creator' ? (
          <div
            key={i}
            className="bg-secondary ml-auto max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line"
          >
            {turn.text}
          </div>
        ) : (
          <MindTurn key={i} text={turn.text} sources={sources} highlight={highlight} />
        ),
      )}
      {busy && (
        <div className="bg-secondary ml-auto max-w-[85%] rounded-2xl px-4 py-3 text-[15px]">
          {pending}
        </div>
      )}
      {(busy || outstanding) && (
        <div className="bg-muted text-muted-foreground flex max-w-[85%] items-center gap-3 rounded-2xl px-4 py-3 text-[15px]">
          <Typing />
          <span>{busy ? said(stage, t) : t('ask.stillComing')}</span>
        </div>
      )}
    </div>
  );

  const status = (
    <p role="status" aria-live="polite" className="text-muted-foreground px-4 text-sm empty:hidden">
      {notice}
    </p>
  );

  const prompts = !busy && !outstanding && (
    <div className="flex flex-wrap gap-2 px-4 pt-4 pb-1">
      {suggestions.map((key) => (
        <button
          key={key}
          onClick={() => send(t(key))}
          className={cn(
            focusRing,
            'text-muted-foreground hover:border-foreground hover:text-foreground rounded-full border px-4 py-2 text-sm',
          )}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );

  const composer = (
    <Composer
      question={question}
      setQuestion={setQuestion}
      tagged={tagged}
      setTagged={setTagged}
      onSend={send}
      busy={busy}
      autoFocus={autoFocus}
    />
  );

  // the keyboard eats the bottom of a phone screen, so the box it opens for must not be
  // part of what scrolls away above it
  if (fill) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {transcript}
          {status}
          {prompts}
        </div>
        {composer}
      </div>
    );
  }

  return (
    <Card className="mt-4 gap-0 py-0">
      <p className="flex items-center gap-2 border-b px-4 py-3 font-medium">
        <Sparkles className="size-4" />
        {t(title)}
      </p>
      {transcript}
      {status}
      {prompts}
      {composer}
    </Card>
  );
}

const CITED = /\[c(\d+)\]|\[t=([\d.]+)\]/g;
// one retention sample either side, so pointing near a cited moment still lights it
const NEARBY = 0.03;

/**
 * The Mind tags the comment or timestamp behind a claim. These resolve the tag: the comment
 * quoted below the answer, or that second on the retention curve.
 */
function MindTurn({
  text,
  sources,
  highlight,
}: {
  text: string;
  sources?: Sources;
  highlight?: number | null;
}) {
  const { t } = useI18n();
  const [quoted, setQuoted] = useState<PostComment | null>(null);

  const badge = cn(
    focusRing,
    'bg-background hover:text-foreground text-muted-foreground mx-1 inline-flex items-center gap-1 rounded-full border px-2 py-1 align-baseline text-xs leading-none font-medium',
  );

  const parts: ReactNode[] = [];
  let read = 0;

  for (const found of text.matchAll(CITED)) {
    const [tag, comment, ratio] = found;
    parts.push(text.slice(read, found.index));
    read = found.index + tag.length;

    const source = comment ? sources?.comments[Number(comment) - 1] : undefined;
    if (source) {
      parts.push(
        <button
          key={`${found.index}`}
          onClick={() => setQuoted((open) => (open === source ? null : source))}
          className={badge}
        >
          <Quote className="size-3" />
          {source.displayName}
        </button>,
      );
      continue;
    }

    if (ratio && sources) {
      const at = Number(ratio);
      // the same second the pointer is on in the chart beside this
      const lit = highlight != null && Math.abs(at - highlight) < NEARBY;
      parts.push(
        <button
          key={`${found.index}`}
          onClick={() => sources.onSeek(at)}
          title={t('ask.seeMoment')}
          className={cn(badge, lit && 'border-foreground text-foreground bg-accent')}
        >
          <ChartSpline className="size-3" />
          {sources.at(at)}
        </button>,
      );
      continue;
    }
    // a tag pointing at something we were not given is noise, not evidence
  }

  parts.push(text.slice(read));

  return (
    <div className="bg-muted max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line">
      {parts}
      {quoted && (
        <blockquote className="mt-3 border-l pl-3 whitespace-normal">
          <a
            href={`#/viewer/${encodeURIComponent(quoted.ytAuthorId)}`}
            className={cn(focusRing, 'rounded-md text-xs font-semibold hover:underline')}
          >
            {quoted.displayName}
          </a>
          <p className="text-muted-foreground mt-1 text-sm">{quoted.text}</p>
        </blockquote>
      )}
    </div>
  );
}

/** Movement here is load-bearing: a still bubble reads as a stalled request. */
function Typing() {
  return (
    <span className="typing flex shrink-0 items-center gap-1" aria-hidden>
      <i className="bg-muted-foreground size-2 rounded-full" />
      <i className="bg-muted-foreground size-2 rounded-full" />
      <i className="bg-muted-foreground size-2 rounded-full" />
    </span>
  );
}

export type Turn = { role: 'creator' | 'mind'; text: string };
export type AskResult = {
  reply?: string | null;
  timedOut: boolean;
  /** No Mind configured at all. */
  mindOffline?: boolean;
  /** Configured, but with nothing left to think with. */
  outOfCognition?: boolean;
};

/** No token stream to render, so the wait reports which step is running. */
function said(stage: AskStage | null, t: Translate): string {
  if (stage?.stage === 'reading') return t('ask.stageReading');
  if (stage?.stage === 'briefed') return t('ask.stageBriefed', { n: stage.comments });
  if (stage?.stage === 'sent') return t('ask.stageSent');
  if (stage?.stage === 'waiting') return t('ask.stageWaiting', { s: stage.elapsedS });
  return t('ask.thinking');
}

function Composer({
  question,
  setQuestion,
  tagged,
  setTagged,
  onSend,
  busy,
  autoFocus,
}: {
  question: string;
  setQuestion: (value: string) => void;
  tagged: Array<Mention & { label: string }>;
  setTagged: (value: Array<Mention & { label: string }>) => void;
  onSend: (text: string) => void;
  busy: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const [picker, setPicker] = useState<string | null>(null);
  const [options, setOptions] = useState<Suggestion[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);

  // arriving from "Ask Mind" should land on the box, not near it
  useEffect(() => {
    if (!autoFocus) return;
    input.current?.scrollIntoView({ block: 'center' });
    input.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (picker === null) return;
    let live = true;
    api.mentions(picker).then((rows) => live && setOptions(rows), () => live && setOptions([]));
    return () => {
      live = false;
    };
  }, [picker]);

  useEffect(() => {
    const node = input.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [question]);

  // an @ anywhere in the field opens the picker and everything after it is the query
  function onChange(value: string) {
    setQuestion(value);
    const at = value.lastIndexOf('@');
    setPicker(at === -1 ? null : value.slice(at + 1));
  }

  function choose(option: Suggestion) {
    if (!tagged.some((item) => item.kind === option.kind && item.id === option.id)) {
      setTagged([...tagged, { kind: option.kind as Mention['kind'], id: option.id, label: option.label }]);
    }
    const at = question.lastIndexOf('@');
    setQuestion(at === -1 ? question : question.slice(0, at));
    setPicker(null);
    input.current?.focus();
  }

  return (
    <div className="relative border-t">
      {picker !== null && options.length > 0 && (
        <div className="bg-popover absolute bottom-full left-3 z-30 mb-2 max-h-72 w-[min(26rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border shadow-lg">
          {options.map((option) => {
            const Glyph = ICON[option.kind] ?? AtSign;
            return (
              <button
                key={`${option.kind}:${option.id}`}
                onClick={() => choose(option)}
                className="hover:bg-accent flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <Glyph className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{option.label}</span>
                  <span className="text-muted-foreground block truncate text-xs">{option.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {tagged.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {tagged.map((item) => (
            <span
              key={`${item.kind}:${item.id}`}
              className="bg-secondary flex items-center gap-2 rounded-full py-1 pr-2 pl-3 text-xs font-medium"
            >
              <AtSign className="size-3" />
              <span className="max-w-40 truncate">{item.label}</span>
              <button
                onClick={() => setTagged(tagged.filter((other) => other !== item))}
                aria-label={t('ask.untag')}
                className="hover:bg-input rounded-full p-1"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend(question);
        }}
        className="flex items-end gap-2 p-3"
      >
        <textarea
          ref={input}
          rows={1}
          value={question}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setPicker(null);
            // a question is one thought, so Enter sends it; a pasted script still needs newlines
            if (event.key === 'Enter' && !event.shiftKey && picker === null) {
              event.preventDefault();
              onSend(question);
            }
          }}
          placeholder={t('ask.placeholder')}
          className={cn(
            focusRing,
            'focus-visible:border-ring max-h-40 min-w-0 flex-1 resize-none rounded-xl border px-4 py-3 text-[15px] outline-none',
          )}
        />
        <Button type="submit" size="icon" disabled={busy} aria-label={t('ask.send')} className="self-end">
          <Send />
        </Button>
      </form>
    </div>
  );
}
