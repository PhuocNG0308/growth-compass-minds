import { useRef, useState } from 'react';
import { FlaskConical, TriangleAlert, X } from 'lucide-react';
import { Rail } from '@/components/rail';
import { Shell } from '@/components/shell';
import { VideoNav, type PostSection } from '@/components/video-nav';
import { Audience } from '@/pages/audience';
import { Chats } from '@/pages/chats';
import { Feed } from '@/pages/feed';
import { Inbox } from '@/pages/inbox';
import { Lab } from '@/pages/lab';
import { Memory } from '@/pages/memory';
import { Landing } from '@/pages/landing';
import { Post } from '@/pages/post';
import { ViewerProfile } from '@/pages/viewer';
import { MobileShell } from '@/mobile/shell';
import { MobileAudience, MobileChats } from '@/mobile/pages/audience';
import { MobileFeed } from '@/mobile/pages/feed';
import { MobileInbox } from '@/mobile/pages/inbox';
import { MobileLanding } from '@/mobile/pages/landing';
import { MobileMemory } from '@/mobile/pages/memory';
import { MobilePost } from '@/mobile/pages/post';
import { MobileTests } from '@/mobile/pages/tests';
import { useIsMobile } from '@/mobile/use-mobile';
import { api, NotConnected } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAsync, useHash, type Async } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';
import type { Me, PostDetail } from '@/lib/types';

const ROUTES = ['#/', '#/inbox', '#/lab', '#/memory', '#/audience', '#/chats'];

// screens reached from a tab keep that tab lit, so the nav never goes blank under you
const OWNER: Record<string, string> = { '#/chats': '#/inbox' };

const TITLES: Record<string, string> = {
  '#/': 'title.feed',
  '#/inbox': 'title.inbox',
  '#/lab': 'title.lab',
  '#/memory': 'title.memory',
  '#/audience': 'title.audience',
  '#/chats': 'title.chats',
};

/**
 * Phone and desktop are two builds of the same product, not one layout squeezed. They share
 * the data layer, the strings and the formatters; the information architecture is where they
 * part company, so the split happens here and each side stays readable on its own.
 */
export default function App() {
  const { t } = useI18n();
  const [preview, setPreview] = useState(false);
  const hash = useHash();
  const mobile = useIsMobile();
  const { data: me, error, loading } = useAsync(() => api.me(), []);
  const mode = useAsync(() => api.mode(), []);

  // the route names a video, and both the column beside it and the screen itself describe that
  // video — so it is fetched once here rather than by each of them
  const detail = /^#\/post\/([^/]+?)(?:\/(ask|retention|comments))?$/.exec(hash);
  const ytVideoId = detail ? decodeURIComponent(detail[1]!) : null;
  const section = (detail?.[2] ?? 'analytics') as PostSection;
  // asking is a layer over a section rather than a section of its own, so the screen and the nav
  // under the panel stay on whichever one the creator opened it from
  const behind = useRef<Exclude<PostSection, 'ask'>>('analytics');
  if (section !== 'ask') behind.current = section;
  const [videoRound, setVideoRound] = useState(0);
  const video = useAsync(
    () => (ytVideoId ? api.post(ytVideoId) : Promise.resolve(null)),
    [ytVideoId, videoRound],
  );

  if (loading || mode.loading) {
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">…</div>;
  }

  if (!me) {
    const gate = {
      googleConfigured: mode.data?.googleConfigured ?? false,
      demoAvailable: mode.data?.demo ?? false,
      serverDown: mode.data === null || (error !== null && !(error instanceof NotConnected)),
    };
    return mobile ? <MobileLanding {...gate} /> : <Landing {...gate} />;
  }

  const person = /^#\/viewer\/(.+)$/.exec(hash);
  const route = detail
    ? '#/'
    : person
      ? '#/audience'
      : ROUTES.includes(hash)
        ? (OWNER[hash] ?? hash)
        : '#/';

  const view = {
    hash,
    route,
    person,
    me,
    ytVideoId,
    section,
    behind: behind.current,
    video,
    onRetry: () => setVideoRound((n) => n + 1),
  };
  // a detail screen names itself in its own heading, so the shell stays quiet there
  const title = detail || person ? undefined : t(TITLES[hash] ?? TITLES[route]!);

  const phone = (
    <MobileShell
      me={me}
      route={route}
      title={title}
      banner={<Banners me={me} />}
      hideNav={Boolean(ytVideoId || person)}
    >
      <MobileScreen {...view} />
    </MobileShell>
  );

  if (mobile) return phone;
  if (preview) return <PhonePreview onExit={() => setPreview(false)}>{phone}</PhonePreview>;

  return (
    <Shell
      me={me}
      route={route}
      title={title}
      banner={<Banners me={me} />}
      nav={
        ytVideoId
          ? (wide) => (
              <VideoNav
                ytVideoId={ytVideoId}
                post={video.data?.post ?? null}
                section={section}
                behind={behind.current}
                wide={wide}
              />
            )
          : undefined
      }
      rail={ytVideoId ? undefined : <Rail me={me} />}
      onPreview={() => setPreview(true)}
    >
      <DesktopScreen {...view} />
    </Shell>
  );
}

