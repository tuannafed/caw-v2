# caw vs `addyosmani/agent-skills` — compare

> **STATUS (cập nhật @ v2.3.0):** đã verify repo thật + adopt có chọn lọc. Adopted:
> `doubt-driven` → skill `caw:doubt-check` (orchestrator-only, lane risky); gap skills
> → `caw:security-hardening`, `caw:performance-optimization`, `caw:observability`,
> `caw:context-engineering`; `source-driven` → rule `rules/common/source-driven.md`.
> **2.4 clarify/interview-me ĐÃ LÀM trước đó** (planner D3 clarify gate) — không adopt
> `interview-me` riêng. Tất cả adapt từ MIT (© 2025 Addy Osmani), giữ attribution.
>
> **Đính chính claim cũ:** `doubt-driven-development` chỉ có frontmatter `name`+`description`
> (KHÔNG có `allowed-tools`/`model`/`auto-trigger`). Ràng buộc "orchestrator-only, spawn
> fresh subagent" nằm trong PROSE (Loading Constraints + Step 3), không phải frontmatter —
> nên caw wire nó ở `/caw:code` main session, KHÔNG nhét vào agent (coder/planner là subagent).

Repo Addy = **plugin skill-centric** rất chỉn chu: 24 skill (auto-trigger theo
description) + 4 agent auditor (code-reviewer, security-auditor, test-engineer,
web-performance-auditor) + 8 command lifecycle, đa nền tảng (Claude/Cursor/Gemini/
Antigravity/opencode), **không harness/DB**. Trending. Triết lý: \*"skill mã hoá workflow

- quality gate của senior engineer, agent tuân theo nhất quán."\*

---

## 1. Addy vs caw — hai triết lý

|                | Addy agent-skills                     | caw                                      |
| -------------- | ------------------------------------- | ---------------------------------------- |
| Trung tâm      | **Skill** (24, auto-trigger)          | **Pipeline** (5 agent tuần tự) + harness |
| Agent          | 4 auditor on-demand                   | 5 stage orchestrated                     |
| State/memory   | **không**                             | **harness SQLite** (cross-session)       |
| Coverage skill | rộng (security, perf, observability…) | 4 authored + delegate Superpowers        |
| Nền tảng       | đa (Claude/Cursor/Gemini…)            | Claude Code                              |

→ Khác triết lý: Addy _"skill lái, agent audit, không nhớ"_; caw _"pipeline điều phối,
harness nhớ"_. **Với nỗi đau gốc của anh (agent quên task xuyên session), thiết kế caw
PHÙ HỢP hơn** — Addy không có cross-session state. Harness của caw được biện minh bởi
nhu cầu Addy không giải. Affirm.

→ **Củng cố lại "caw là DB outlier":** thêm một nguồn uy tín, trending (Addy Osmani)
dùng skill + markdown, **không DB**. Tín hiệu thị trường nhất quán: mainstream là
skill-centric, không state-backed.

---

## 2. Đáng mượn từ Addy

### 🟠 2.1 `doubt-driven-development` — adversarial self-check IN-FLIGHT (caw thiếu hẳn)

Pattern: _"materialize một reviewer fresh-context, thiên về **bác bỏ** chứ không duyệt,
TRƯỚC khi một output non-trivial đứng vững."_ Tác giả nhấn: **đây KHÔNG phải `/review`** —
review là phán quyết trên artifact đã xong; doubt-driven là **tư thế in-flight**: quyết
định non-trivial bị cross-examine **khi sửa còn rẻ**.

Trigger "non-trivial": đụng branching logic, vượt ranh giới module/service, khẳng định
tính chất compiler không verify được (idempotence/ordering/thread-safety/invariant), hoặc
blast-radius không hồi phục (deploy prod, data migration, đổi public API).

**Vì sao caw cần:** reviewer của caw là **post-hoc** (như /review). caw **không có**
self-check in-flight lúc coding. Với lane **risky** + team risk-sensitive của anh, một tư
thế "doubt" trên quyết định non-trivial bắt lỗi **trước khi nó lan qua pipeline** — rẻ hơn
bắt ở reviewer gate. → Wire doubt-driven vào lane `risky` (coder/planner gọi khi gặp
quyết định non-trivial).

