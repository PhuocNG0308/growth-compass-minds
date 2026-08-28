/**
 * A demo of an agent that works on YouTube's clock cannot wait for YouTube's clock. This
 * holds the few states that are otherwise unreachable inside a two-minute pitch — a Mind
 * that is offline or out of cognition, a stream that is on air — so they can be entered on
 * purpose instead of waited for.
 *
 * State is in memory and process-wide: it is switched off outside DEMO_MODE, and the demo
 * channel is the only one a demo-mode server has.
 */
import { demoEnabled } from './env.ts';
import type { Video } from './types.ts';

export const MIND_STATES = ['normal', 'empty', 'offline', 'slow'] as const;
export type MindState = (typeof MIND_STATES)[number];

export type SandboxState = { mind: MindState; liveSince: number | null };

const CLEAN: SandboxState = { mind: 'normal', liveSince: null };

let state: SandboxState = { ...CLEAN };

export const sandboxEnabled = demoEnabled;
export const sandbox = (): SandboxState => state;
export const patchSandbox = (patch: Partial<SandboxState>): SandboxState =>
  (state = { ...state, ...patch });
export const clearSandbox = (): SandboxState => (state = { ...CLEAN });

/**
 * What the Mind should look like from outside. Configured and able to answer are separate
 * states in this app, and the sandbox has to be able to produce either one.
 */
export function mindFacade(
  demo: boolean,
  real: { enabled: boolean; cognition: number | null },
): { enabled: boolean; cognition: number | null } {
  if (!sandboxEnabled || !demo) return real;
  if (state.mind === 'offline') return { enabled: false, cognition: null };
  if (state.mind === 'empty') return { enabled: true, cognition: 0 };
  return real;
}

const LIVE_CHAT: ReadonlyArray<readonly [string, string]> = [
  ['cable_gremlin', 'the clamp is upside down again'],
  ['Priya', 'what monitor arm is that'],
  ['quietdesk', 'first time catching one of these live'],
  ['benchtop', 'chat he is going to strip that thread'],
  ['Hoang', 'from vietnam, 3am here, worth it'],
  ['flatpack_fan', 'did you ever get the standing desk fixed'],
  ['deskskeptic', 'the cheap one has lasted me two years btw'],
  ['Rin', 'please measure it before you drill'],
  ['boltcutter', 'torque wrench or we riot'],
  ['Ana Lu', 'this is the third time you have said "quick job"'],
  ['monitorstand', 'link to the bracket?'],
  ['Sena', 'audio is a bit hot on the left'],
  ['wiremonkey', 'sub goal when'],
  ['the_tidy_one', 'cable management arc starts now'],
];

const CHAT_EVERY_S = 8;
const CHAT_KEEP = 8;

/**
 * Viewer count and chat are both functions of how long the switch has been on, so the strip
 * moves between polls without anything having to be stored.
 */
export function simulatedLive(video: Video, channelTitle: string) {
  const since = state.liveSince;
  if (since === null) return null;

  const elapsedS = Math.max((Date.now() - since) / 1000, 0);
  const newest = Math.floor(elapsedS / CHAT_EVERY_S);

  return {
    ytVideoId: video.ytVideoId,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl ?? '',
    channel: channelTitle,
    watching: Math.round(840 + elapsedS * 1.4 + Math.sin(elapsedS / 11) * 120),
    startedAt: new Date(since).toISOString(),
    chat: Array.from({ length: CHAT_KEEP }, (_, offset) => newest - CHAT_KEEP + 1 + offset)
      .filter((index) => index >= 0)
      .map((index) => {
        const [displayName, text] = LIVE_CHAT[index % LIVE_CHAT.length]!;
        return { displayName, text, at: new Date(since + index * CHAT_EVERY_S * 1000).toISOString() };
      }),
  };
}