/**
 * Checking the phone build from a desktop has to run the phone build. Squeezing the desktop
 * one into a narrow column shows a layout that ships to nobody, so this mounts the real
 * MobileShell instead and only lends it a device-sized window.
 */
function PhonePreview({ onExit, children }: { onExit: () => void; children: ReactNode }) {
  const { t } = useI18n();

  return (
    <div className="bg-muted grid h-dvh place-items-center p-8">
      <Button variant="outline" onClick={onExit} className="fixed top-6 right-6">
        <X />
        {t('shell.exitPreview')}
      </Button>

      {/* a transform makes this the containing block, so the phone's fixed tab bar lands on
          the bottom edge of the frame rather than the browser window */}
      <div
        style={{ width: 390, height: 844 }}
        className="bg-background transform-gpu overflow-hidden rounded-3xl border-8 shadow-2xl"
      >
        <div className="h-full overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

type View = {
  hash: string;
  route: string;
  person: RegExpExecArray | null;
  me: Me;
  ytVideoId: string | null;
  section: PostSection;
  behind: Exclude<PostSection, 'ask'>;
  video: Async<PostDetail | null>;
  onRetry: () => void;
};

function DesktopScreen({ hash, route, person, me, ytVideoId, section, behind, video, onRetry }: View) {
  if (ytVideoId) {
    return (
      <Post
        ytVideoId={ytVideoId}
        section={section}
        behind={behind}
        video={video}
        demo={me.demo}
        onRetry={onRetry}
      />
    );
  }
  if (person) return <ViewerProfile ytAuthorId={decodeURIComponent(person[1]!)} />;
  if (hash === '#/chats') return <Chats />;
  if (route === '#/inbox') return <Inbox me={me} />;
  if (route === '#/lab') return <Lab />;
  if (route === '#/memory') return <Memory />;
  if (route === '#/audience') return <Audience />;
  return <Feed demo={me.demo} />;
}

function MobileScreen({ hash, route, person, me, ytVideoId, section, video, onRetry }: View) {
  if (ytVideoId) {
    return (
      <MobilePost
        ytVideoId={ytVideoId}
        focusAsk={section === 'ask'}
        video={video}
        onRetry={onRetry}
      />
    );
  }
  // the viewer profile is already one narrow column of rows; it needs no second build
  if (person) return <ViewerProfile ytAuthorId={decodeURIComponent(person[1]!)} />;
  if (hash === '#/chats') return <MobileChats />;
  if (route === '#/inbox') return <MobileInbox me={me} />;
  if (route === '#/lab') return <MobileTests me={me} />;
  if (route === '#/memory') return <MobileMemory />;
  if (route === '#/audience') return <MobileAudience />;
  return <MobileFeed />;
}

function Banners({ me }: { me: Me }) {
  return (
    <>
      <CognitionBanner me={me} />
      <DemoBanner me={me} />
    </>
  );
}

const TOP_UP_URL = 'https://hellominds.ai/profile?tab=account';

/**
 * A Mind at or below zero cognition answers slowly or not at all. Without this the only
 * symptom is a question that never comes back, which reads as a broken app.
 */
function CognitionBanner({ me }: { me: Me }) {
  const { t } = useI18n();
  if (!me.mindEnabled || me.mindCognition == null || me.mindCognition > 0) return null;

  return (
    <div className="border-warning/40 bg-warning/15 text-warning flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-center text-xs font-medium">
      <TriangleAlert className="size-4 shrink-0" />
      <span>{t('mind.noCognition')}</span>
      <a
        href={TOP_UP_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(focusRing, 'rounded-md underline underline-offset-2')}
      >
        {t('mind.topUp')}
      </a>
    </div>
  );
}

/**
 * The sample channel reads its catalogue and counts from YouTube; click-through and retention
 * are modelled because the Analytics API answers only to the channel's owner.
 */
function DemoBanner({ me }: { me: Me }) {
  const { t } = useI18n();
  if (!me.demo) return null;
  const source = me.demoSource;

  return (
    <div className="bg-warning/15 text-warning flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-center text-xs font-medium">
      <FlaskConical className="size-4 shrink-0" />
      {source ? (
        <>
          <span>
            {t(source.realComments ? 'demo.fromLive' : 'demo.fromFeed')}{' '}
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className={cn(focusRing, 'rounded-md underline underline-offset-2')}
            >
              {source.title}
            </a>
          </span>
          <span className="opacity-80">{t('demo.modelled')}</span>
        </>
      ) : (
        t('demo.banner')
      )}
    </div>
  );
}
