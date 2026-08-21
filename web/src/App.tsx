import { FlaskConical } from 'lucide-react';
import { Rail } from '@/components/rail';
import { Shell } from '@/components/shell';
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
import { useAsync, useHash } from '@/lib/use-async';
import type { Me } from '@/lib/types';

const ROUTES = ['#/', '#/inbox', '#/lab', '#/memory', '#/audience', '#/chats'];

// screens reached from a tab keep that tab lit, so the nav never goes blank under you
const OWNER: Record<string, string> = { '#/chats': '#/inbox' };

/**
 * Phone and desktop are two builds of the same product, not one layout squeezed. They share
 * the data layer, the strings and the formatters; the information architecture is where they
 * part company, so the split happens here and each side stays readable on its own.
 */
export default function App() {
  const hash = useHash();
  const mobile = useIsMobile();
  const { data: me, error, loading } = useAsync(() => api.me(), []);
  const mode = useAsync(() => api.mode(), []);

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

  const detail = /^#\/post\/([^/]+)(\/ask)?$/.exec(hash);
  const person = /^#\/viewer\/(.+)$/.exec(hash);
  const route = detail
    ? '#/'
    : person
      ? '#/audience'
      : ROUTES.includes(hash)
        ? (OWNER[hash] ?? hash)
        : '#/';

  const view = { hash, route, detail, person, me };

  return mobile ? (
    <MobileShell me={me} route={route} banner={<DemoBanner show={me.demo} />}>
      <MobileScreen {...view} />
    </MobileShell>
  ) : (
    <Shell me={me} route={route} banner={<DemoBanner show={me.demo} />} rail={<Rail me={me} />}>
      <DesktopScreen {...view} />
    </Shell>
  );
}

type View = {
  hash: string;
  route: string;
  detail: RegExpExecArray | null;
  person: RegExpExecArray | null;
  me: Me;
};

function DesktopScreen({ hash, route, detail, person, me }: View) {
  if (detail) return <Post ytVideoId={decodeURIComponent(detail[1]!)} focusAsk={Boolean(detail[2])} />;
  if (person) return <ViewerProfile ytAuthorId={decodeURIComponent(person[1]!)} />;
  if (hash === '#/chats') return <Chats />;
  if (route === '#/inbox') return <Inbox me={me} />;
  if (route === '#/lab') return <Lab me={me} />;
  if (route === '#/memory') return <Memory />;
  if (route === '#/audience') return <Audience />;
  return <Feed />;
}

function MobileScreen({ hash, route, detail, person, me }: View) {
  if (detail) {
    return <MobilePost ytVideoId={decodeURIComponent(detail[1]!)} focusAsk={Boolean(detail[2])} />;
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

function DemoBanner({ show }: { show: boolean }) {
  const { t } = useI18n();
  if (!show) return null;

  return (
    <div className="bg-warning/15 text-warning flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium">
      <FlaskConical className="size-4" />
      {t('demo.banner')}
    </div>
  );
}
