# caw — Master Action Plan

Gộp 6 report (workflow, hooks, hooks-refactor, remaining-folders, vs-best-practice 1+2),
khử trùng lặp, xếp theo **effort**. Mỗi việc có: file đụng tới, thay đổi, và acceptance
check. Một số việc là **DECISION** (owner chọn nhánh trước, rồi agent thực thi).

> Repo: `tuannafed/caw-v2` · plugin gốc: `plugins/caw/`

---

## ⏱️ STATUS (cập nhật) — phần lớn ĐÃ LÀM

| Mục | Trạng thái |
|---|---|
| A4 MultiEdit matcher | ✅ done (`Edit\|Write\|MultiEdit`) |
| A5 cli/ → harness/tests/ | ✅ done |
| A6 GLOSSARY giữ + cross-link HARNESS | ✅ done |
| **A1 memory: project** (mở rộng cả 5 agent) | ✅ done |
| A2 model routing | ❌ **BỎ** — `model:` per-agent bị bug #44385 (CC bỏ qua frontmatter). Re-add khi CC fix |
| A3 skills preload | ❌ **BỎ** — không có field `skills:` cho subagent (verified) |
| B1 companion onboarding | ✅ done |
| B2 hooks refactor (→9 file) | ✅ done |
| B3 secret-scanner → gitleaks | ✅ done |
| B5 dangerous-actions → permissions.deny | ✅ done |
| C1 evolution → `/caw:maintain` | ✅ done (command, không cần scheduled) |
| C2 tools/backlog | ✅ done — fix chạy v2 + status từ harness.db |
| **B4** rules → `.claude/rules/` lazy | ⏳ chưa — hiện Read eager (đã hoạt động); B4 là *nâng cấp* |
| **B6** status line đọc harness.db | ⏳ chưa |
| Tier D roadmap | defer |

> Ngoài plan, đã fix thêm (session sau khi viết plan): story/task terminology + `US-NNN`
> + epics; gitleaks strip mọi v1 variant; CLAUDE.md `@-import` append; `--refresh`
> re-sync UPPER docs; `resolve_db_path` → project root (DB không còn sinh rác theo cwd).

---

## 📌 FACTS đã verify — agent DÙNG NGUYÊN, KHÔNG đoán lại, KHÔNG web-search đổi

- Plugin slug (marketplace official tự có sẵn, không cần add):
  `superpowers@claude-plugins-official`, `frontend-design@claude-plugins-official`,
  `context7@claude-plugins-official` ← KHÔNG dùng `context7@context7-marketplace`.
- Context7 là MCP server (npx); env tuỳ chọn `CONTEXT7_API_KEY` (free key ở
  context7.com/dashboard) → thiếu = tier ẩn danh rate-limit thấp.
- Native agent memory: field `memory: user|project|local` (CC v2.1.33). `project` =
  version-controlled, team-shared. 200 dòng đầu MEMORY.md nạp vào system prompt.
- `paths:` lazy-load CHỈ chạy ở `.claude/rules/` cấp **project**, KHÔNG chạy với rule
  trong plugin (`${CLAUDE_PLUGIN_ROOT}/rules/`).
- Model alias frontmatter hợp lệ: `opus` / `sonnet` / `haiku` (hoặc full string như
  caw đang dùng `claude-sonnet-4-6`). Giữ convention hiện có của repo.
- hooks.json plugin dùng cấu trúc nested `{"hooks":{"PreToolUse":[...]}}` + matcher
  **case-sensitive** (`Edit` ≠ `MultiEdit`). PreToolUse chặn = **exit 2**.

## ✅ ĐÃ FIX (commit 4035d35) — ĐỪNG làm lại

Coding rule wired vào coder/reviewer (Read eager); trace hook; drop code-review rule;
task-read-gate; gộp 2 settings.json; sửa doc "every agent loads". (Tier B #B4 sẽ NÂNG
CẤP phần rule này, không phải làm lại.)

---

## TIER A — Sửa frontmatter/config (mỗi việc ~5–15’, rủi ro thấp, lợi ích cao)

### A1. `memory: project` cho reviewer + coder ⟵ giá trị cao nhất Tier A

- File: `plugins/caw/agents/reviewer.md`, `coder.md` (frontmatter).
- Thêm `memory: project`. Trong body thêm 1 dòng: _"Trước khi làm: đọc memory. Sau khi
  xong: ghi pattern/lỗi tái diễn/quyết định kiến trúc vào memory."_
- Vì sao: caw đang thiếu hẳn tầng "kiến thức học được qua session" (bổ sung harness,
  không thay). Native, team-shared, 0 bảo trì.
