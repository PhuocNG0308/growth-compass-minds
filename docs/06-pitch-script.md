# Kịch bản thuyết trình — Growth Compass (2:45)

Dùng cho demo video và cho phần nói trực tiếp trước giám khảo. Lời nói để tiếng Anh
(giám khảo HK); chỉ dẫn hình để tiếng Việt.

---

## Ba điểm nhấn — nếu chỉ nhớ được ba thứ

| # | Điểm nhấn | Ăn tiêu chí nào | Thời lượng |
|---|---|---|---|
| **1** | **Mind tự hành động khi không ai mở app** — bấm Fast-forward, Mind được brief, tự chấm dự đoán của chính nó, và một proposal xuất hiện trong Inbox | Minds Integration Depth · Execution | **45s** |
| **2** | **Trí nhớ cộng dồn** — màn Tests: luật `2/3 confirmed`, biểu đồ sai số dự đoán đi xuống theo thời gian | Innovation · Persistence bắt buộc | **30s** |
| **3** | **Mind là tay viết, không phải cái loa** — nó gọi 21 endpoint của ta để *ghi*; bỏ Mind ra thì ledger không có ai viết | Minds Integration Depth | **25s** |

Mọi thứ còn lại (vấn đề, tính trung thực của dữ liệu, roadmap) là nền — nói nhanh, đừng
sa đà. Sai lầm hay gặp: dành 1 phút kể vấn đề rồi hết giờ trước khi kịp chạy demo.

---

## Timeline

### 0:00–0:20 · Vấn đề (nền)

> "Small YouTubers don't lack data. They lack an organised memory of their own channel.
> Studio, TubeBuddy, VidIQ are dashboards — they show numbers and remember nothing. So the
> creator re-runs a thumbnail experiment they already ran three months ago, and the 24-hour
> window where a video can still be saved passes while they're filming the next one."

**Hình:** YouTube Studio thật, hoặc Feed của app đang đứng yên. Đừng đọc chữ trên slide.

---

### 0:20–0:35 · Sản phẩm trong một câu (nền)

> "Growth Compass is a Mind that runs a Growth Ledger. It commits to a predicted CTR
> *before* you publish, grades itself afterwards without being asked, and turns repeated
> wins into rules that live permanently in its Soul."

**Hình:** vòng lặp SENSE → HYPOTHESIZE → COMMIT → MEASURE → LEARN, đúng 3 giây, rồi cắt.

---

### 0:35–1:20 · ĐIỂM NHẤN 1 — Autonomous follow-up (45s)

Đây là đoạn phải quay liền mạch, không cắt, để thấy rõ không có ai gõ gì thêm.

> "This experiment was opened three days ago. The Mind predicted 5.2% CTR and wrote that
> number down. A checkpoint is due 24 hours after publication — nobody watching this has 24
> hours, so the sample channel has a Fast-forward button. It skips the wait, nothing else."

**Bấm Fast-forward. Không chạm gì nữa. Để im 5–8 giây.**

> "No one asked it anything. The runner refreshed the video from YouTube, worked out which
> committed metric fell short, and briefed the Mind: observed 4.1 against 5.2 predicted, plus
> the retention drop-offs. The Mind decided what that means and wrote it back."

**Hình:** Inbox — proposal mới xuất hiện. Mở nó ra, chỉ vào dòng predicted vs observed.

> "That proposal was not in the database a minute ago. It arrived while the creator was
> asleep. And it's a proposal — the Mind holds a token that cannot change anything on
> YouTube. Every action ends with the creator approving it."

**Câu chốt phải nói:** *"Nobody triggered this."*

---

### 1:20–1:50 · ĐIỂM NHẤN 2 — Trí nhớ cộng dồn (30s)

> "Here's what accumulates. Each rule carries its evidence count — this one is at two of
> three confirming experiments, so it's still a candidate. The Mind's own Soul says a
> pattern needs three before it becomes a channel Tenet. That threshold is a rule in the
> Mind, not a constraint in our database."

**Hình:** màn **Tests** — cuộn tới danh sách rule, dừng ở `2/3 confirmed`.