### 🟡 2.2 Gap skill caw + Superpowers KHÔNG có

Addy có, mà stack caw hiện thiếu: **security-and-hardening**, **performance-optimization**,
**observability-and-instrumentation**, **deprecation-and-migration**. → Cherry-pick 2–3 cái
làm companion skill cho các lane phù hợp (security khi đụng auth/input; perf khi có yêu cầu
hiệu năng). **KHÔNG adopt cả 24** — sẽ rơi lại bẫy over-curation anh đã thoát.

### 🟡 2.3 `context-engineering` — trị degradation phiên dài

Skill có "Context Hierarchy" (Rules → Specs/Arch → Source → Tools/MCP → Conversation) +
kỷ luật khi nào compact/refresh. Đụng đúng lo ngại "chất lượng agent tụt ở phiên dài" +
context budget (monorepo). → Lấy làm skill hoặc fold vào session practice của caw.

### ✅ 2.4 `interview-me` / `idea-refine` — ĐÃ GIẢI bằng planner clarify gate (D3)

Hai skill này là bản hiện thực của bước **clarify/elicitation**. caw **đã làm** việc này ở
D3: planner Step 0.7 **clarify gate** — chặn plan + trả về câu hỏi khi có ambiguity
plan-breaking (thay vì đoán). Không cần adopt `interview-me` riêng; tinh thần "rút ra điều
user THẬT SỰ muốn" đã nằm trong gate đó.

### 🟡 2.5 `source-driven-development` — lớp kỷ luật trên Context7

_"Grounds mọi quyết định implementation vào official docs."_ caw đã có Context7 (MCP cấp
docs); đây là **lớp phương pháp** (bắt buộc tra docs trước khi code) — có thể thêm như
rule/skill mỏng cho coder.

---

## 3. ĐỪNG copy

- **Không adopt cả 24 skill** → bẫy over-curation (Snyk: nhiều skill không bao giờ invoke;
  anh đã chốt "ít authored + delegate"). Cherry-pick có chọn lọc.
- **Không bỏ harness** theo mô hình stateless của Addy — nhu cầu memory của anh là thật.
- **Không copy mô hình agent-auditor** thay pipeline — pipeline + harness của caw hợp mục
  tiêu hơn.
- Superpowers vẫn là **spine workflow-skill**; Addy là **nguồn cherry-pick gap** + pattern
  doubt-driven, không phải đối thủ thay thế.

---

## 4. Thêm vào Master Plan

| Việc                                                          | Trạng thái       | Ghi chú                                                                                      |
| ------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| **doubt-driven self-check in-flight cho lane `risky`**        | ✅ **done**       | skill `caw:doubt-check`; `/caw:code` chạy ở main session cho lane risky + task non-trivial   |
| Cherry-pick gap skill: security / performance / observability | ✅ **done**       | `caw:security-hardening`, `caw:performance-optimization`, `caw:observability` (load theo lane via skills_hint; KHÔNG wholesale) |
| `context-engineering` discipline (phiên dài/budget)           | ✅ **done**       | skill `caw:context-engineering` (budget layer trên CONTEXT_RULES pull)                       |
| `source-driven-development` rule mỏng (tra docs trước code)   | ✅ **done**       | `rules/common/source-driven.md` — bắt query Context7 trước khi code framework-specific       |
| `interview-me`/`idea-refine` làm mẫu cho bước clarify         | ✅ **đã có (D3)** | clarify gate ở planner đã giải — không adopt skill riêng                                      |

---

**Một câu:** Addy củng cố rằng mainstream **skill-centric, không DB** (caw đi riêng — biết
chi phí), và **thiết kế harness của caw vẫn đúng cho nhu cầu memory của anh**. Thứ đáng
mượn nhất là **`doubt-driven-development`** — một quality gate **in-flight** mà caw đang
thiếu hẳn (reviewer chỉ post-hoc); cộng vài **gap skill** (security/perf/observability)
cherry-pick có chọn lọc. Giữ Superpowers làm spine, Addy là nguồn nhặt điểm — không thay,
không bê nguyên.

# Link repo: https://github.com/addyosmani/agent-skills