- Accept: 2 agent có `memory: project`; thư mục `.claude/agent-memory/<agent>/` được
  tạo và cập nhật sau một phiên review.

### A2. Model routing per-agent (`model:`)

- File: 5 agent `plugins/caw/agents/*.md`.
- `planner` → **opus** (lý luận khó: phân rã spec, chọn lane, đánh giá rủi ro).
- `coder` / `tester` / `reviewer` → **sonnet** (giữ).
- `setup` → **haiku** (cơ học).
- Giữ convention chuỗi của repo (vd `claude-opus-4-x` / `claude-sonnet-4-6` /
  `claude-haiku-4-5`) hoặc alias `opus|sonnet|haiku`.
- Accept: mỗi agent có `model:` đúng tier; pipeline chạy không lỗi.

### A3. Skill preload (`skills:`) cho skill LÕI của agent

- File: `coder.md` (+ `reviewer.md` nếu hợp).
- Thêm `skills:` frontmatter preload skill **luôn áp dụng**: vd coder →
  `[api-contract, error-handling-patterns]`. Skill **tình huống** (nextjs-feature,
  react-component-testing) vẫn để Skill-tool runtime.
- Vì sao: preload = có sẵn từ token 0, deterministic, không phụ thuộc agent tự nhớ gọi.
- Accept: skill lõi xuất hiện trong context agent ngay khi khởi động (không cần Skill call).

### A4. Matcher thêm `MultiEdit` (cho hook GIỮ LẠI sau refactor)

- File: `plugins/caw/hooks/hooks.json`.
- Đổi `"matcher": "Edit"` → `"Edit|MultiEdit"` ở các hook **được giữ** (tối thiểu
  `task-read-gate`). Các hook sắp cắt (warn-debug-leftovers, post-edit-accumulator)
  không cần.
- Accept: task-read-gate fire cả khi agent dùng MultiEdit.

### A5. cli/ → tests/ (đổi tên cho hết hiểu lầm)

- `cli/` giờ chỉ còn `cli/tests/` (script SHA-pin đã xoá). Đổi `cli/` → `tests/` (root)
  hoặc `plugins/caw/harness/tests/`. Cập nhật `.github/workflows/test.yml`, README, CLAUDE.md.
- Accept: `pytest` xanh ở path mới; CI pass.

### A6. Dọn vặt

- Xoá `plugins/caw/templates/docs-caw/GLOSSARY.md` **nếu** xác nhận không nơi nào ref
  (commit history có "remove glossary" → khả năng vestigial).
- Cross-link `HARNESS.md` (template) ⟷ `harness/README.md` (source) để tránh drift.
- Accept: không ref gãy; 2 doc trỏ nhau.

---

## TIER B — Scaffold / wiring (mỗi việc ~30–90’, rủi ro vừa)

### B1. Companion onboarding (prompt đã có — áp nếu CHƯA làm)

- (a) Thêm lệnh cài tường minh 3 companion vào README/quickstart (path thủ công phải đủ).
- (b) `CONTEXT7_API_KEY`: note trong README + key rỗng trong settings template (KHÔNG
  hardcode key thật).
- (c) `setup.md` preflight: thử `Skill(test-driven-development)`; lỗi → in cảnh báo +
  3 lệnh cài, KHÔNG chặn cứng.
- (d) Sửa "honest note": enabledPlugins chỉ tự install khi dùng settings.json đã commit.
- Accept: đọc README path thủ công từ 0 → cài được full stack; setup cảnh báo sớm khi
  thiếu companion; grep `context7@context7-marketplace` → trống.

### B2. Refactor hooks (cắt về ~6 file) ⟵ xem `caw-hooks-refactor.md`

- **GIỮ**: `task-read-gate`, `record-trace`, **một** secret-scanner (xem B3), +
  dispatcher `run-with-flags` + lib `hook-flags`.
- **CẮT**: `suggest-compact` (trùng native autocompact), `warn-debug-leftovers` (trùng
  rule+reviewer+biome), `prompt-injection-detector` (generic/advisory — hoặc hạ
  `strict`-only), `stop-format-typecheck` + `post-edit-accumulator` + `resolve-formatter`
  (coder+coding-style+biome đã lo format), `session-summary` (cosmetic — tuỳ chọn).
- Gỡ wiring tương ứng trong hooks.json; cập nhật README hooks (nêu hook ungated nếu còn).
- Accept: hooks.json chỉ còn hook giữ lại; `pytest`/smoke xanh; không ref tới file đã xoá.

### B3. Hợp nhất secret-scanner (chọn 1) — **DECISION**

