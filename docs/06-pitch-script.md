# Kịch bản thuyết trình — Growth Compass

Bản hoàn chỉnh: lời thoại, thao tác demo từng bước, và danh sách màn hình bắt buộc phải cho
xem. Dùng chung cho demo video nộp bài (1.5–2 phút) và cho phần nói trực tiếp (2:45).

- **Lời thoại** để tiếng Anh — giám khảo ở Hong Kong. Dưới mỗi câu có nghĩa tiếng Việt để tập nói.
- **Thao tác** ghi rõ màn nào, bấm nút nào, dừng bao lâu.
- Bản rút gọn 1:30 ở [§6](#6-bản-rút-gọn-130--cho-video-nộp-bài). Q&A ở [§8](#8-giám-khảo-sẽ-hỏi-gì).

---

## 1. Ba điểm nhấn

Toàn bộ bài nói xoay quanh ba thứ này. Chúng chiếm **100 trên 165 giây**. Phần còn lại là nền.

| # | Điểm nhấn | Chứng minh điều gì | Ăn tiêu chí | Giây |
|---|---|---|---|---|
| **1** | Bấm **Fast-forward** → Mind được brief → **proposal tự xuất hiện trong Inbox** | *Autonomous follow-up* (bắt buộc của BTC) | Minds Integration Depth · Execution | **45s** |
| **2** | Màn **Tests**: rule `2× confirmed` với 3 vạch tiến độ, và biểu đồ sai số dự đoán đi xuống | *Memory* cộng dồn (bắt buộc của BTC) | Innovation · Execution | **30s** |
| **3** | **21 endpoint** Mind gọi để *ghi* — bỏ Mind ra thì ledger không có ai viết | Mind là integral, không phải phụ kiện | Minds Integration Depth | **25s** |

> **Lỗi hay gặp:** dành 60 giây kể vấn đề rồi hết giờ trước khi chạy được demo. Vấn đề chỉ
> được 20 giây. Giám khảo đã đọc mô tả track rồi, họ không cần nghe giảng về YouTube.

---

## 2. Chuẩn bị trước khi quay / trình bày

Làm hết trước khi bấm record. Mỗi dòng bên dưới đều có thể làm hỏng một lần quay.

| ✔ | Việc | Vì sao |
|---|---|---|
| ☐ | `DEMO_MODE=on` khi chạy `npm run dev` | Không có nó thì không có Fast-forward, không có Sandbox Studio |
| ☐ | `MINDS_BUILDER_API_KEY` đã set và Mind đang ở trạng thái **Working** | Kiểm tra ở Sandbox Studio → tab **Mind**. Nếu hết cognition credit thì mọi câu hỏi trả về rỗng |
| ☐ | Còn credit Minds trong ngày | Credit nạp lại 100/ngày, mỗi lượt hỏi tốn kha khá. Quay sớm trong ngày, đừng quay lại 10 lần buổi tối |
| ☐ | Chạy **Sandbox Studio → Time → Reset the run** | Đưa mọi proposal đã quyết về pending, xoá thứ sandbox thêm vào. Inbox sạch thì proposal mới xuất hiện mới có sức thuyết phục |
| ☐ | Xác nhận còn **ít nhất một checkpoint chưa bắn** | Hết checkpoint thì nút Fast-forward báo *"No checkpoint left to fire"* — chết ngay giữa demo |
| ☐ | Màn Tests đã có **≥2 test settled** để biểu đồ có đường | Biểu đồ chỉ vẽ khi có từ 2 điểm. Một điểm thì không thấy xu hướng đi xuống |
| ☐ | Mở sẵn tab: Feed · Inbox · Tests | Đừng để giám khảo ngồi nhìn mình điều hướng menu |
| ☐ | Ngôn ngữ để **English** | Giao diện có EN/VI; giám khảo đọc EN |
| ☐ | Zoom trình duyệt 110–125%, ẩn bookmark bar | Chữ trong bảng nhỏ, quay 1080p là không đọc được |
| ☐ | Tắt thông báo hệ thống | Popup giữa demo là mất 3 giây và mất uy tín |

---

## 3. Kịch bản đầy đủ — 2:45

### Cảnh 1 · 0:00–0:20 · Vấn đề *(nền — nói nhanh)*

**Hình:** YouTube Studio thật, hoặc màn **Feed** của app đứng yên. Không slide chữ.

> "Small YouTubers don't lack data — they lack an organised memory of their own channel.
> Studio, TubeBuddy, VidIQ are dashboards: they show numbers and remember nothing.
> So a creator re-runs a thumbnail experiment they already ran three months ago. And the
> 24-hour window where a video can still be saved passes while they're filming the next one."

*Creator nhỏ không thiếu dữ liệu — họ thiếu một bộ nhớ có tổ chức về chính kênh mình. Các
dashboard chỉ hiện số, không nhớ gì. Nên họ thử lại đúng cái thumbnail đã thử ba tháng trước.
Và cửa sổ 24 giờ vàng trôi qua trong lúc họ đang quay video kế.*

---

### Cảnh 2 · 0:20–0:35 · Sản phẩm trong một câu *(nền)*

**Hình:** sơ đồ vòng lặp, đúng **3 giây** rồi cắt. Đừng để nó trên màn hình lâu hơn.

```
SENSE ──► HYPOTHESIZE ──► COMMIT ──► MEASURE ──► LEARN ──┐
          3 concept kèm    creator   T+24h/72h    thắng lặp lại
          dự đoán số       chọn 1    /7d/28d      → thành Tenet ──┘
```

> "Growth Compass is a Mind that runs a Growth Ledger. It commits to a predicted CTR
> *before* you publish, grades itself afterwards without being asked, and turns repeated
> wins into rules that live permanently in its Soul."

*Growth Compass là một Mind vận hành một Growth Ledger. Nó cam kết một con số CTR dự đoán
trước khi bạn đăng, tự chấm mình sau đó mà không ai nhắc, và biến những lần thắng lặp lại
thành luật nằm vĩnh viễn trong Soul của nó.*

---

### Cảnh 3 · 0:35–1:20 · **ĐIỂM NHẤN 1 — Autonomous follow-up** (45s)

> **Quay liền một mạch, không cắt.** Cắt cảnh ở đoạn này là giám khảo nghi có người can thiệp.

**Bước 3.1 — Đặt bối cảnh (0:35–0:47)**

**Hình:** màn **Tests** → mục *Running*. Chỉ vào một test đang chạy, có con số dự đoán.

> "This test was opened three days ago. The Mind predicted 5.2% click-through and wrote that
> number down before the video went out. A checkpoint is due 24 hours after publication."

*Test này mở ba ngày trước. Mind dự đoán CTR 5.2% và ghi con số đó xuống trước khi video lên
sóng. Một checkpoint đến hạn 24 giờ sau khi đăng.*

**Bước 3.2 — Giải thích nút Fast-forward (0:47–0:53)**

**Hình:** rê chuột lên banner *"Sample data — this is not your channel"*, dừng ở nút **Fast-forward**.

> "Nobody watching this has 24 hours, so the sample channel has a Fast-forward button. It runs
> the exact path the background runner runs. The only thing it skips is the wait."

*Không ai xem cái này có 24 giờ, nên kênh mẫu có nút Fast-forward. Nó chạy đúng đường mà
runner nền chạy. Thứ duy nhất nó bỏ qua là phần chờ.*

**Bước 3.3 — Bấm, rồi im (0:53–1:02)**

**Bấm Fast-forward. Bỏ tay khỏi chuột. Im 6–8 giây.** Toast hiện: *"Checkpoint T+24h fired.
The Mind is reading it now — its proposal lands in the Inbox."*

Khoảng im lặng này là thứ bán được hàng. Đừng lấp nó bằng lời.

**Bước 3.4 — Kể chuyện gì vừa xảy ra (1:02–1:12)**

**Hình:** chuyển sang **Inbox**. Proposal mới đang nằm ở mục *Needs you*. Mở nó ra.

> "No one asked it anything. The runner refreshed the video from YouTube, worked out which
> committed metric fell short, and briefed the Mind — observed 4.1 against 5.2 predicted,
> plus where people dropped off. The Mind decided what that means and wrote this back."

*Không ai hỏi nó gì cả. Runner làm mới video từ YouTube, tính ra chỉ số nào hụt so với cam
kết, và brief cho Mind — đo được 4.1 so với 5.2 dự đoán, kèm chỗ người xem rời đi. Mind tự
quyết định điều đó nghĩa là gì và ghi cái này về.*

**Hình:** bấm **"Why it says this"** trên proposal để mở phần lập luận.

**Bước 3.5 — Chốt (1:12–1:20)**

> "That proposal was not in the database sixty seconds ago. It arrived while the creator was
> asleep. And it's a *proposal* — the token the Mind holds cannot change anything on YouTube.
> Every action ends with the creator approving it."

*Proposal đó chưa có trong database 60 giây trước. Nó đến trong lúc creator đang ngủ. Và nó
là một đề xuất — token Mind giữ không đổi được gì trên YouTube. Mọi hành động kết thúc ở chỗ
creator duyệt.*

**Câu phải nói nguyên văn:** *"Nobody triggered this."*

---

### Cảnh 4 · 1:20–1:50 · **ĐIỂM NHẤN 2 — Trí nhớ cộng dồn** (30s)

**Bước 4.1 — Luật đang được kiểm chứng (1:20–1:35)**

**Hình:** màn **Tests** → cuộn xuống mục **Being tested**. Dừng ở một rule có **2 trên 3 vạch
sáng** và nhãn `2× confirmed`.

> "Here's what accumulates. Every rule carries its evidence count. This one has two confirming
> tests out of the three it needs. The Mind's own Soul says a pattern needs three before it
> becomes a channel Tenet — that threshold is a rule inside the Mind, not a constraint in our
> database. Our API only records the decision it reached."

*Đây là thứ cộng dồn. Mỗi luật mang theo số bằng chứng của nó. Cái này có hai test xác nhận
trên ba cái nó cần. Chính Soul của Mind quy định một pattern cần ba lần trước khi thành Tenet
của kênh — ngưỡng đó là luật bên trong Mind, không phải constraint trong database của chúng
tôi. API của chúng tôi chỉ ghi lại quyết định nó đưa ra.*

**Hình:** cuộn lên mục **Confirmed rules**, chỉ vào badge *In its Soul*.

**Bước 4.2 — Biểu đồ (1:35–1:50)**

**Hình:** cuộn lên đầu màn Tests, biểu đồ sai số dự đoán. **Dừng 3 giây, không nói đè lên.**

> "And this is the whole claim of the product: prediction error, falling as the ledger grows.
> A dashboard resets every session. This gets less wrong every week."

*Và đây là toàn bộ điều sản phẩm này khẳng định: sai số dự đoán, giảm dần khi ledger dày lên.
Dashboard reset mỗi phiên. Cái này mỗi tuần lại sai ít đi một chút.*

---

### Cảnh 5 · 1:50–2:15 · **ĐIỂM NHẤN 3 — Mind là integral** (25s)

**Hình:** sơ đồ hai chiều, hoặc `GET /v1/openapi.json` mở trong tab, hoặc màn **My Connections**
trên hellominds.ai đang trỏ tới API của mình.

> "Two directions of traffic. **Inbound**, our service wakes the Mind — the checkpoint runner
> sends it a brief nobody asked for. **Outbound**, the Mind acts through a tool API: twenty-one
> endpoints published to it as an OpenAPI tool. It opens experiments, grades checkpoints,
> writes learnings, promotes them to Tenets, files proposals, tags comments."

*Hai chiều lưu lượng. Chiều vào, service của chúng tôi đánh thức Mind — checkpoint runner gửi
nó một bản brief không ai yêu cầu. Chiều ra, Mind hành động qua một tool API: 21 endpoint
công bố cho nó dưới dạng OpenAPI tool. Nó mở thí nghiệm, chấm checkpoint, ghi bài học, thăng
chúng thành Tenet, nộp đề xuất, gắn nhãn bình luận.*

**Hình:** màn **Memory** → lọc **Automated**. Cả một dải sự kiện Mind tự làm.

> "The judgement stays in the Mind. Take the Mind out and the ledger has nobody to write it."

*Phán đoán nằm ở Mind. Bỏ Mind ra thì ledger không còn ai viết.*

---

### Cảnh 6 · 2:15–2:35 · Trung thực + đường ra thị trường *(nền)*

**Hình:** banner ghi rõ *Real / Modelled*, rê chuột vào cột CTR để tooltip *"Modelled, not
measured"* hiện ra. Rồi chỉ vào nút **Connect YouTube**.

> "One thing we're explicit about, inside the app itself. The sample channel mirrors a real
> one. Titles, thumbnails, views, comments — live from YouTube. Click-through and retention
> are modelled, because YouTube's Analytics API answers UNAUTHENTICATED to anyone who isn't
> the channel owner. They're derived from the real counts, deterministically, never random.
> Connect your own channel through OAuth and every one of them is real. That path is built."

*Một điều chúng tôi nói rõ, ngay trong app. Kênh mẫu phản chiếu một kênh thật. Tiêu đề,
thumbnail, lượt xem, bình luận — lấy trực tiếp từ YouTube. CTR và giữ chân là số mô phỏng, vì
YouTube Analytics API trả về UNAUTHENTICATED cho bất kỳ ai không phải chủ kênh. Chúng suy ra
từ số thật, xác định, không random. Nối kênh của bạn qua OAuth thì tất cả đều là số thật.
Đường đó đã dựng xong.*

> **Vì sao phải nói:** giám khảo sẽ tự phát hiện. Nói trước thành điểm cộng về sự trung thực;
> để họ hỏi thành điểm trừ.

---

### Cảnh 7 · 2:35–2:45 · Chốt

**Hình:** quay lại màn **Tests**, biểu đồ sai số.

> "Dashboards reset. This compounds. That's the pitch."

*Dashboard thì reset. Cái này thì cộng dồn. Đó là toàn bộ bài nói.*

---

## 4. Cần demo những phần nào

### Bắt buộc — thiếu là mất điểm gốc

| Màn | Chỉ vào cái gì | Chứng minh | Cảnh |
|---|---|---|---|
| **Banner kênh mẫu** → nút **Fast-forward** | Bấm, rồi không chạm gì nữa | Autonomous follow-up | 3 |
| **Inbox** → mục *Needs you* | Proposal vừa xuất hiện; mở *Why it says this* | Mind tự hành động và tự ghi | 3 |
| **Tests** → *Being tested* | Rule `2× confirmed`, 2/3 vạch sáng | Memory tích luỹ, ngưỡng nằm trong Soul | 4 |
| **Tests** → biểu đồ đầu trang | Đường sai số đi xuống | Càng dùng càng đúng | 4 |
| **OpenAPI / My Connections** | 21 endpoint Mind gọi được | Mind là integral | 5 |
| **Memory** → lọc *Automated* | Dải sự kiện Mind tự làm, không có người | Autonomy có dấu vết dài, không phải một lần dựng | 5 |

### Nên demo nếu còn thời gian (bản 2:45 trở lên)

| Màn | Chỉ vào cái gì | Chứng minh |
|---|---|---|
| **Video** → panel *Ask about this video* | Hỏi *"Anything still worth changing on this one?"* — Mind nhắc lại con số nó đã cam kết lần trước | **Continuity** — tính chất thứ ba của BTC |
| **Inbox** → duyệt một proposal | Toast: *"Test opened. 4 checkpoints scheduled — they fire without you."* | Vòng lặp khép kín, người vẫn là người quyết |
| **Audience** → hồ sơ một *Regular* | Lịch sử bình luận nhiều tháng, tone đã được Mind gắn nhãn | Nhớ **người xem**, không chỉ nhớ số |

### Chỉ demo khi được hỏi

| Màn | Khi nào dùng |
|---|---|
| **Sandbox Studio → Mind** (*Out of cognition* / *Offline* / *Too slow*) | Giám khảo hỏi "hỏng thì sao?". Bật một trạng thái, cho xem app xử lý tử tế thay vì trắng màn |
| **Sandbox Studio → Data** | Giám khảo nghi dữ liệu dựng sẵn. Thêm người bình luận ngay tại chỗ, cho họ chọn |
| **Sandbox Studio → Time → Live strip** | Nếu muốn cho xem phần livestream |
| **Bản mobile** | Nếu giám khảo hỏi về creator dùng điện thoại — app có bản mobile riêng |

### Đừng demo

- **Đừng** đi hết mọi màn hình. Feed, Audience, Memory chỉ lướt qua khi có lý do.
- **Đừng** mở code editor. Không ai chấm bằng việc nhìn bạn cuộn file TypeScript.
- **Đừng** đọc to nội dung một proposal từ đầu đến cuối. Chỉ cần chỉ vào dòng predicted vs observed.
- **Đừng** thao tác Sandbox Studio trong bản quay chính, trừ nút Fast-forward trên banner.
  Sandbox làm demo trông như dàn dựng nếu dùng mà không giải thích.

---

## 5. Bản dài — nếu có 5 phút và có Q&A trực tiếp

Giữ nguyên cảnh 1–7, chèn thêm ba đoạn:

| Chèn sau | Đoạn thêm | Giây |
|---|---|---|
| Cảnh 3 | **Continuity**: mở panel *Ask about this video*, hỏi một câu, Mind trả lời có nhắc lại cam kết cũ bằng con số | +40s |
| Cảnh 4 | **Nhớ người xem**: màn Audience → hồ sơ một Regular, lịch sử comment nhiều tháng, Mind đã gắn tone | +30s |
| Cảnh 5 | **Guardrails**: đọc 2 trong 6 tenet an toàn trong Soul — không tự đăng, không clickbait sai nội dung | +25s |

---

## 6. Bản rút gọn 1:30 — cho video nộp bài

BTC yêu cầu 1.5–2 phút. Cắt theo đúng thứ tự này:

1. **Cảnh 6 (real/modelled) → bỏ hẳn.** Đã viết đầy đủ trong README, giám khảo đọc được.
2. **Cảnh 1 (vấn đề) → còn 10 giây, một câu:** *"Dashboards show numbers and remember nothing."*
3. **Cảnh 5 (integral) → còn 12 giây:** *"Twenty-one endpoints. The Mind writes, we record."*
4. **Cảnh 2 → còn 8 giây**, bỏ sơ đồ, chỉ nói câu one-liner.
5. **Không được cắt cảnh 3 và cảnh 4.** Đó là hai tính chất bắt buộc của BTC —
   autonomous follow-up và memory. Cắt là mất điểm gốc, không phải mất điểm phụ.

Phân bổ sau khi cắt: 10s vấn đề · 8s one-liner · **40s Fast-forward → Inbox** ·
**25s Tests** · 12s integral · 5s chốt = **1:40**.

---

## 7. Nếu demo hỏng giữa chừng

| Hỏng | Nói gì, làm gì |
|---|---|
| Fast-forward báo hết checkpoint | *"That one's already fired — here's what it produced."* → mở Inbox chỉ vào proposal cũ, hoặc Memory lọc *Automated* |
| Mind trả lời rỗng (hết credit) | *"That's the out-of-cognition state — the app tells you instead of hanging."* Chỉ vào thanh cảnh báo. Biến sự cố thành phần demo error handling |
| Mind trả lời quá lâu | Đừng đứng chờ. Nói tiếp sang cảnh 4, quay lại sau. App vẫn hiện *"thinking — 12s so far"*, không treo |
| Mạng chết | Có sẵn bản quay dự phòng của riêng cảnh 3. Luôn luôn phải có |

---

## 8. Giám khảo sẽ hỏi gì

| Câu hỏi | Trả lời |
|---|---|
| **"Fast-forward có phải demo dàn dựng không?"** | Không. Nó gọi đúng hàm mà runner nền gọi, cùng brief, cùng đường ghi dữ liệu. Thứ duy nhất bỏ qua là 24 giờ chờ. Runner vẫn chạy theo lịch thật trên nền. |
| **"Sao không để Mind gọi thẳng YouTube API?"** | OAuth thuộc về chủ kênh, và cần một system of record chính xác từng con số để chấm predicted vs observed sau này. Chi tiết ở [05-integration.md](05-integration.md). |
| **"Mind có tự đăng gì lên kênh không?"** | Không. Vừa là guardrail trong Soul, vừa là kỹ thuật: token nó giữ không có quyền ghi lên YouTube. Mọi thứ dừng ở proposal chờ creator duyệt. |
| **"Phần nào là Mind, phần nào là code của bạn?"** | Phán đoán là Mind: mở test nào, dự đoán bao nhiêu, khi nào một pattern đủ bằng chứng để thành Tenet. Code là ống dẫn: đồng bộ YouTube, hẹn giờ checkpoint, lưu ledger, dựng UI. |
| **"Scale thế nào?"** | Mỗi kênh một ledger, một Mind. Chi phí là cognition credit theo số checkpoint, tức tuyến tính theo số video, không theo lượng khán giả. Kênh to hơn không đắt hơn. |
| **"CTR mô phỏng thì làm sao tin được vòng lặp?"** | Vòng lặp không quan tâm con số đến từ đâu — nó so cam kết với quan sát. Nối kênh thật qua OAuth là cùng một code path với số thật. Đó là lý do màn Connect YouTube đã dựng xong. |
| **"Có gì mà TubeBuddy không có?"** | Chúng nó phân tích. Cái này *cam kết trước, tự chấm sau, và giữ lại kết quả*. Khác biệt không nằm ở phân tích, nằm ở tích luỹ. |

---

## 9. Ba câu phải nói nguyên văn

Nếu quên hết mọi thứ khác, ba câu này là bài nói:

1. **"Nobody triggered this."** — ngay sau khi proposal xuất hiện trong Inbox.
2. **"That threshold is a rule inside the Mind, not a constraint in our database."** — ở màn Tests.
3. **"Dashboards reset. This compounds."** — câu chốt.
