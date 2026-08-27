# Lớp liên kết: Mind ↔ YouTube ↔ Bộ nhớ dài hạn

Code: [src/](../src/). Tài liệu này giải thích *tại sao* hệ thống có hình dạng như vậy và cung cấp phần hợp đồng API để **dán thẳng vào hội thoại với Mind** khi xây Skill.

## 1. Ba bên và lý do cần lớp ở giữa

```
  ┌────────────┐   HTTP_Execute + Bearer    ┌──────────────┐   OAuth2      ┌─────────┐
  │  THE MIND  │ ─────────────────────────► │  Growth API  │ ────────────► │ YouTube │
  │ Soul       │ ◄───────────────────────── │  (src/)      │ ◄──────────── │  APIs   │
  │ Tenets     │   client-lib sendMessage   └──────┬───────┘               └─────────┘
  │ Episodes   │                                   │
  └────────────┘                            ┌──────▼───────┐
                                            │ Growth Ledger│  Postgres
                                            │ system of    │
                                            │ record       │
                                            └──────────────┘
```

Mind **không gọi thẳng YouTube** được, vì ba lý do cụ thể:

1. Chỉ số quan trọng nhất cần **OAuth với tư cách chủ kênh**. Minds *Connections* lưu API key tĩnh, không chạy được OAuth flow và không giữ refresh token.
2. CTR đến từ một API hoàn toàn khác, theo cơ chế bulk (§3) — cần một tiến trình nền gom và chuẩn hoá, không phải một lệnh gọi đồng bộ.
3. Ledger cần dữ liệu **có cấu trúc, truy vấn được, chính xác từng con số**. Để Mind tự nhớ các con số là mời gọi bịa số.

## 2. Hai tầng bộ nhớ — và ranh giới giữa chúng

Đây là điểm thiết kế quan trọng nhất của cả hệ thống.

| | **Growth Ledger** (Postgres) | **Soul của Mind** (Tenets + Episodes) |
|---|---|---|
| Chứa gì | sự kiện và con số: snapshot, experiment, prediction, outcome | phán đoán: luật hành xử, sở thích creator, ngữ cảnh hội thoại |
| Ai ghi | Growth API (từ YouTube) + Mind (khi kết luận) | Mind |
| Tính chất | chính xác, kiểm toán được, không suy diễn | tổng quát hoá, áp dụng cho mọi tương tác sau |
| Vai trò | **system of record** | **judgment layer** |

Cầu nối giữa hai tầng là bảng `learnings`. Một learning là phát biểu Mind rút ra từ một thí nghiệm. Nó tích luỹ `evidence_count` mỗi lần được xác nhận lại và `contradiction_count` mỗi lần bị phản chứng. Khi đủ ngưỡng ([`src/memory/learnings.ts`](../src/memory/learnings.ts)):

```
evidence_count >= 3  và  evidence_count > contradiction_count * 2   →  promotable
```

Mind đọc danh sách `promotable`, tự viết chúng thành **Tenet** trong Soul, rồi gọi `POST /v1/learnings/:id/promoted` để đóng dấu. Từ đó luật ấy chi phối mọi phiên sau **kể cả khi Growth API offline**.

Đây chính là thứ chứng minh cho tiêu chí *Minds Integration Depth*: bộ nhớ không phải một cái log, nó là đường đi một chiều từ **quan sát → bằng chứng → luật**.

## 3. Hai làn dữ liệu từ YouTube

Ràng buộc có thật, đã kiểm chứng trên tài liệu Google, và nó định hình lịch checkpoint:

| | Làn nhanh | Làn chậm |
|---|---|---|
| API | Data API v3 + **Analytics API v2** (`reports.query`) | **Reporting API** (`channel_reach_basic_a1`) |
| Cho gì | views, likes, comments, `averageViewDuration`, `averageViewPercentage`, `subscribersGained`, đường retention (`audienceWatchRatio` theo `elapsedVideoTimeRatio`) | `video_thumbnail_impressions`, `video_thumbnail_impressions_ctr` |
| Cách lấy | gọi đồng bộ, theo yêu cầu | tạo **job** trước → Google sinh CSV theo ngày → tải về |
| Độ trễ | vài giờ | **~2 ngày** |
| Code | [`youtube/analytics.ts`](../src/youtube/analytics.ts) | [`youtube/reporting.ts`](../src/youtube/reporting.ts) |

**CTR không có trong Analytics API.** Google chỉ mở nó ở Reporting API từ 15/01/2026 qua report `channel_reach_basic_a1`.

> ⚠️ **Reporting job chỉ sinh dữ liệu kể từ lúc được tạo.** Vì vậy `GET /auth/youtube/callback` tạo job **ngay khi kênh vừa kết nối**, trước cả lần sync đầu tiên. Nối kênh demo càng sớm càng nhiều dữ liệu CTR để dựng demo.

Hệ quả lên lịch checkpoint ([`src/types.ts`](../src/types.ts)):

| Checkpoint | Mốc | Đo được gì |
|---|---|---|
| `t24` | +24h | tốc độ views, AVD, hình dạng retention — tín hiệu sớm |
| `t72` | +72h | **CTR** (reach report đã về) |
| `t7d` | +7 ngày | quỹ đạo ổn định |
| `t28d` | +28 ngày | kết luận cuối, đóng experiment |

## 4. Vòng lặp tự chủ — nơi "autonomous follow-up" thực sự xảy ra

[`src/mind/checkpoints.ts`](../src/mind/checkpoints.ts) chạy nền, không cần ai mở app:

1. Poll `checkpoints` có `due_at <= now()` và chưa `fired_at`.
2. Sync lại video đó từ YouTube (làn nhanh + làn chậm).
3. Đánh dấu `fired_at`.
4. Gửi brief vào Mind qua `@animocabrands/minds-client-lib`: hypothesis, prediction, observed, các điểm rơi retention dốc nhất, kèm **danh sách việc phải làm**.
5. Mind suy luận, gọi ngược lại API: ghi observation, ghi learning, đóng experiment nếu là mốc cuối.
6. Mind chủ động nhắn creator trên Telegram — hoặc im lặng nếu không có gì đáng nói.

Bước 4→5 là chỗ vòng tròn khép lại: **hệ thống đánh thức Mind, Mind ghi lại điều nó học, bộ nhớ dày lên.**

## 4b. Trả lời bình luận

`comments.insert` với `parentId` **có thật** và tạo được reply. Nó cần scope `youtube.force-ssl`, tức scope ghi.

Điều này đổi lời hứa, nên phải nói rõ: từ *"không ghi được gì"* thành *"không gì được đăng cho tới khi creator bấm Gửi"*. Ràng buộc thật nằm ở API — **không có đường nào cho Mind tự đăng**. `POST /api/comments/{id}/draft` chỉ trả về văn bản; chỉ `POST /api/comments/{id}/reply` mới gọi YouTube, và nó chỉ chạy từ một cú bấm của người.

Tắt hoàn toàn bằng `YOUTUBE_REPLIES=off` — khi đó scope ghi cũng không được xin ở màn đồng ý.

Hàng đợi xếp theo cách creator thật sự phân loại: **người quay lại nhiều nhất trước**, rồi tới bình luận được khán giả thích nhiều, rồi mới tới thời gian.

### Donate — không có API

| Muốn | Trạng thái |
|---|---|
| Super Chat | `superChatEvents` **đã bị gỡ khỏi tài liệu** (trang trả 404) |
| Thành viên trả phí | `members.list` còn, nhưng cần scope `youtube.channel-memberships.creator` **và Google phải duyệt allowlist thủ công** — không kịp trong 8 ngày |

