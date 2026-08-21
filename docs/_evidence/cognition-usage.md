# Cognition — số đo thật

Nguồn: `getCognitionUsageByTool(mindId, { interval: 'day' })` qua `@animocabrands/minds-client-lib`,
tương đương `minds usage by-tool`. Mind: `Youtube.Minder` (`b5574c3e-…`).

## 21/08/2026 — sau khi bootstrap Soul, Guardrails, Connect

| Tool | Số lần gọi | Credit |
|---|---:|---:|
| `LLM_Turn` | 41 | 130.52 |
| `SKILL_LoadPlaybook` | 18 | 11.56 |
| **Tổng** | **59** | **142.08** |

Số dẫn xuất:

| | |
|---|---|
| Một `LLM_Turn` | ~3.18 credit |
| Một `SKILL_LoadPlaybook` | ~0.64 credit |
| **Một lượt bootstrap** (soul / guardrails / connect / guardrail-test) | **~13 credit** — mỗi lượt kéo theo nhiều `LLM_Turn` |
| Số dư sau 4 lượt | 103.4 → 51.8 |

Credit được nạp lại về 100 mỗi ngày: <https://www.hellominds.ai/campaign/free-credits>

## Đọc con số này thế nào

Lượt bootstrap là **loại đắt nhất** — Mind đọc spec, dựng manifest, gọi thử API, rồi ghi
vào Soul. Vận hành hằng ngày rẻ hơn nhiều: một checkpoint brief chỉ là đọc số rồi ghi
observation.

Chưa đo được và **không suy diễn ở đây**: chi phí một tháng vận hành cho một creator thật.
Cần một kênh đã nối và một chu kỳ checkpoint đủ dài (t24 → t28d) mới có số thật để nói.
Đo lại bằng chính lệnh trên sau khi kênh chạy được một tuần.
