# Về thư mục này

Bản ghi thật, sinh ra bởi `npm run mind send <id>` ([`dev/mind.ts`](../../dev/mind.ts)).
Không biên tập lại nội dung Mind trả lời. `GROWTH_API_TOKEN` bị thay bằng placeholder
trước khi ghi ra file.

| File | Là gì |
|---|---|
| [`mind-bootstrap.md`](mind-bootstrap.md) | Toàn bộ hội thoại cấu hình Mind: Soul, Guardrails, Connect, 6 Skill, Publish |
| [`cognition-usage.md`](cognition-usage.md) | Số credit đo bằng `usage by-tool` |

## Một chỗ lệch trong lần chạy 21/08

Mind trả **nhiều tin nhắn cho một lượt**, còn `waitForReply` chỉ trả về tin đầu tiên. Khi
gửi bảy lượt liên tiếp, tin đầu tiên bắt được đôi khi vẫn là phần đuôi của lượt trước —
nên phần trả lời dưới tiêu đề `Skill — superfan-radar` thực chất là xác nhận của
`retention-autopsy`, và `superfan-radar` chưa từng được dựng (credit cạn trước đó).

Đã sửa: `say()` giờ đọc cả cửa sổ tin nhắn sau thời điểm gửi thay vì lấy đúng một tin.
Giữ nguyên bản ghi cũ ở đây thay vì sửa lại cho đẹp — bản ghi sai mà im lặng thì tệ hơn
bản ghi sai có chú thích.