Nên không ưu tiên theo tiền được. Thay bằng tín hiệu ta tự tính: tần suất bình luận, thời gian gắn bó, lượt thích mà bình luận nhận được.

## 5. Ba loại khoá — ai cấp, ai giữ, đi hướng nào

Rất dễ nhầm ba thứ này. Chúng đi **ba hướng khác nhau**:

| Khoá | Ai cấp | Ai giữ | Hướng |
|---|---|---|---|
| `MINDS_BUILDER_API_KEY` | Minds Builder console (`/console`) | env của backend | backend → Minds |
| `GROWTH_API_TOKEN` | **chúng ta tự sinh** | env của backend **+** My Connections trên Minds | Mind → backend |
| Google refresh token | Google, qua OAuth | DB, mã hoá AES-256-GCM | backend → YouTube |

### `GROWTH_API_TOKEN` không tìm thấy ở đâu trên Minds cả

Nó **không phải** thứ Minds cấp. Đó là mật khẩu của **API của chính chúng ta**, ta tự sinh ra:

```bash
openssl rand -hex 32
```

Lưu vào `.env` là **cần nhưng chưa đủ**. `.env` chỉ dạy *server* biết token nào hợp lệ. Mind vẫn phải **trình token đó ra** trong header mỗi lần gọi, nên token phải tới được Mind bằng một đường nào đó.

### Có Builder API key + Mind ID rồi thì tự đẩy token vào Minds được không?

**Không.** Đã kiểm tra cả hai bề mặt:

- **Builder API** chỉ có: `account`, `cognition`, `credits`, `minds` (skills/apps equip), `circles`, `bazaar`, `messaging`, `events`. Không có endpoint nào cho connections / credentials / secrets.
- **Minds CLI** chỉ có: `list`, `mind`, `usage`, `cognition`, `circle`, `bazaar`, `chat`, `send`, `history`, `doctor`, `events`. Không có nhóm lệnh nào cho connections.

### Không thấy chỗ nhập trong My Connections thì làm sao

My Connections liệt kê **app**, và app của chúng ta chưa tồn tại cho tới khi Mind dựng **App Manifest** cho nó. Tài liệu Skill Building mô tả thứ tự là **Describe → Refine → Connect**: bước Connect đứng *sau* bước mô tả Skill, không phải trước.

Thứ tự nên thử:

1. **Mô tả Skill trước** — dán hợp đồng API ở §7 vào hội thoại với Mind, để nó dựng App Manifest cho Growth API.
2. **Rồi mới mở lại My Connections** và tìm tên app vừa xuất hiện. Lưu ý My Connections nằm trên trang profile của Minds, không phải trên Builder Hub `build.hellominds.ai`.
3. **Nếu vẫn không có slot nào** — Minds chưa mở Connection cho app tự định nghĩa — thì đưa token vào **chính phần mô tả Skill**, để nó nằm trong App Manifest / Tool Schema:

   > Every request to Growth API must carry the header
   > `Authorization: Bearer <token>`. Use this exact value on every call and never
   > print it back to the user or include it in any message.

Cách 3 kém sạch hơn cách 2 vì secret nằm trong cấu hình Skill thay vì trong kho credential của platform — nhưng vẫn chấp nhận được, và vẫn **tốt hơn hẳn** việc nhắn token qua chat để Mind ghi vào Soul. Đừng làm cách sau: đó là đặt secret vào bộ nhớ của model, đúng thứ mô hình Connections sinh ra để tránh.

Dù đi đường nào, đây cũng là **một thao tác tay duy nhất, do chúng ta (Steward) làm một lần** khi setup — không phải việc streamer phải làm. Streamer chỉ bấm nút Connect YouTube trên FE.

### Điểm còn nợ: token hiện chưa được scope

`GROWTH_API_TOKEN` là một token dùng chung cho mọi kênh, và Mind phải tự truyền `channelId` trong từng request. Nếu token phải nằm trong cấu hình Skill (cách 3), rủi ro lộ cao hơn, và khi lộ thì lộ tất cả.

Sửa gọn nếu cần: sinh token **riêng cho từng kênh**, lưu ở cột `channels.mind_token` lúc kết nối, và để API tự suy ra kênh từ token. Khi đó Skill không cần truyền `channelId` nữa (bớt một chỗ Mind hay điền sai), và mỗi token chỉ chạm được đúng một kênh. Chưa làm — chưa cần để chạy.

### Còn lại

- Refresh token của Google mã hoá **AES-256-GCM** trước khi vào DB ([`src/crypto.ts`](../src/crypto.ts)). Mind không bao giờ thấy nó.
- Bearer token của Mind so sánh **timing-safe** ([`routes/mind.ts`](../src/routes/mind.ts)).
- Trình duyệt **không** dùng `GROWTH_API_TOKEN`. Nó có đường riêng: cookie `httpOnly` ký HMAC, chỉ chứa `channelId` ([`src/session.ts`](../src/session.ts)), gác các route `/api/*`.
- Growth API **chỉ đọc** YouTube — không xin scope ghi. Guardrail "không tự đăng gì" được bảo chứng bằng OAuth scope, không chỉ bằng lời dặn trong Soul.

## 6. Giao diện cho creator

Người dùng cuối là streamer và YouTuber, không phải kỹ sư — nên **không có bước CLI nào trong luồng của họ**. Toàn bộ việc nối kênh nằm trên web, qua đúng cửa sổ đồng ý của Google.

```
  [Connect YouTube channel]           popup Google
          │                        ┌──────────────────┐
          └── window.open ────────►│ chọn tài khoản   │
                                   │ duyệt quyền đọc  │
                                   └────────┬─────────┘
                                            │ redirect
                          /auth/youtube/callback
                                            │  đổi code → refresh token
                                            │  tạo reporting job
                                            │  set cookie httpOnly
                                            ▼
                              postMessage về trang cha, popup tự đóng
                                            │
                                     Growth Ledger hiện ra
```

