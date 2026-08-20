import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'en' | 'vi';

const DICT: Record<Locale, Record<string, string>> = {
  en: {
    'nav.feed': 'Feed',
    'nav.inbox': 'Inbox',
    'nav.lab': 'Tests',
    'rail.channel': 'This channel',
    'rail.allChats': 'All conversations',
    'section.chats': 'Conversations',
    'empty.chats': 'No conversations yet. Open a video and ask your Mind something.',
    'chat.messages': '{n} message',
    'chat.messages_other': '{n} messages',
    'viewer.threads': 'Conversations about them',

    'shell.viewport': 'Phone view',
    'range.all': 'All',
    'range.month': 'Last 30 days',
    'range.quarter': 'Last 90 days',
    'segment.superfan': 'Superfan',
    'segment.potential': 'Potential fan',
    'segment.newcomer': 'First time',
    'filter.all': 'All',
    'filter.superfan': 'Superfans',
    'filter.potential': 'Potential fans',
    'filter.question': 'Questions',
    'filter.criticism': 'Criticism',
    'filter.newcomer': 'First time',
    'tier.hint.all': 'Everyone who has commented here, ranked by how often they come back.',
    'tier.hint.superfan': 'Five comments or more, following you for at least three weeks.',
    'tier.hint.potential': 'Came back to comment more than once, not a regular yet.',
    'tier.hint.newcomer': 'First comment on the channel — the ones worth answering fast.',
    'feed.comments': 'Comments',
    'feed.ask': 'Ask Mind',
    'feed.moreComments': 'View {n} more comments',
    'post.back': 'Back to feed',
    'section.comments': 'Comments',
    'metric.likes': 'Likes',
    'metric.comments': 'Comments',
    'ask.thinking': 'Your Mind is reading the comments…',
    'ask.slow': 'Your Mind is taking a while. The answer will appear here when it lands — reopen the page.',
    'ask.offline': 'No Mind connected. Set MINDS_BUILDER_API_KEY to get a real answer.',
    'preview.liveMind': 'Preview — sample video, real Mind',
    'ask.untag': 'Remove',
    'ask.viewerTitle': 'Ask about this viewer',
    'ask.viewerWho': 'What kind of viewer is this?',
    'ask.viewerKeep': 'How do I keep them around?',
    'ask.viewerIdea': 'Is there a video idea in what they say?',
    'viewer.back': 'Back',
    'viewer.since': 'First comment {date}',
    'viewer.comments': 'Comments',
    'viewer.videos': 'Videos',
    'viewer.likes': 'Likes received',
    'viewer.tenureDays': 'Days following',
    'viewer.history': '{n} comment',
    'viewer.history_other': '{n} comments',
    'viewer.likeCount': '{n} like',
    'viewer.likeCount_other': '{n} likes',
    'empty.viewerHistory': 'No comments recorded yet.',
    'ask.title': 'Ask about this video',
    'ask.placeholder': 'Ask about this audience…',
    'ask.send': 'Send',
    'ask.who': 'Who is watching this one?',
    'ask.why': 'Why did people leave early?',
    'ask.next': 'What should I make next?',
    'empty.proposals': 'Nothing waiting on you.',
    'empty.filter': 'No comments in this group.',
    'empty.range': 'Nothing published in this window.',
    'nav.overview': 'Overview',
    'nav.experiments': 'Experiments',
    'nav.videos': 'Videos',
    'nav.audience': 'Audience',
    'nav.rules': 'Rules',

    'shell.sync': 'Sync',
    'shell.syncing': 'Syncing…',
    'shell.mindOn': 'Mind active',
    'shell.mindOff': 'Mind offline',
    'shell.theme': 'Switch theme',
    'shell.language': 'Language',
    'shell.menu': 'Menu',

    'gate.title': 'Your channel, remembered.',
    'gate.lede': 'Every test you run, the number predicted, and what actually happened.',
    'gate.connect': 'Connect YouTube',
    'gate.readOnly': 'Read-only. Nothing on your channel can be changed.',

    'preview.banner': 'Preview — sample data, not your channel',
    'state.loading': 'Loading…',
    'state.error': 'Could not load this page.',
    'state.retry': 'Try again',

    'stat.videos': 'Videos',
    'stat.running': 'Running',
    'stat.settled': 'Settled',
    'stat.overdue': 'Overdue',
    'stat.rules': 'Rules',

    'alert.overdue': '{n} checkpoint overdue',
    'alert.overdue_other': '{n} checkpoints overdue',

    'ctr.through': 'CTR data through {date}',
    'ctr.pending': 'CTR arrives ~2 days after connecting',

    'section.needsYou': 'Needs you',
    'section.numbers': 'Numbers',
    'proposal.approve': 'Approve',
    'proposal.dismiss': 'Not now',
    'proposal.title': 'Title',
    'proposal.thumbnail': 'Thumbnail',
    'proposal.hook': 'Hook',
    'proposal.reply': 'Reply',
    'proposal.experiment': 'Experiment',
    'proposal.community': 'Community post',
    'section.activity': 'Activity',
    'section.running': 'Running',
    'section.settled': 'Settled',
    'section.tenets': 'Confirmed rules',
    'section.candidates': 'Being tested',
    'section.retention': 'Retention',
    'section.snapshots': 'History',
    'section.fans': 'Regulars',
    'section.queue': 'Needs a reply',

    'empty.activity': 'No checkpoints yet. The first lands 24h after a tracked video goes live.',
    'empty.running': 'No test running. Ask your Mind for a video brief.',
    'empty.settled': 'No test has finished yet.',
    'empty.tenets': 'No confirmed rules yet.',
    'empty.candidates': 'Nothing being tested.',
    'empty.videos': 'No videos yet.',
    'empty.retention': 'No retention data yet.',
    'empty.fans': 'No repeat commenters yet.',
    'empty.queue': 'All clear.',

    'exp.predicted': 'Predicted',
    'exp.actual': 'Actual',
    'exp.notPublished': 'Not published',
    'exp.noCheckpoints': 'Checkpoints start when a video is attached',
    'exp.confirmed': 'Confirmed',
    'exp.refuted': 'Refuted',
    'exp.inconclusive': 'Unclear',

    'lever.thumbnail': 'Thumbnail',
    'lever.title': 'Title',
    'lever.hook': 'Hook',
    'lever.topic': 'Topic',
    'lever.format': 'Format',
    'lever.cadence': 'Timing',
    'lever.community': 'Community',

    'metric.ctrPct': 'CTR',
    'metric.avgViewPct': 'Avg viewed',
    'metric.avgViewDurationS': 'Avg duration',
    'metric.views': 'Views',
    'metric.subscribersGained': 'Subscribers',
    'metric.impressions': 'Impressions',

    'video.published': 'Published',
    'video.duration': 'Length',
    'video.age': 'Age',
    'video.taken': 'Taken',
    'video.back': 'All videos',
    'video.dropAt': 'Drop at',
    'video.dropSize': '{n} points lost',

    'act.read': 'Reviewed by Mind',
    'act.sent': 'Sent to Mind',

    'rule.evidence': '{n}× confirmed',
    'rule.against': '{n}× against',
    'rule.inSoul': 'In memory',
    'rule.hint': 'A rule is confirmed after {n} independent tests.',

    'fan.comments': '{n} comments',
    'fan.since': 'since {date}',
    'fan.regular': 'Regular',
    'fan.on': 'on {title}',
    'fan.last': 'last comment {when}',
    'empty.tierFans': 'No regulars in this group yet.',
    'empty.tierQueue': 'Nothing from this group waiting.',
  },

  vi: {
    'nav.feed': 'Bảng tin',
    'nav.inbox': 'Hộp việc',
    'nav.lab': 'Phân tích',
    'rail.channel': 'Kênh này',
    'rail.allChats': 'Tất cả hội thoại',
    'section.chats': 'Hội thoại',
    'empty.chats': 'Chưa có hội thoại nào. Mở một video và hỏi Mind.',
    'chat.messages': '{n} tin nhắn',
    'viewer.threads': 'Hội thoại về người này',

    'shell.viewport': 'Xem dạng điện thoại',
    'range.all': 'Tất cả',
    'range.month': '30 ngày qua',
    'range.quarter': '90 ngày qua',
    'segment.superfan': 'Fan ruột',
    'segment.potential': 'Fan tiềm năng',
    'segment.newcomer': 'Lần đầu',
    'filter.all': 'Tất cả',
    'filter.superfan': 'Fan ruột',
    'filter.potential': 'Fan tiềm năng',
    'filter.question': 'Câu hỏi',
    'filter.criticism': 'Chê',
    'filter.newcomer': 'Lần đầu',
    'tier.hint.all': 'Tất cả người đã bình luận, xếp theo mức độ quay lại.',
    'tier.hint.superfan': 'Từ 5 bình luận trở lên và đã theo kênh ít nhất ba tuần.',
    'tier.hint.potential': 'Đã quay lại bình luận nhiều hơn một lần, chưa thành khán giả quen.',
    'tier.hint.newcomer': 'Bình luận đầu tiên trên kênh — nên trả lời sớm.',
    'feed.comments': 'Bình luận',
    'feed.ask': 'Hỏi Mind',
    'feed.moreComments': 'Xem thêm {n} bình luận',
    'post.back': 'Về bảng tin',
    'section.comments': 'Bình luận',
    'metric.likes': 'Thích',
    'metric.comments': 'Bình luận',
    'ask.thinking': 'Mind đang đọc bình luận…',
    'ask.slow': 'Mind trả lời hơi lâu. Câu trả lời sẽ hiện ở đây khi về — mở lại trang này.',
    'ask.offline': 'Chưa nối Mind. Đặt MINDS_BUILDER_API_KEY để nhận câu trả lời thật.',
    'preview.liveMind': 'Bản xem thử — video mẫu, Mind thật',
    'ask.untag': 'Bỏ',
    'ask.viewerTitle': 'Hỏi về người xem này',
    'ask.viewerWho': 'Đây là kiểu khán giả nào?',
    'ask.viewerKeep': 'Làm sao giữ chân họ?',
    'ask.viewerIdea': 'Có ý tưởng video nào trong lời họ nói không?',
    'viewer.back': 'Quay lại',
    'viewer.since': 'Bình luận đầu {date}',
    'viewer.comments': 'Bình luận',
    'viewer.videos': 'Video',
    'viewer.likes': 'Lượt thích nhận',
    'viewer.tenureDays': 'Ngày theo dõi',
    'viewer.history': '{n} bình luận',
    'viewer.likeCount': '{n} thích',
    'empty.viewerHistory': 'Chưa ghi nhận bình luận nào.',
    'ask.title': 'Hỏi về video này',
    'ask.placeholder': 'Hỏi về nhóm khán giả này…',
    'ask.send': 'Gửi',
    'ask.who': 'Ai đang xem video này?',
    'ask.why': 'Vì sao người xem bỏ giữa chừng?',
    'ask.next': 'Nên làm video gì tiếp theo?',
    'empty.proposals': 'Không có gì chờ bạn.',
    'empty.filter': 'Không có bình luận trong nhóm này.',
    'empty.range': 'Không có video nào trong khoảng này.',
    'nav.overview': 'Tổng quan',
    'nav.experiments': 'Thử nghiệm',
    'nav.videos': 'Video',
    'nav.audience': 'Khán giả',
    'nav.rules': 'Quy tắc',

    'shell.sync': 'Đồng bộ',
    'shell.syncing': 'Đang đồng bộ…',
    'shell.mindOn': 'Mind đang chạy',
    'shell.mindOff': 'Mind chưa nối',
    'shell.theme': 'Đổi giao diện',
    'shell.language': 'Ngôn ngữ',
    'shell.menu': 'Menu',

    'gate.title': 'Kênh của bạn, được ghi nhớ.',
    'gate.lede': 'Mọi thử nghiệm, con số đã dự đoán, và kết quả thật.',
    'gate.connect': 'Kết nối YouTube',
    'gate.readOnly': 'Chỉ đọc. Không thay đổi được gì trên kênh.',

    'preview.banner': 'Bản xem thử — dữ liệu mẫu, không phải kênh của bạn',
    'state.loading': 'Đang tải…',
    'state.error': 'Không tải được trang này.',
    'state.retry': 'Thử lại',

    'stat.videos': 'Video',
    'stat.running': 'Đang chạy',
    'stat.settled': 'Đã xong',
    'stat.overdue': 'Quá hạn',
    'stat.rules': 'Quy tắc',

    'alert.overdue': '{n} mốc kiểm quá hạn',
    'alert.overdue_other': '{n} mốc kiểm quá hạn',

    'ctr.through': 'Dữ liệu CTR tới {date}',
    'ctr.pending': 'CTR về sau khi kết nối ~2 ngày',

    'section.needsYou': 'Cần bạn quyết',
    'section.numbers': 'Chỉ số',
    'proposal.approve': 'Duyệt',
    'proposal.dismiss': 'Để sau',
    'proposal.title': 'Tiêu đề',
    'proposal.thumbnail': 'Thumbnail',
    'proposal.hook': 'Mở đầu',
    'proposal.reply': 'Trả lời',
    'proposal.experiment': 'Thử nghiệm',
    'proposal.community': 'Bài cộng đồng',
    'section.activity': 'Hoạt động',
    'section.running': 'Đang chạy',
    'section.settled': 'Đã kết luận',
    'section.tenets': 'Quy tắc đã xác nhận',
    'section.candidates': 'Đang kiểm chứng',
    'section.retention': 'Giữ chân',
    'section.snapshots': 'Lịch sử',
    'section.fans': 'Khán giả quen',
    'section.queue': 'Cần trả lời',

    'empty.activity': 'Chưa có mốc kiểm nào. Mốc đầu tiên là 24h sau khi video lên sóng.',
    'empty.running': 'Chưa có thử nghiệm nào. Hỏi Mind để lấy brief video.',
    'empty.settled': 'Chưa thử nghiệm nào kết thúc.',
    'empty.tenets': 'Chưa có quy tắc nào được xác nhận.',
    'empty.candidates': 'Không có gì đang kiểm chứng.',
    'empty.videos': 'Chưa có video.',
    'empty.retention': 'Chưa có dữ liệu giữ chân.',
    'empty.fans': 'Chưa ai bình luận nhiều lần.',
    'empty.queue': 'Không còn gì.',

    'exp.predicted': 'Dự đoán',
    'exp.actual': 'Thực tế',
    'exp.notPublished': 'Chưa đăng',
    'exp.noCheckpoints': 'Mốc kiểm bắt đầu khi gắn video',
    'exp.confirmed': 'Đúng',
    'exp.refuted': 'Sai',
    'exp.inconclusive': 'Chưa rõ',

    'lever.thumbnail': 'Thumbnail',
    'lever.title': 'Tiêu đề',
    'lever.hook': 'Mở đầu',
    'lever.topic': 'Chủ đề',
    'lever.format': 'Định dạng',
    'lever.cadence': 'Thời điểm',
    'lever.community': 'Cộng đồng',

    'metric.ctrPct': 'CTR',
    'metric.avgViewPct': 'Xem trung bình',
    'metric.avgViewDurationS': 'Thời lượng xem',
    'metric.views': 'Lượt xem',
    'metric.subscribersGained': 'Người đăng ký',
    'metric.impressions': 'Lượt hiển thị',

    'video.published': 'Đăng',
    'video.duration': 'Dài',
    'video.age': 'Tuổi',
    'video.taken': 'Lúc',
    'video.back': 'Tất cả video',
    'video.dropAt': 'Rơi ở',
    'video.dropSize': 'mất {n} điểm',

    'act.read': 'Mind đã xem',
    'act.sent': 'Đã gửi cho Mind',

    'rule.evidence': '{n}× đúng',
    'rule.against': '{n}× ngược lại',
    'rule.inSoul': 'Đã ghi nhớ',
    'rule.hint': 'Một quy tắc được xác nhận sau {n} lần kiểm chứng độc lập.',

    'fan.comments': '{n} bình luận',
    'fan.since': 'từ {date}',
    'fan.regular': 'Quen',
    'fan.on': 'ở {title}',
    'fan.last': 'bình luận gần nhất {when}',
    'empty.tierFans': 'Chưa có khán giả quen trong nhóm này.',
    'empty.tierQueue': 'Không có gì từ nhóm này đang chờ.',
  },
};

export const LOCALES: Array<[Locale, string]> = [
  ['en', 'EN'],
  ['vi', 'VI'],
];

const STORED = 'gc.locale';

function initialLocale(): Locale {
  const saved = localStorage.getItem(STORED);
  if (saved === 'en' || saved === 'vi') return saved;
  return navigator.language?.startsWith('vi') ? 'vi' : 'en';
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

type Ctx = { locale: Locale; setLocale: (next: Locale) => void; t: Translate; plural: Translate & ((key: string, n: number) => string) };

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const value = useMemo<Ctx>(() => {
    const t: Translate = (key, vars) => {
      let text = DICT[locale][key] ?? DICT.en[key] ?? key;
      if (vars) for (const [name, v] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(v));
      return text;
    };

    const plural = (key: string, n: number) => {
      const alt = `${key}_other`;
      return t(n !== 1 && DICT[locale][alt] !== undefined ? alt : key, { n });
    };

    return {
      locale,
      t,
      plural: plural as Ctx['plural'],
      setLocale: (next) => {
        localStorage.setItem(STORED, next);
        document.documentElement.lang = next;
        setLocaleState(next);
      },
    };
  }, [locale]);

  document.documentElement.lang = locale;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside provider');
  return ctx;
}