- Hiện có 2: `pre-commit-secrets.js` (regex tay) + `gitleaks.toml` (không runner).
- **(A)** wire gitleaks thật (lefthook/pre-commit) + **xoá** `pre-commit-secrets.js`.
- **(B)** giữ JS + **xoá** `gitleaks.toml`.
- Accept: chỉ còn 1 cơ chế; commit thử có secret bị chặn.

### B4. Rule coding → `.claude/rules/` lazy-load (NÂNG CẤP bản Read eager)

- Hiện coder/reviewer Read rule **eager**. Thay bằng: `/caw-setup` scaffold các rule
  coding (`coding-standards`, `coding-style`, `package-manager`, `commit-conventions`,
  `react-state-deps`) vào **`.claude/rules/`** của project (giữ frontmatter `paths:`).
  Bỏ phần Read eager tương ứng trong agent (giữ Read cho rule KHÔNG có paths:
  harness-contract, skill-loading).
- Vì sao: `paths:` lazy-load chạy thật ở `.claude/rules/`, chỉ nạp khi đụng file khớp →
  đúng idiom + tiết kiệm context.
- Accept: sửa file `.ts` → rule coding tự xuất hiện; sửa file không khớp → không nạp.

### B5. `dangerous-actions-blocker` → `permissions.deny` (native)

- Thay hook bằng deny rules trong settings (rm -rf, `git push --force` không
  `--force-with-lease`, mkfs, dd…). Bỏ hook khỏi hooks.json (đỡ một dispatcher path).
- Lưu ý: hook cũ vốn gate `strict`-only (tắt mặc định) → chuyển permissions làm guard
  **bật mặc định**, an toàn hơn cho team.
- Accept: lệnh huỷ diệt bị Claude Code từ chối ngay; hook gỡ sạch.

### B6. Status line surface harness state

- Thêm status-line script (`.claude/settings.json`) đọc `harness.db` in story/task/lane
  hiện tại — đúng nguồn-sự-thật.
- Accept: status line hiện trạng thái story đang chạy, khớp `harness-cli query matrix`.

---

## TIER C — DECISION trước, rồi thực thi (lớn hơn)

### C1. Tầng evolution (audit/propose/maturity/state-drift/scoring, ~1090 LOC)

Hiện document trong HARNESS.md nhưng **pipeline không gọi** → dựa kỷ luật chạy tay.

- **(A) Giữ + tự động hoá:** wire `audit/maturity/propose` vào **Scheduled Task /
  Routine / `/loop`** (vd weekly) và/hoặc thêm `/caw:audit` command → biến thành bước
  workflow khám phá được.
- **(B) Hạ cấp/Trim:** gọi đúng tên "operator tooling tuỳ chọn", tách khỏi mental model
  lõi (đừng để HARNESS.md ngụ ý là flow hằng ngày), hoặc cắt bớt module ít dùng.
- Quyết theo: **team có thật sự chạy audit/maturity định kỳ không?**
- Accept (nếu A): có scheduled task/command gọi được, ghi kết quả vào harness.

### C2. `tools/backlog` (~7000 LOC Astro/React)

- Trước hết **verify status-drift**: board đọc markdown — xác nhận status lấy từ
  harness.db (hoặc story front-matter đồng bộ DB), không thì Kanban lệch.
- Rồi **DECISION value-vs-maintenance**: sau khi có B6 (status line), viewer này còn
  xứng 7000 LOC + stack frontend riêng để bảo trì? Giữ / hạ "tuỳ chọn" / cắt.
- Accept: nếu giữ → status nguồn từ DB; nếu cắt → gỡ ref README/CLAUDE.

---

## TIER D — Roadmap (defer, khi scale team/monorepo)

- **Parallelism + git worktree isolation** cho agent chạy song song trên story lớn
  (Superpowers dùng pattern này).
- **Monorepo skill scoping**: đặt skill theo `packages/x/.claude/skills/` để discover
  on-demand; theo dõi char budget (`/context`, `SLASH_COMMAND_TOOL_CHAR_BUDGET`).
- **Spec-kit stage**: thêm `constitution` (bất biến toàn dự án) + `clarify` (vòng hỏi
  rõ trước plan) vào planner.

---

## Thứ tự đề xuất chạy

1. **Tier A toàn bộ** (frontmatter/config — rẻ, lợi ích ngay): A1→A2→A3→A4→A5→A6.
2. **Tier B** theo: B4 (rules lazy) → B2+B3 (hooks gọn) → B5 (permissions) → B1 (companion) → B6 (status line).
3. **Tier C**: chốt 2 decision (C1 evolution, C2 backlog) rồi thực thi.
4. **Tier D**: theo nhu cầu.

> Mỗi việc có acceptance check — agent nên chạy `pytest cli/tests plugins/caw/harness`
> (hiện 104 pass) sau mỗi tier để chắc không hồi quy.