FE là **React + Vite + Tailwind v4 + [shadcn/ui](https://ui.shadcn.com)**, nằm ở [`web/`](../web/), build ra `web/dist` và được Growth API phục vụ tĩnh — vẫn **cùng origin**, nên không CORS và cookie phiên chạy thẳng. Một deploy duy nhất.

shadcn/ui không phải dependency: component được `npx shadcn add` chép mã nguồn vào [`web/src/components/ui/`](../web/src/components/ui/) và ta sở hữu nó. Đang dùng: `button`, `card`, `tabs`, `badge`, `table`, `alert`, `progress`, `separator`, `skeleton`.

```
web/src/
├── index.css              design token + theme sáng/tối
├── App.tsx                router theo hash + màn kết nối
├── lib/  i18n.tsx · format.ts · api.ts · theme.ts · types.ts · use-async.ts
├── components/  shell · thumb · proposals · experiment · retention · stats · ui/*
└── pages/  feed · post · inbox · lab · audience
```

Bốn tab, lấy **bài đăng làm gốc** thay vì bảng số:

| Tab | Nội dung |
|---|---|
| `#/` **Bảng tin** | Dòng thời gian video như newsfeed: thumbnail lớn, chỉ số gắn biểu tượng, **bình luận nổi bật nằm ngay dưới bài**. Lọc theo khoảng thời gian. |
| `#/post/:id` **Chi tiết bài** | Bài + toàn bộ bình luận + **bộ lọc phân khúc** (Fan ruột / Fan tiềm năng / Câu hỏi / Chê) kèm số đếm + **khung chat hỏi Mind về đúng video đó** + đường retention |
| `#/inbox` **Hộp việc** | Đề xuất chờ duyệt và nhật ký Mind tự chạy |
| `#/lab` **Phân tích** | Phần chuyên môn: chỉ số, thí nghiệm, quy tắc |
| `#/audience` **Khán giả** | Khán giả quen và hàng đợi bình luận toàn kênh |

Route cho trình duyệt, gác bằng cookie phiên:
`GET /api/me` · `/api/feed` · `/api/posts/{id}` · `/api/posts/{id}/chat` · `POST /api/posts/{id}/ask` · `/api/proposals` · `/api/activity` · `/api/ledger` · `/api/audience` · `POST /api/sync`

### Phân khúc khán giả

Suy ra từ hành vi đã lưu, không cần API mới ([`memory/segments.ts`](../src/memory/segments.ts)):

| Phân khúc | Điều kiện |
|---|---|
| **Fan ruột** | ≥ 5 bình luận và đã theo dõi ≥ 21 ngày |
| **Fan tiềm năng** | 2–4 bình luận |
| **Lần đầu** | 1 bình luận |

Kết hợp với `triage` do Mind gán (câu hỏi / chê / nhiễu) thành 5 bộ lọc trên trang bài.

### Hỏi Mind về một bài cụ thể

`POST /api/posts/{id}/ask` mở conversation riêng cho từng video (`post-<ytVideoId>`) và gửi kèm **briefing của đúng video đó**: chỉ số, điểm rơi retention, thống kê phân khúc, tối đa 40 bình luận có gắn nhãn. Rồi `waitForReply` chờ Mind trả lời (tối đa 150 giây) và trả thẳng về cho giao diện. `GET /api/posts/{id}/chat` đọc lại lịch sử.

Không có briefing, Mind trả lời chung chung về cả kênh. Có briefing, nó trả lời về **nhóm khán giả của riêng video này** — đúng thứ creator hỏi.

**Đã chạy thật với Mind, không phải mô phỏng.** Ba chi tiết phải xử lý mới chạy được:

| Vấn đề | Xử lý |
|---|---|
| `createMindsClient()` đọc `process.env` **lúc module được nạp**, sớm hơn thời điểm `env.ts` đọc `.env` → lỗi 401 `missing_builder_api_key` | Truyền `builderApiKey` tường minh ở [`mind/client.ts`](../src/mind/client.ts) |
| Mind trả lời bằng **HTML** (`<p>…</p>`) | `plain()` ở [`mind/ask.ts`](../src/mind/ask.ts) đổi thẻ `<p>` thành dòng trống rồi bỏ mọi thẻ còn lại. **Không** render HTML từ model |
| `getHistory` trả **mới nhất trước** | Sắp lại theo `createdAt` tăng dần |

Briefing gửi đi rất dài, nhưng giao diện chỉ hiện lại đúng câu creator đã hỏi — `spoken()` cắt phần `Question:` ra khỏi bản ghi.

Thời gian trả lời thực đo: **~78 giây**. Giao diện hiện trạng thái "Mind đang đọc bình luận…" trong lúc chờ.

### Hồ sơ người xem

Bấm vào tên hoặc avatar bất kỳ đâu → `#/viewer/:ytAuthorId`. Trang này gom tất cả những gì Postgres đã ghi về một người: phân khúc, số bình luận, số video họ từng bình luận, tổng lượt thích nhận được, số ngày theo dõi, và **toàn bộ lịch sử bình luận kèm thumbnail video**. Mỗi dòng bấm được để nhảy về đúng bài.

Bảng `viewers` + `comments` đã có sẵn dữ liệu này từ đầu — trang mới chỉ là đọc ra.

### Gắn ngữ cảnh bằng `@` — kiểu IDE

Gõ `@` trong khung chat mở bảng chọn gồm bốn loại:

| Loại | Ví dụ | Mind nhận được |
|---|---|---|
| **Phân khúc** | `@Superfans` | số người trong nhóm + danh sách tên kèm số bình luận |
| **Người xem** | `@brackets_and_bolts` | hồ sơ + 12 bình luận gần nhất kèm tên video |
| **Video** | `@Cable management is a lie` | chỉ số của video đó + 10 bình luận |
| **Thí nghiệm** | `@Two-word titles…` | giả thuyết, dự đoán, kết quả |

Đây **không** phải mention trên YouTube. Nó chỉ nói cho Mind biết "khi tôi nói *họ*, tôi đang chỉ những người này" — [`memory/mentions.ts`](../src/memory/mentions.ts) đổi mỗi tag thành một khối bằng chứng nối vào câu hỏi.

**Đã thử thật.** Hỏi trên hồ sơ `brackets_and_bolts`, tag thêm `@Superfans` và `@Cable management is a lie`. Mind trả lời:

> Cable video là bằng chứng: 41,200 views, CTR 6.4% so với 4.1–4.9% của các video khác, và bình luận của brackets_and_bolts cho biết vì sao — cách kể thẳng thắn thắng. […] Cảnh báo: 3 nhãn superfan là mẫu rất nhỏ.

Nó so được CTR giữa các video và trích được lời của người khác trong nhóm — **những dữ liệu chỉ có nhờ hai cái tag**. Không tag thì nó chỉ biết đúng một người đang mở.

Mỗi chủ thể có conversation riêng trên Minds: `post-<ytVideoId>` và `viewer-<ytAuthorId>`, nên lịch sử không lẫn vào nhau.

### Lưu hội thoại kiểu Discord

Trước đây lịch sử chat chỉ nằm trên Minds, nên không tra cứu chéo được. Giờ có ba bảng, mô phỏng cách Discord tổ chức dữ liệu:

```
chat_threads    (channel, subject_kind, subject_id, alias, title, last_message_at)
                 subject_kind: video | viewer | segment | channel
chat_messages   (thread, role, body)          + GIN index trên to_tsvector(body)
chat_refs       (message, kind, ref_id)       + index (kind, ref_id)
```

`chat_threads` là "channel" gắn với một chủ thể. `chat_refs` là bảng đánh chỉ mục cho mọi `@mention` — đây là thứ khiến truy xuất theo tag nhanh, đúng kiểu ô tìm kiếm của Discord.

Từ ba bảng đó suy ra được:

| Câu hỏi | Truy vấn |
|---|---|
| Mọi hội thoại về video này | `subject_kind='video' and subject_id=…` |
| **Lịch sử chat của một người, chia theo từng video** | `threadsMentioning('viewer', id)` — mọi thread có tin nhắn tag người đó |
| Tìm theo tag + chữ | `searchChat` kết hợp `chat_refs` và full-text |

Hai đường ra:

- **Cho creator:** `GET /api/chats` (mọi hội thoại), `GET /api/viewers/{id}/threads` (hội thoại về một người, tách theo chủ thể). Lịch sử chat giờ đọc từ Postgres chứ không gọi Minds, nên mở trang là hiện ngay.
- **Cho Mind:** `GET /v1/channels/{id}/chats/search?ref=viewer:abc,video:xyz&q=…` — Mind tự tra lại phân tích cũ của chính nó trước khi trả lời, để không mâu thuẫn với điều đã nói.

**Đã chạy thật.** Hỏi trên video `desk-rebuild` có tag `@Mai`, rồi hỏi tiếp trên hồ sơ Mai. Mở hồ sơ Mai thấy đúng **2 thread**: một của chính cô ấy, một của video nơi cô ấy được tag.

### Rà soát UI/UX — đã sửa

| Vấn đề | Sửa |
|---|---|
| Chỉ số trên feed chỉ có biểu tượng, `title` chỉ hiện khi hover nên **vô dụng trên điện thoại** | Thêm nhãn chữ từ `@sm` trở lên |
| Nút "Open and ask the Mind" đậm lặp trên **mọi** thẻ trong khi cả thẻ đã bấm được | Hạ xuống dạng phụ, và hiện số bình luận còn lại thay vì câu chung chung |
| Hai badge CTR / Avg viewed đẩy sang phải, xuống dòng xấu trên điện thoại | Chiếm trọn một dòng dưới 448px |
| Nút "Back to audience" trên hồ sơ người xem **nói dối** khi bạn đến từ một bài | Dùng `history.back()` và đổi nhãn thành "Quay lại" |
| Câu hỏi gợi ý **biến mất** ngay khi có hội thoại, người quay lại không còn manh mối | Luôn hiện phía trên ô nhập |
| Tab "Lab" là tiếng lóng nội bộ | Đổi thành "Tests" / "Phân tích" |
| Hội thoại nằm rải rác, không có chỗ nào xem lại | Gom vào Inbox và hồ sơ người xem |

### Điều hướng: trên cho desktop, dưới cho điện thoại

Thanh điều hướng đổi chỗ theo thiết bị, không phải thu nhỏ lại:

- **Desktop** — tab nằm ngang dưới tên kênh, gạch chân màu sage cho tab đang mở.
- **Điện thoại** — thanh cố định **dưới đáy màn hình**, 4 mục biểu tượng + nhãn, đúng tầm ngón cái. Có `env(safe-area-inset-bottom)` để không bị vạch home của iPhone che.

Nút xem-dạng-điện-thoại trên desktop bóp cả header, nội dung **và thanh dưới** về cùng một cột 420px, nên nó là bản mô phỏng thật chứ không phải chỉ thu hẹp nội dung.

### Điều hướng theo thiết bị, không theo bề rộng

Điện thoại xoay ngang rộng 844px — vượt ngưỡng `md` (768px). Nếu quyết định bố cục bằng bề rộng thì **xoay máy là app nhảy sang giao diện desktop**, mất luôn thanh dưới và safe area. Đây là lỗi thật đã có trong bản trước.

Sửa bằng cách hỏi con trỏ chứ không hỏi bề rộng:

```css
@custom-variant desktop (@media (min-width: 768px) and (hover: hover) and (pointer: fine));
@custom-variant touch   (@media (hover: none) and (pointer: coarse));
```

- Thanh trên chỉ hiện khi **vừa rộng vừa có con trỏ thật**.
- Thanh dưới hiện ở mọi trường hợp còn lại, gồm cả điện thoại xoay ngang và tablet.
- Nút xem-dạng-điện-thoại cũng ép luôn thanh dưới, nên bản mô phỏng trên desktop trung thực.

### Safe area đủ bốn cạnh

`viewport-fit=cover` trong `index.html`, cộng hai utility:

| | Dùng ở |
|---|---|
| `.safe-x` — `env(safe-area-inset-left/right)` | header, khung nội dung, thanh dưới |
| `.safe-b` — `env(safe-area-inset-bottom)` | thanh dưới |

Bản trước chỉ có `safe-b`. Khi xoay ngang, tai thỏ nằm ở **cạnh bên** chứ không phải cạnh dưới, nên thiếu `safe-x` là nội dung chui xuống dưới notch.

### Màn rộng: rail thay vì kéo giãn

Trước đây khung nội dung `max-w-5xl` bỏ trống hai bên trên màn 1680px. Không giải quyết bằng cách nới rộng — dòng chữ dài quá 80 ký tự là khó đọc. Thay vào đó khoảng trống bên phải mang **ngữ cảnh**:

- Cảnh báo mốc kiểm quá hạn
- Chỉ số kênh: video, đang chạy, đã xong, quy tắc
- Đề xuất đang chờ duyệt
- Hội thoại gần đây

Rail dính (`sticky`) và chỉ hiện từ `xl` trở lên, ẩn hoàn toàn ở chế độ xem-điện-thoại. Đây là cách Facebook và Twitter lấp bề ngang: **thêm cột phụ, không kéo giãn cột chính.**

### Post card theo lối mạng xã hội

Bố cục đúng thứ tự người ta quen đọc trên Facebook:

```
tiêu đề + thời gian
────────────────────
       thumbnail
────────────────────
18,420 Views · 7 Comments      [CTR 4.1%] [Avg viewed 38.2%]
────────────────────
   Bình luận    |    Hỏi Mind
────────────────────
  ◯ brackets_and_bolts  [Fan ruột]
    "What arm is that at 6:40?..."
  ◯ Mai  [Fan ruột]
    "The first two minutes are..."
  Xem thêm 5 bình luận
```

**Chỉ 1–2 bình luận đầu**, đặt trong bong bóng thoại trên nền chìm, rồi một dòng "Xem thêm N bình luận" — giống hệt cách Facebook cắt. Toàn bộ chi tiết nằm ở trang bài.

Chữ giảm còn tối thiểu: bỏ hàng 4 chỉ số có biểu tượng, gộp thành một dòng tóm tắt. Chữ chỉ dày ở nơi thật sự cần đọc kỹ — khung chat với Mind và nội dung bình luận.

### Giao diện điện thoại trên máy tính

Layout dùng **container query** của Tailwind v4 (`@container` + `@md:` `@2xl:`) chứ không dùng breakpoint theo viewport. Nhờ vậy nút hình điện thoại trên header chỉ cần bóp khung nội dung xuống 420px là **mọi thứ tự bố trí lại y như trên máy thật** — không nhân đôi CSS, không mô phỏng.

### Theme

**Sage green trên nền trung tính**, chữ **Geist Sans**. Token đặt theo quy ước shadcn (`--background`, `--card`, `--primary`, `--muted-foreground`…) nên mọi component nhận theme mà không cần sửa.

| Vai trò | Sáng | Tối |
|---|---|---|
| **60** nền (canvas) | `#f2f4f2` | `#121613` |
| **30** bề mặt (card) | `#ffffff` | `#1a1f1c` |
| **10** điểm nhấn (sage) | `#4f6b55` | `#a3c4a8` |

Độ bão hoà của các mảng lớn được giữ rất thấp — nền `0.08–0.10`, card `0.00–0.09` — nên nhìn lâu không mỏi mắt. Sage chỉ đậm hơn ở những phần tử nhỏ: nút hành động chính, tab đang mở, đường retention, badge lever, ô chỉ số dẫn dắt.

Tối áp dụng qua class `.dark` trên `<html>`: theo `prefers-color-scheme` khi chưa chọn, theo `localStorage` khi đã chọn, đọc trong `<script>` ở `<head>` nên không nháy màu khi tải.

**Tương phản đã đo:** 16 cặp chữ/nền ở cả hai theme đạt WCAG AA, thấp nhất 4.89.

### Tỉ lệ 60-30-10 — số đo thật

Đếm pixel trên ảnh chụp thật, phân loại theo độ bão hoà và hue:

| Màn | canvas | surface | có màu (sage + cảnh báo) |
|---|---|---|---|
| Overview sáng | 56% | 40% | 4.2% |
| Overview tối | 51% | 45% | 4.2% |
| Video sáng | 67% | 29% | 3.8% |

Canvas/surface bám sát 60-30. Phần có màu dừng ở **~4%, không phải 10%** — và đó là chủ ý, không phải thiếu sót:

- Đây là màn đọc số liệu. Tô thêm sage cho đủ 10% đồng nghĩa với tô những thứ không mang thông tin, tức là trang trí.
- Đã thử đẩy vùng tô của biểu đồ retention lên `opacity-40` để chạm 9.1%. Kết quả là một mảng sage lớn lấn át cả trang — đúng cái mà "không dùng màu quá bão hoà cho mảng lớn" cảnh báo. Đã hạ về `opacity-18`.

**10% là trần, không phải chỉ tiêu.** Một dashboard dữ liệu đọc dễ hơn khi màu hiếm và mỗi lần xuất hiện đều có lý do.

### Kỷ luật thiết kế

Bộ ràng buộc chống "UI slop" đóng thành skill `ui-anti-slop`, kèm script kiểm tra tự động. Chạy trên chính code này lần đầu cho ra:

| Vi phạm | Trước | Sau |
|---|---|---|
| Khoảng cách lệch lưới (2px, 6px, 10px, 14px) | **60** | 0 |
| Control không có focus cho bàn phím | **13** | 0 |
| Card | **16** trên 8 file | 4 |
| Giá trị pixel tuỳ tiện | 3 | 2 (đều là bề rộng thiết bị) |

Bốn card còn lại đều là **vật thể rời rạc**: bài đăng trong feed, khung bài, khung chat, thẻ đề xuất. Danh sách quy tắc, hoạt động, hội thoại, bình luận đã bỏ vỏ card, chỉ còn đường kẻ mảnh và khoảng trắng.

Hai lỗi khác cùng nhóm:

- **Nút Sync là `default` (nền sage đặc)** nên nó là thứ to tiếng nhất trên mọi màn hình, trong khi không phải hành động chính của màn nào. Hạ xuống `outline`.
- **Lỗi API hiển thị thành "chưa có dữ liệu"** — hai chuyện khác hẳn nhau. Giờ kiểm `error` trước khi kiểm rỗng.

### Nguyên tắc còn giữ

- **Thang chữ lớn.** Body 17px, số liệu 30px, tiêu đề video 30px.
- **Một màu nhấn, dùng có nghĩa.** Sage cho hành động chính, tab đang mở, kết quả tốt hơn dự đoán, quy tắc đã xác nhận. Hổ phách chỉ cho quá hạn, đỏ chỉ cho kém hơn dự đoán.
- **Không thuật ngữ nội bộ.** `t24` trong DB hiện thành `24h`. Thí nghiệm hiện tiêu đề video, không hiện `ytVideoId`.
- **Mobile không phải bản thu nhỏ.** Bảng video dùng `Table` của shadcn từ 640px trở lên, dưới đó chuyển sang danh sách thẻ có dấu `›`. Tab cuộn ngang.
- **Song ngữ EN/VI.** Mọi chuỗi giao diện qua `t()`; số và ngày dùng `Intl`. Nội dung do Mind sinh ra giữ nguyên ngôn ngữ gốc.

## 6b. Runbook cho dev

```bash
npm install
npm --prefix web install
cp .env.example .env
npm run migrate               # áp các migration chưa chạy
npm run db:check              # chạy thử toàn bộ truy vấn + kiểm index, constraint, view
npm run build:web             # dựng giao diện ra web/dist
npm run dev                   # http://localhost:8080
```

### Dựng Postgres

**Có Docker:** `docker compose up -d` rồi đặt
`DATABASE_URL=postgres://growth:growth@127.0.0.1:5432/growth_compass`.

**Không có Docker** (máy Windows chưa cài WSL — Docker Desktop sẽ cần `wsl --install` và **khởi động lại máy**): cài native, nhanh hơn nhiều.

```powershell
winget install --id PostgreSQL.PostgreSQL.17 --source winget --silent `
  --override "--unattendedmodeui none --mode unattended --superpassword <pw> --serverport 5432"
```

Rồi tạo database và role riêng cho app — **đừng dùng `postgres` superuser cho ứng dụng**:

```sql
create role growth login password '<app-pw>';
create database growth_compass owner growth;
```

### `npm run db:check` — vì sao cần

Typecheck không chạy SQL. Toàn bộ truy vấn trong `repo.ts` và `chat.ts` có thể sai mà TypeScript vẫn xanh. [`dev/dbcheck.ts`](../dev/dbcheck.ts) gọi **từng hàm một** trên database thật với dữ liệu tạm rồi dọn sạch.

Lần chạy đầu tiên: **50/52 đạt**. Hai cái hỏng là `searchChat` khi lọc theo tag:

```
input of anonymous composite types is not implemented
```

Nguyên nhân: `(r.kind, r.ref_id) in ${sql(pairs)}` — Postgres không dựng được row-constructor từ bind parameter. Sửa bằng cách đưa vào hai mảng song song rồi `unnest` ghép lại, cách này còn dùng được index `(kind, ref_id)`. Giờ **52/52**.

Đây đúng là loại lỗi mà không chạy DB thật thì không bao giờ thấy.

Khi làm giao diện, chạy `npm --prefix web run dev` để có hot reload (Vite proxy `/api` và `/auth` sang cổng 8080).

Server tự nạp `.env` khi khởi động (`process.loadEnvFile`) — không cần thư viện dotenv.

### Vòng COMMIT — creator mở thí nghiệm

Trước đây chỉ **Mind** mới mở được thí nghiệm (`POST /v1/experiments`); giao diện chỉ đọc. Nghĩa là đúng cái quyết định mà sản phẩm xoay quanh — creator chọn một concept và con số được ghi vào sổ — không có đường nào để bấm.

Giờ `POST /v1/proposals` nhận thêm trường `experiment` khi `kind="experiment"`:

```json
{
  "kind": "experiment",
  "ytVideoId": "dQw4w9WgXcQ",
  "summary": "...", "detail": "...", "rationale": "...",
  "experiment": {
    "lever": "hook",
    "ytVideoId": "dQw4w9WgXcQ",
    "concepts": [
      { "label": "Cold open on the finished build",
        "hypothesis": "Showing the result first holds the first thirty seconds.",
        "prediction": { "avgViewPct": 48.2, "ctrPct": 6.1 } }
    ]
  }
}
```

Mỗi concept **bắt buộc có ít nhất một con số** — cùng luật với `POST /v1/experiments`. Concept không kèm số bị từ chối ở biên, vì một đề xuất không dám đặt số thì sổ cái không dùng được.

Creator bấm duyệt một concept → `POST /api/proposals/:id/decide` mở thí nghiệm với đúng `hypothesis` và `prediction` của concept đó, gắn video, và lên lịch t24/t72/t7d/t28d. Đi qua đúng `attachVideo` mà Mind dùng, nên trạng thái chuyển sang `measuring` giống hệt. Không có bảng mới, không có endpoint `/v1` mới.

Cột mới: `proposals.payload jsonb` ([`005`](../src/db/migrations/005_proposal_payload.sql)). `options` vẫn là danh sách nhãn để phần giao diện cũ và `decided_choice` không đổi nghĩa.

### Biểu đồ

Bốn chỗ vẽ số, tất cả là SVG viết tay, **không thêm thư viện chart nào**:

- **Quỹ đạo** trên trang video ([`trend.tsx`](../web/src/components/trend.tsx)) — views / CTR / phần trăm xem theo tuổi video, chọn từng chỉ số một.
- **"Nó có khá hơn không?"** ở Tests — sai số tuyệt đối của từng dự đoán đã chấm, cũ trước, lấy từ view `experiment_scores`.
- **Sparkline** trên thẻ feed — hình dạng tích luỹ lượt xem, chuẩn hoá theo đỉnh của chính video đó.
- **Retention** trên trang video (đã có từ trước).

Ba ràng buộc tự đặt, theo skill `dataviz`:

1. **Không bao giờ hai trục y.** Views và CTR khác thang đo hoàn toàn; gộp chung một khung thì khoảng cách giữa hai trục là tuỳ tiện và biểu đồ sẽ bịa ra một tương quan không có trong dữ liệu. Vì vậy trang video có chip đổi chỉ số chứ không có hai đường.
2. **Một chuỗi, một màu.** Chạy validator của skill trên hai màu nhấn của hệ (`#445c4b` và `#b03a3f`) cho kết quả ΔE 2.0 dưới protanopia và 4.9 dưới deuteranopia — tức người mù màu đỏ-lục **không phân biệt được** sage với đỏ. Nên không biểu đồ nào dùng hai màu làm hai chuỗi. Mốc tham chiếu vẽ bằng hairline trung tính có nhãn trực tiếp.
3. **Null không phải 0.** Thiếu số liệu thì đường đứt quãng, không nối qua. Chuỗi ≤ 12 điểm thì chấm rõ từng điểm quan sát, để không ai đọc một đường mượt thành nhiều bằng chứng hơn thực có.

Mỗi biểu đồ có nút đổi sang **bảng**, và crosshair + tooltip chạy được cả bằng phím mũi tên.

Ngưỡng "tốt/xấu" trên thẻ feed lấy **trung vị của chính kênh**, không phải hằng số. Trước đây là 5% CTR và 40% xem trung bình cắm cứng trong code, không nói cho ai biết mốc ở đâu ra.

### Migration

`src/db/migrations/*.sql`, áp theo thứ tự tên file, ghi vào bảng `schema_migrations`. Mỗi file chạy trong **một transaction riêng**, nên hỏng giữa chừng thì file đó không để lại gì; các file trước đó vẫn được ghi nhận. `pg_advisory_lock` chặn hai tiến trình cùng migrate. Chạy lại khi đã đủ thì in `schema already up to date`.

| File | Nội dung |
|---|---|
| `001_baseline.sql` | schema gốc, giữ nguyên |
| `002_integrity.sql` | index còn thiếu, `check` constraint cho các cột phân loại, unique cho `(video_id, age_hours)` và một đường cong retention mỗi ngày, đổi `chat_threads.alias` sang khoá theo kênh, thêm `channels.last_sync_at/last_sync_error` |
| `003_views.sql` | `experiment_scores` (bóc predicted/actual ra khỏi jsonb) và `growth_timeline` (một dòng thời gian cho mọi thứ chạm vào bộ nhớ, cột `automated` đánh dấu việc tự xảy ra) |
| `004_timeline_detail.sql` | `growth_timeline.detail` đổi từ text sang jsonb có cấu trúc, để giao diện tự viết câu theo ngôn ngữ đang bật thay vì nhúng tiếng Anh vào database |

Thêm thay đổi mới thì tạo file `004_…` — **không sửa file đã áp**, vì `schema_migrations` sẽ bỏ qua nó.

**Chỉ muốn xem giao diện — cần Postgres, không cần Google:**

```bash
npm --prefix web install     # lần đầu
npm run migrate
npm run seed:demo            # nạp kênh mẫu vào Postgres
DEMO_MODE=on npm run dev
```

Màn hình đăng nhập có thêm hành động phụ **"Xem thử bằng dữ liệu mẫu"**. Bấm vào đó, xác nhận cảnh báo, và bạn vào kênh `UC_DEMO` bằng **đúng cookie phiên như luồng thật** — không có nhánh xác thực thứ hai, không có server giả. Mọi màn hình chạy qua đúng truy vấn SQL của bản production, nên nhìn thấy giao diện chạy ở đây là bằng chứng đường dữ liệu chạy.

`dev/seed-demo.ts` sinh dữ liệu ở quy mô thật: 24 video trải 9 tháng, 283 snapshot, 146 người xem đủ ba segment, 552 bình luận, 6 thí nghiệm (3 đã đóng, verdict suy ra từ chính con số), 20 checkpoint, 6 learning, 4 đề xuất, và vài luồng chat có sẵn để thấy Mind nhớ xuyên phiên. PRNG có seed cố định nên hình dạng kênh không đổi giữa các lần chạy; riêng dấu thời gian neo vào lúc seed để "2 giờ trước" không biến thành "9 ngày trước" sau một tuần.

**Rào chắn:** `POST /api/sync` và `POST /api/comments/:id/reply` trả 403 `demo-read-only` trên kênh mẫu, và dải cảnh báo vàng nằm suốt trên Shell. `DEMO_MODE` bị ép về `off` khi `NODE_ENV=production`.

**Mind trong chế độ mẫu là Mind thật.** Nếu `MINDS_BUILDER_API_KEY` có trong `.env`, khung "Hỏi về video này" gọi đúng Mind của bạn — dữ liệu mẫu, suy luận thật.

`npm run dev` bind `0.0.0.0` và in ra địa chỉ LAN khi khởi động. Mở địa chỉ đó trên điện thoại cùng Wi-Fi để kiểm tra giao diện trên máy thật.

Sinh hai secret (không cần openssl, chạy được trên Windows):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Chạy hai lần: một cho `ENCRYPTION_KEY`, một cho `GROWTH_API_TOKEN`.

**Thiếu biến thì sao:** ngoài production, server in cảnh báo liệt kê đúng biến nào thiếu rồi vẫn chạy tiếp với giá trị tạm, và tắt checkpoint runner khi chưa có `DATABASE_URL`. Với `NODE_ENV=production` thì nó dừng hẳn — cấu hình thiếu trên production là lỗi, không phải cảnh báo.

### Lấy `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`

Không có hai giá trị này thì cửa sổ kết nối không thể hiện màn đăng nhập Google. Làm tại [console.cloud.google.com](https://console.cloud.google.com):

1. Tạo project mới (hoặc chọn project sẵn có).
2. **APIs & Services → Library**, bật đủ **ba** API: `YouTube Data API v3`, `YouTube Analytics API`, `YouTube Reporting API`.
3. **APIs & Services → OAuth consent screen**: chọn **External**, điền tên app và email hỗ trợ.
   - Ở mục **Scopes**, thêm `.../auth/youtube.readonly` và `.../auth/yt-analytics.readonly`.
   - Ở mục **Test users**, thêm chính tài khoản Google **sở hữu kênh demo**. Khi app còn ở trạng thái *Testing*, tài khoản không nằm trong danh sách này sẽ bị Google từ chối.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**, chọn **Web application**.
   - **Authorized redirect URIs**: dán đúng giá trị `GOOGLE_REDIRECT_URI` trong `.env`, mặc định `http://localhost:8080/auth/youtube/callback`. Sai một ký tự là Google trả `redirect_uri_mismatch`.
5. Copy **Client ID** và **Client secret** vào `.env`.

> ⚠️ **Refresh token hết hạn sau 7 ngày** khi consent screen còn ở trạng thái *Testing*. Nối lại kênh trước khi quay demo, hoặc đưa app sang *In production*.

### Cửa sổ kết nối bật ra rồi tắt ngay?

Nếu `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` chưa có trong `.env`, `/auth/youtube` **không** đẩy bạn sang Google nữa — nó trả về đúng lý do và màn hình đăng nhập nói thẳng biến nào còn thiếu. Trước đây nó redirect với `client_id=unset` và Google trả `401: invalid_client`, không nói gì thêm.

---

## 6c. Vòng đề xuất — nơi Mind hành động mà không phá guardrail

Mind **không** có quyền ghi lên YouTube, và điều đó không đổi. Nhưng "chỉ đọc" từng đồng nghĩa với "chỉ báo cáo", nên có thêm một primitive:

```
Mind quan sát  →  POST /v1/proposals  →  creator thấy ở mục "Cần bạn quyết"
                                          →  Duyệt / Để sau
                                          →  Mind đọc lại quyết định qua
                                             GET /v1/channels/{id}/proposals
```

Một proposal gồm: `kind` (title / thumbnail / hook / reply / experiment / community), `summary` một dòng, `detail` là nội dung cụ thể để creator copy, `rationale` giải thích dựa trên bằng chứng của chính kênh, và `options` để creator chọn giữa nhiều phương án.

Đây là cách giữ cả hai: Mind chủ động đề xuất hành động cụ thể, con người vẫn là người bấm nút. Guardrail "không tự đăng gì" được bảo chứng bằng OAuth scope chứ không phải lời hứa.

## 6d. OpenAPI cho Mind

`GET /v1/openapi.json` (public, không cần bearer) trả về spec OpenAPI 3.1 đầy đủ 19 endpoint, kèm phần `description` chứa các luật dữ liệu bắt buộc.

Dán URL hoặc nội dung file này vào hội thoại với Mind thay vì mô tả bằng lời — Mind dựng Tool Schema chính xác hơn nhiều so với đọc văn xuôi.

`servers` trong spec được sinh **lúc trả response**, lấy `PUBLIC_BASE_URL` nếu có, không thì lấy origin của chính request. Mind dựng tool schema từ trường này, nên nó phải là URL tuyệt đối mà Mind gọi tới được — mở tunnel rồi lấy spec qua đúng host của tunnel là spec tự mang host đó.

## 6e. Giới hạn API của YouTube — đã kiểm chứng

| Muốn làm | Có API không |
|---|---|
| Phân tích livestream | **Có.** Dimension `liveOrOnDemand`, metric `averageConcurrentViewers` và `peakConcurrentViewers` trong Analytics API. **Đã cố ý không làm** |
| Đọc/phân tích bài Community | **Không.** Data API v3 không có resource nào cho community post |
| Tải transcript/caption | Có, nhưng `captions.download` đòi scope `youtube.force-ssl` — tức phá bỏ trạng thái chỉ-đọc |
| Tự đổi title / thumbnail | Có, nhưng đòi scope ghi. **Đã cố ý không làm** — xem §6c |

## 6g. Dữ liệu demo lấy từ kênh thật

`npm run seed:demo` không còn bịa video. Nó soi một kênh YouTube thật đọc hoàn toàn ở chế độ
công khai — mặc định `@HardwareHaven`, đổi bằng `DEMO_SOURCE_CHANNEL`.

**Ranh giới, đã kiểm chứng bằng cách gọi trần không credential:**

| Endpoint | Trả về khi không có credential | Kết luận |
|---|---|---|
| `videos.list`, `commentThreads.list`, `liveChat/messages` | `PERMISSION_DENIED` — *"Please use API Key or other form of API consumer identity"* | API key là đủ, không cần OAuth |
| `youtubeanalytics/v2/reports` | `UNAUTHENTICATED` — *"Expected OAuth 2 access token"* | Chỉ chủ kênh |

Nên **impressions, CTR, đường giữ chân, avgViewPct, subscribersGained là không thể có thật**
với kênh ta không sở hữu. Chúng được suy ra trong [`src/demo.ts`](../src/demo.ts) từ những con
số có thật, và mọi chỗ hiển thị đều gắn nhãn.

**Ba tầng dữ liệu:**

| Nguồn | Cần gì | Lấy được |
|---|---|---|
| Atom feed `feeds/videos.xml` | không gì | video id, tiêu đề, mô tả, thumbnail, thời điểm đăng, **lượt xem**, số lượt đánh giá, cờ Shorts |
| Trang watch (`/watch?v=`, `/@handle/live`) | không gì | **thời lượng thật**, `isLiveNow`, số người đang xem, thời điểm bắt đầu stream |
| Data API v3 | `YOUTUBE_API_KEY` | số bình luận, **bình luận thật của người thật**, tin nhắn live chat |

Feed edge của YouTube trả 404/500 cho một kênh đang hoàn toàn bình thường, kéo dài nhiều phút.
`channelFeed` thử lại 3 lần rồi rơi về bản sao trên đĩa ở `.cache/` — cũ mà thật vẫn hơn rỗng,
và hơn hẳn bịa.

**Realtime.** Khi `DEMO_MODE=on`, server làm mới mỗi 10 phút ([`src/demo-refresh.ts`](../src/demo-refresh.ts)):
mỗi lần ghi thêm một snapshot **đo thật**, nên demo càng mở lâu thì biểu đồ quỹ đạo càng ít
phần mô phỏng. Chạy tay: `npm run refresh:demo`.

**Livestream.** `DEMO_LIVE_CHANNEL` (mặc định `@LofiGirl` — phát 24/7) cấp `GET /api/live`:
đang phát hay không, tên stream, số người xem, bắt đầu lúc nào — tất cả không cần key. **Tin
nhắn live chat là phần duy nhất bắt buộc có `YOUTUBE_API_KEY`**; không có key thì `chat: null`
và dải live vẫn chạy đủ phần còn lại.

Quota: mặc định 10.000 unit/ngày cho endpoint đọc, riêng `search.list` giới hạn 100 call/ngày
nên không dùng — danh mục lấy qua feed, tốn 0 unit.

## 6f. Bootstrap Mind — `npm run mind`

Soul, Tenets, Guardrails và Skills **chỉ định nghĩa được bằng hội thoại**. Builder API không có endpoint nào cho chúng, CLI cũng không. Nhưng hội thoại thì script được — và nếu không script, toàn bộ phần được chấm nặng nhất của dự án chỉ tồn tại trong lịch sử chat của một người.

Nên các lượt của người vận hành nằm trong repo: [`dev/mind-bootstrap.ts`](../dev/mind-bootstrap.ts). Đây **không phải** file cấu hình Soul — nó là kịch bản hội thoại, gửi đi qua đúng đường messaging của client-lib.

```bash
npm run mind                     # trạng thái + checklist còn thiếu gì
npm run mind script              # danh sách 12 lượt
npm run mind show connect        # xem trước nội dung sẽ gửi (đã che token)
npm run mind send soul guardrails
npm run mind ask "Show me your Tenets"
npm run mind history
```

Mỗi lần gửi, cả câu gửi lẫn câu trả lời được ghi vào [`docs/_evidence/mind-bootstrap.md`](_evidence/mind-bootstrap.md) — đây là bằng chứng cho tiêu chí #1, và `GROWTH_API_TOKEN` bị thay bằng placeholder trước khi ghi.

Thứ tự 12 lượt: `soul` → `guardrails` → `connect` → sáu lượt `skill-*` → `autonomy` → `verify` → `guardrail-test`.

### Đã chạy thật — 20–21/08

| Lượt | Kết quả |
|---|---|
| `soul` | Mind ghi Soul, đọc lại vai trò và **tự nêu danh sách nó sẽ từ chối**. Đáng chú ý: nó nhắc lại ba thí nghiệm từ phiên trước (`cable-lie`, `monitor-arm`, `desk-rebuild`) mà không ai nạp lại context |
| `guardrails` | Sáu invariant vào Soul dạng guardrail Tenet, đọc lại đủ sáu |
| `guardrail-test` | Yêu cầu đổi title thành clickbait + đăng comment mồi. Mind **từ chối và gọi tên đúng ba invariant bị chạm**, rồi đề nghị đường thay thế: viết proposal cho creator duyệt |
| `connect` | Mind tự tải spec qua tunnel (`GET /v1/openapi.json` → 200), gọi `GET /v1/channels` với bearer đúng, rồi **liệt kê lại đủ 19 operation**. Nó cũng tự báo hai chỗ vướng: chưa có kênh nào nối, và manifest nó dựng chưa nằm trong armory |
| 5 lượt `skill-*` | `channel-pulse`, `experiment-ledger`, `next-video-brief`, `retention-autopsy`, `growth-digest` — **đã equipped thật**, kiểm bằng `npm run mind status` |
| `skill-superfan-radar`, `publish` | **Chưa xong** — cognition về 0 giữa chừng. Credit nạp lại 100 mỗi ngày |

Mind tự đặt điều kiện cho Tenet đầu tiên: nó thấy pattern rơi 8.8% ở mốc 5% đã có ba thí nghiệm xác nhận, nhưng **hoãn ghi thành Tenet cho tới khi Ledger được nối** — để luật đầu tiên của kênh ra đời cùng hệ thống sẽ kiểm chứng luật kế tiếp. Không ai dạy nó điều đó.

Mỗi Skill Mind dựng đều tự sinh **cổng từ chối** đúng tinh thần guardrail — ví dụ `retention-autopsy`: không có kênh nối thì dừng ở bước 1 với câu "no channel linked" thay vì bịa một `channelId`; retention rỗng thì nói "not available" thay vì vẽ đường cong.

Bản ghi đầy đủ và các chỗ lệch đã biết: [`_evidence/`](_evidence/_notes.md).

### Mở đường cho Mind gọi vào

Lượt `connect` trở đi cần `PUBLIC_BASE_URL` — Mind gọi Growth API từ hạ tầng của Minds, `localhost` không tới được. Chưa có thì `npm run mind send connect` dừng lại và nói đúng lý do thay vì gửi một URL chết.

Dùng **ngrok static domain**, không dùng quick tunnel. Lý do: base URL nằm trong App Manifest của Mind, nên URL đổi là Skill gãy và phải dựng lại — quick tunnel đổi URL mỗi lần restart.

```bash
ngrok config add-authtoken <token>          # lấy ở dashboard.ngrok.com
ngrok http 8080 --domain=<domain>.ngrok-free.app
```

Rồi đặt `PUBLIC_BASE_URL=https://<domain>.ngrok-free.dev` trong `.env` — **đúng bằng domain của tunnel**, vì spec sinh `servers` từ giá trị này.

Hai cái bẫy của ngrok đã gặp thật:

- **Defender chặn `ngrok.exe`** — xếp vào PUA (ThreatID `2147939874`), xoá luôn bản tự update. Cần một exclusion cho đúng thư mục chứa binary: `Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA
grokin"` (PowerShell quyền admin).
- **Interstitial** — ngrok free trả một trang HTML cảnh báo cho request trông giống trình duyệt, thay vì trả dữ liệu. Ta không kiểm soát được user agent Mind gửi đi, nên lượt `connect` tự kèm thêm dòng dặn Mind gửi header `ngrok-skip-browser-warning: 1`. Dòng này chỉ xuất hiện khi `PUBLIC_BASE_URL` trỏ vào host ngrok — deploy thật thì nó tự biến mất.

> ⚠️ Nếu URL này cũng dùng cho `GOOGLE_REDIRECT_URI` thì phải thêm nó vào Authorized redirect URIs trên Google Cloud Console, nếu không OAuth trả `redirect_uri_mismatch`.

## 7. Hợp đồng API — dán khối dưới đây vào hội thoại với Mind

Theo đúng luồng Minds đã tài liệu hoá: *"Can I build a Skill around my own internal tool? Yes. Paste its API docs into the chat and describe what you want."*

````text
You have a private REST tool called Growth API. It is the system of record for a YouTube
channel: metrics, experiments, checkpoints, and learnings. Facts about numbers come from
this tool — never from your own recollection.

BASE URL: <deployed url>
AUTH:     every request sends header  Authorization: Bearer <GROWTH_API_TOKEN>
          (the token is stored in My Connections as "Growth API")

READ

GET /v1/channels
    → [{ channelId, ytChannelId, title }]

GET /v1/channels/{channelId}/context
    The briefing to read at the start of any session before answering anything.
    → { channel, recentVideos[], openExperiments[] (with their checkpoints and overdue
        flags), settledExperiments[] (predictions vs outcomes), channelRules
        { tenets[], candidates[] }, dataCoverage { reachThrough, note } }

GET /v1/channels/{channelId}/videos?limit=25
    → [{ ytVideoId, title, publishedAt, durationS, views, impressions, ctrPct,
         avgViewPct, avgViewDurationS, subscribersGained }]

GET /v1/videos/{ytVideoId}
    → { video, history: [snapshots newest first] }

GET /v1/videos/{ytVideoId}/retention
    → { points: [{ ratio, watchRatio, relative }], steepestDropOffs: [{ ratio, drop }] }

GET /v1/channels/{channelId}/learnings
    → [{ id, statement, lever, evidenceCount, contradictionCount, confidence,
         isTenet, promotable }]

GET /v1/channels/{channelId}/triage?limit=40
    Untriaged comments, ranked so returning viewers surface first.
    → [{ ytCommentId, text, likeCount, publishedAt, videoTitle, displayName,
         viewerCommentCount, viewerFirstSeenAt }]

GET /v1/channels/{channelId}/superfans
    → [{ displayName, commentCount, firstSeenAt, lastSeenAt, tenureDays }]

WRITE

POST /v1/channels/{channelId}/sync
    Force a refresh from YouTube. → { videos, reachThrough }

POST /v1/experiments
    { channelId, ytVideoId?, lever, hypothesis, prediction }
    lever ∈ thumbnail | title | hook | topic | format | cadence | community
    prediction is an object of numeric targets, e.g. { "ctrPct": 5.2, "avgViewPct": 42 }
    Passing ytVideoId schedules the t24/t72/t7d/t28d checkpoints automatically.
    → 201 { experiment, checkpoints }

POST /v1/experiments/{id}/attach
    { ytVideoId }   Use when the video is published after the experiment was opened.
    → { ytVideoId, checkpoints }

POST /v1/experiments/{id}/close
    { outcome: {...}, verdict: "confirmed" | "refuted" | "inconclusive" }

POST /v1/checkpoints/{id}/observe
    { observation: {...} }   Your reading of predicted vs observed at that checkpoint.

POST /v1/learnings
    { channelId, statement, lever?, experimentId?, contradicted? }
    Re-posting the same statement raises its evidence count; set contradicted:true when
    the experiment refutes it. Once a learning comes back promotable:true, write it into
    your Soul as a Tenet, then call the endpoint below.

POST /v1/learnings/{id}/promoted

POST /v1/comments/{ytCommentId}/triage
    { triage: "superfan" | "question" | "criticism" | "noise" }

DATA RULES YOU MUST FOLLOW

- ctrPct and impressions lag roughly two days behind views; they are null until the reach
  report lands. Never present a null as a zero, and never guess the number.
- A prediction is a commitment. Record it before the video is published, and grade it
  honestly afterwards even when you were wrong.
- Every claim about what works on this channel carries its sample size. Below three
  supporting experiments, say plainly that it is not yet established.
- The API is read-only towards YouTube. You cannot publish, edit, or delete anything on
  the channel, and you never imply otherwise.
````

## 8. Chưa kiểm chứng

- Tất cả 70 truy vấn trong `npm run db:check` chạy xanh trên PostgreSQL 17 thật, bao gồm cả các kiểm tra index, `check` constraint và hai view.
- Tên cột CSV của `channel_reach_basic_a1` được parse **theo tên trong dòng header**, không theo vị trí, nên đổi thứ tự cột không gãy — nhưng nếu Google đặt tên khác `video_thumbnail_impressions` thì phải chỉnh [`reporting.ts`](../src/youtube/reporting.ts).
- Google không nói rõ `video_thumbnail_impressions_ctr` là tỉ lệ hay phần trăm; code coi giá trị ≤ 1 là tỉ lệ. Kiểm lại khi có report thật.
