import { useEffect, useRef, useState } from 'react';
import { AtSign, Send, Sparkles, User, Users, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';
import type { Mention, Suggestion } from '@/lib/types';

const ICON: Record<string, typeof User> = {
  viewer: User,
  segment: Users,
  video: Video,
  experiment: Sparkles,
};

export function AskPanel({
  subject,
  suggestions,
  title = 'ask.title',
  autoFocus = false,
}: {
  subject: { ask: (question: string, mentions: Mention[]) => Promise<AskResult>; chat: () => Promise<Turn[]> };
  suggestions: string[];
  title?: string;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const [question, setQuestion] = useState('');
  const [tagged, setTagged] = useState<Array<Mention & { label: string }>>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    subject.chat().then(setTurns, () => setTurns([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string) {
    if (text.trim().length < 3 || pending) return;
    setQuestion('');
    setNotice(null);
    setPending(text);
    try {
      const result = await subject.ask(text, tagged.map(({ kind, id }) => ({ kind, id })));
      if (result.mindOffline) setNotice(t('ask.offline'));
      else if (result.timedOut) setNotice(t('ask.slow'));
      setTagged([]);
      setTurns(await subject.chat());
    } catch {
      setNotice(t('state.error'));
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <Card className="mt-4 gap-0 py-0">
      <p className="text-primary flex items-center gap-2 border-b px-4 py-3 font-semibold">
        <Sparkles className="size-4" />
        {t(title)}
      </p>

      {/* the answer can take a minute to land; a screen reader gets nothing from a bubble
          quietly appearing */}
      {(turns.length > 0 || busy) && (
        <div aria-live="polite" className="max-h-96 space-y-3 overflow-y-auto px-4 py-4">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line',
                turn.role === 'creator' ? 'bg-secondary ml-auto' : 'bg-muted',
              )}
            >
              {turn.text}
            </div>
          ))}
          {busy && (
            <>
              <div className="bg-secondary ml-auto max-w-[85%] rounded-2xl px-4 py-3 text-[15px]">
                {pending}
              </div>
              <div className="bg-muted text-muted-foreground max-w-[85%] rounded-2xl px-4 py-3 text-[15px]">
                {t('ask.thinking')}
              </div>
            </>
          )}
        </div>
      )}

      <p role="status" aria-live="polite" className="text-muted-foreground px-4 text-sm empty:hidden">
        {notice}
      </p>

      {!busy && (
        <div className="flex flex-wrap gap-2 px-4 pt-4 pb-1">
          {suggestions.map((key) => (
            <button
              key={key}
              onClick={() => send(t(key))}
              className={cn(
                focusRing,
                'text-muted-foreground hover:border-primary hover:text-primary rounded-full border px-4 py-2 text-sm',
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}

      <Composer
        question={question}
        setQuestion={setQuestion}
        tagged={tagged}
        setTagged={setTagged}
        onSend={send}
        busy={busy}
        autoFocus={autoFocus}
      />
    </Card>
  );
}

export type Turn = { role: 'creator' | 'mind'; text: string };
export type AskResult = { timedOut: boolean; mindOffline?: boolean };

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
  const input = useRef<HTMLInputElement>(null);

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
        className="flex gap-2 p-3"
      >
        <input
          ref={input}
          value={question}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && setPicker(null)}
          placeholder={t('ask.placeholder')}
          className={cn(
            focusRing,
            'focus-visible:border-primary min-w-0 flex-1 rounded-lg border px-4 py-3 text-[15px] outline-none',
          )}
        />
        <Button type="submit" size="icon" disabled={busy} aria-label={t('ask.send')}>
          <Send />
        </Button>
      </form>
    </div>
  );
}