> "And this is the point of the whole thing: prediction error falling as the ledger grows.
> A dashboard resets every session. This gets less wrong every week."

**Hình:** biểu đồ độ chính xác dự đoán. Dừng 3 giây, đừng nói đè lên.

---

### 1:50–2:15 · ĐIỂM NHẤN 3 — Mind là integral (25s)

> "Two directions of traffic. Inbound, our service wakes the Mind — the checkpoint runner
> sends it a brief nobody asked for. Outbound, the Mind acts through a tool API: twenty-one
> endpoints published to it as an OpenAPI tool. It opens experiments, grades checkpoints,
> writes learnings, promotes them to Tenets, files proposals, tags comments."

**Hình:** sơ đồ 2 chiều, hoặc `GET /v1/openapi.json` trong My Connections trên hellominds.ai.

> "The judgement stays in the Mind. Our API only records the decision it reached. Take the
> Mind out and the ledger has nobody to write it."

---

### 2:15–2:35 · Trung thực + đường ra thị trường (nền)

> "One thing we're explicit about, in the app itself: the sample channel mirrors a real one.
> Titles, thumbnails, views, comments are live from YouTube. CTR and retention are modelled,
> because YouTube's Analytics API answers UNAUTHENTICATED to anyone but the channel owner.
> They're derived from the real counts, never random. Connect your own channel with OAuth
> and all of them are real — that path is built."

**Hình:** banner ghi rõ Real / Modelled, và nút Connect YouTube.

---

### 2:35–2:45 · Chốt

> "Dashboards reset. This compounds. That's the whole pitch."

---

## Nếu bị ép xuống 1:30–2:00 (bản nộp demo video)

Cắt theo thứ tự này:

1. Bỏ đoạn 2:15–2:35 (trung thực dữ liệu) — chuyển vào README, giám khảo đọc được.
2. Rút đoạn vấn đề còn 10 giây, một câu.
3. Rút điểm nhấn 3 còn 12 giây: chỉ nói "twenty-one endpoints, the Mind writes, we record".
4. **Không được cắt** điểm nhấn 1 và 2. Đó là hai tính chất bắt buộc của hackathon —
   autonomous follow-up và memory — bị cắt là mất điểm gốc.

---

## Chuẩn bị trước khi quay / trình bày

- `DEMO_MODE=on`, `MINDS_BUILDER_API_KEY` đã set, Mind đang **Working** (kiểm tra tab Mind
  trong Sandbox Studio — nếu hết cognition credit thì mọi câu hỏi trả về rỗng).
- Chạy **Reset the run** trong Sandbox Studio ngay trước khi quay, để proposal về pending
  và Inbox sạch — proposal mới xuất hiện mới có sức thuyết phục.
- Còn ít nhất **một checkpoint chưa bắn**, nếu không nút Fast-forward báo hết.
- Credit Minds nạp lại 100/ngày. Quay lại nhiều lần thì quay sớm trong ngày.
- Mở sẵn Inbox ở tab kế bên để cắt sang cho nhanh, đừng để giám khảo nhìn mình điều hướng.

## Câu hỏi giám khảo hay hỏi

| Hỏi | Trả |
|---|---|
| "Sao không để Mind gọi thẳng YouTube?" | OAuth là của chủ kênh, và cần một system of record chính xác từng con số để chấm predicted vs observed. Chi tiết ở `docs/05-integration.md`. |
| "Fast-forward có phải là fake demo không?" | Nó chỉ bỏ phần chờ. Chạy đúng đường mà runner nền chạy, cùng hàm, cùng brief. Runner vẫn hoạt động theo lịch thật. |
| "Mind có tự đăng gì lên kênh không?" | Không. Guardrail trong Soul, và token nó giữ không có quyền ghi lên YouTube. Mọi thứ dừng ở proposal. |
| "Scale thế nào?" | Mỗi kênh một ledger, một Mind. Chi phí là cognition credit theo checkpoint, không theo lượt xem — tuyến tính theo số video, không theo audience. |
