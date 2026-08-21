export const DEMO_YT_CHANNEL_ID = 'UC_DEMO';

export const isDemoChannel = (channel: { ytChannelId: string }) =>
  channel.ytChannelId === DEMO_YT_CHANNEL_ID;
