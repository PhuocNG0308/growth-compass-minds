# Product Spec — AI Growth Agent cho YouTuber

Track: **Audience growth & engagement**
Tên tạm: **Channel Compass** *(chưa chốt — xem [Quyết định đang mở](#quyết-định-đang-mở))*

## 1. Vấn đề

YouTuber nhỏ và vừa không thiếu dữ liệu — họ thiếu **trí nhớ có tổ chức về chính kênh của mình**.

- YouTube Studio, TubeBuddy, VidIQ đều là *dashboard*: hiện số, không nhớ gì. Mỗi lần mở là bắt đầu lại từ đầu.
- Creator thử một ý tưởng thumbnail, video flop, ba tháng sau lại thử đúng ý tưởng đó vì không ai ghi lại.
- Không có ai theo dõi *"giả thuyết bạn đặt tuần trước đúng hay sai"*.
- Khi video vừa đăng, cửa sổ vàng 24–48h để phản ứng (đổi thumbnail, đổi title, đẩy community post) trôi qua trong lúc creator đang bận quay video kế.

Hệ quả: creator lặp lại sai lầm cũ, tăng trưởng theo cảm tính, và kiệt sức. Đây đúng là chỗ *"side-gig thành career"* bị chặn.

## 2. Giải pháp — một câu

**Một Growth Strategist thường trực, nhớ mọi thí nghiệm bạn từng chạy trên kênh, tự động đo kết quả sau khi bạn đăng video, và chưng cất bài học thành bộ luật riêng của kênh bạn.**

Điểm khác biệt không nằm ở phân tích — nằm ở **tích luỹ**. Dashboard reset mỗi phiên. Mind thì càng dùng càng đúng.

## 3. Growth Ledger — vòng lặp lõi

```
   ┌─────────────────────────────────────────────────────────┐
   │                                                         │
   ▼                                                         │
 SENSE ──► HYPOTHESIZE ──► COMMIT ──► MEASURE ──► LEARN ─────┘
 metrics   3 concept có     creator   t24 / t72   thắng lặp lại
 kênh +    dự đoán số       chọn 1,   t7d / t28d  → ghi thành
 video     cụ thể           Mind ghi  tự động     Tenet của kênh
                            prediction
```

| Bước | Ai chạy | Dấu vết để lại |
|---|---|---|
| **Sense** | Skill `channel-pulse`, theo lịch | snapshot metrics |
| **Hypothesize** | Mind + `next-video-brief` | 3 concept xếp hạng, mỗi cái kèm **dự đoán CTR / AVD** |
| **Commit** | creator chọn | Experiment mở trong ledger |
| **Measure** | checkpoint nền t24 / t72 / t7d / t28d — không cần ai nhắc | actual vs predicted |
| **Learn** | Mind | Episode; nếu pattern lặp lại ≥ N lần → **Tenet** |

Chính vòng lặp này làm ba tính chất bắt buộc của hackathon trở thành *cơ chế vận hành*, không phải tính năng dán thêm:

- **Memory** → ledger thí nghiệm + Tenets riêng của kênh
- **Continuity** → mở phiên mới là Mind đã biết video nào đang chạy dở, giả thuyết nào chưa kết luận
- **Autonomous follow-up** → checkpoint t24/t72/t7d/t28d tự bắn về Telegram

## 4. Skills cần xây trên Minds

| Skill | Làm gì | Nguồn dữ liệu |
|---|---|---|
| `channel-pulse` | Snapshot kênh + từng video, chuẩn hoá, phát hiện bất thường | Growth API nội bộ (§6) |
| `experiment-ledger` | Mở / đóng / truy vấn Experiment. **Xương sống trí nhớ.** | Mind memory + Growth API |
| `next-video-brief` | 3 concept xếp hạng: title, hướng thumbnail, hook 15s đầu, **kèm dự đoán số** — grounded vào ledger của chính kênh này | ledger + `channel-pulse` |
| `retention-autopsy` | Đọc đường retention, định vị điểm rơi, gọi tên nguyên nhân, đề xuất sửa cho video kế | Analytics API |
| `superfan-radar` | Lọc ra ~5 comment đáng trả lời: superfan quay lại, câu hỏi là ý tưởng video, chỉ trích sớm. **Nhớ người xem qua nhiều tháng.** | Data API v3 |
| `growth-digest` | Digest hàng tuần + checkpoint sau đăng, đẩy chủ động qua Telegram | tất cả bên trên |

Xây bằng quy trình hội thoại của Minds: **Describe → Refine → Connect → Run → Inspect → Publish** (xem [01-minds-platform.md](01-minds-platform.md)).

## 5. Guardrails (Tenets kiểu invariant)

Khai báo ngay khi định nghĩa Soul — vừa an toàn, vừa là điểm cộng rõ rệt cho tiêu chí *Minds Integration Depth*:

1. Không bao giờ tự đăng / sửa bất cứ thứ gì trên kênh khi chưa có creator duyệt tường minh.
2. Không đề xuất title/thumbnail mô tả sai nội dung video (clickbait lừa dối).
3. Không đề xuất engagement-bait vi phạm chính sách YouTube.
4. Mọi khẳng định về hiệu quả phải kèm **sample size và độ tin cậy**; dưới ngưỡng thì nói thẳng "chưa đủ dữ liệu".
5. Không tiêu quá N Cognition Credits trong một session.
6. Không tiết lộ dữ liệu kênh của creator này cho creator khác.

Priors Mind tự học sẽ là những thứ như *"kênh này thích brief dạng bullet"*, *"đừng nhắn trước 9h sáng"*, *"thumbnail có mặt người + ≤4 chữ thắng trên kênh này"*.

## 6. Kiến trúc

```
 Creator
   ├── Telegram  ← nơi Mind chủ động nhắn
   └── Web  ← nút Connect YouTube (popup Google) + Growth Ledger
                │
                │  @animocabrands/minds-client-lib
                ▼
        ┌───────────────┐
        │   THE MIND    │  Soul + Tenets + Episodes
        │ Growth        │  Armory: 6 Skills + Passive Autonomous Mode
        │ Strategist    │
        └───────┬───────┘
                │  HTTP_Execute
                ▼
      Growth API (backend của chúng ta)
        ├── OAuth với Google, giữ refresh token (mã hoá AES-256-GCM)
        ├── YouTube Data API v3      (views, likes, comments)
        ├── YouTube Analytics API v2 (AVD, avg view %, retention curve)
        ├── YouTube Reporting API    (impressions, CTR — trễ ~2 ngày)
        └── Growth Ledger (Postgres) — system of record
```

**Vì sao chèn Growth API ở giữa thay vì để Mind gọi thẳng YouTube:** OAuth chủ kênh, hai làn dữ liệu khác nhau, và nhu cầu có một system of record chính xác từng con số. Giải thích đầy đủ ở [05-integration.md](05-integration.md).

**Đường lùi nếu OAuth trễ:** Data API v3 chỉ cần API key và đã cho views, likes, comments, channel info — đủ để `superfan-radar` + `channel-pulse` rút gọn chạy được. CTR/retention bổ sung sau.

## 7. Kịch bản demo video (1.5–2 phút)

Dựng đúng theo thứ tự này, vì nó chứng minh persistence bằng *cách quay*, không phải bằng lời kể:

| Giây | Cảnh |
|---|---|
| 0–15 | Vấn đề: dashboard reset, creator lặp lại sai lầm cũ |
| 15–40 | **Phiên 1** — nối kênh; Mind đề xuất 3 concept kèm dự đoán số; creator chọn 1; Mind ghi Experiment |
| 40–45 | **Đóng hẳn ứng dụng.** Cắt cảnh "2 ngày sau" |
| 45–75 | **Phiên 2, không ai mở app** — Telegram tự nổ: *"Video bạn đăng: CTR 4.1% so với 5.2% tôi dự đoán. Giả thuyết thumbnail đang sai. Đây là thứ tôi sẽ đổi."* |
| 75–100 | **Phiên 3** — hỏi *"Show me your Tenets"*; Mind liệt kê luật riêng của kênh, trong đó có luật **vừa tự viết ra từ thí nghiệm trên** |
| 100–120 | Growth Ledger trên dashboard: chuỗi thí nghiệm cộng dồn. Chốt: dashboard reset, Mind thì tích luỹ. |

## 8. Phạm vi

**Trong phạm vi (MVP)**
- Một Mind duy nhất + 6 Skills
- Web: nút Connect YouTube + Growth Ledger dạng đọc. Telegram: nơi Mind chủ động nhắn
- Một kênh YouTube thật để demo

**Ngoài phạm vi (nêu như roadmap, không code)**
- Multi-Mind qua Circles (Lead Strategist + Data Analyst + Copywriter) — *chỉ làm nếu còn dư thời gian*
- Nền tảng khác ngoài YouTube
- Auto-publish bất cứ thứ gì

## 9. Quyết định đang mở

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| 1 | Tên sản phẩm | *Channel Compass* / *Flywheel* / *Trace* — cần chốt trước khi đặt tên repo |
| 2 | Kênh YouTube nào để demo | Cần một kênh **có quyền OAuth chủ sở hữu**, đã có ≥10 video để ledger có gì mà học |
| 3 | Có làm multi-Mind không | **Không** cho MVP. Rủi ro scope với thời gian còn lại; ghi vào roadmap để ăn điểm Scalability |
| 4 | ~~Stack dashboard~~ | **Đã chốt:** static FE cùng origin với Growth API — một deploy, không CORS, không build step |
| 5 | Dự thi Student Prize? | Nếu có thành viên là sinh viên thì khai báo — thêm một pool $1,300 |
