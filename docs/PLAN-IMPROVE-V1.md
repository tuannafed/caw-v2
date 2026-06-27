# caw — Master Action Plan

Gộp 6 report (workflow, hooks, hooks-refactor, remaining-folders, vs-best-practice 1+2),
khử trùng lặp, xếp theo **effort**. Mỗi việc có: file đụng tới, thay đổi, và acceptance
check. Một số việc là **DECISION** (owner chọn nhánh trước, rồi agent thực thi).

> Repo: `tuannafed/caw-v2` · plugin gốc: `plugins/caw/`

---

## ⏱️ STATUS (cập nhật @ v2.0.9) — phần lớn ĐÃ LÀM

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| A1 memory: project | ✅ done | mở rộng cả **5 agent** (không chỉ coder/reviewer) + body instruction |
| A2 model routing | ❌ **BỎ** | `model:` per-agent bị **bug #44385** (CC bỏ qua frontmatter). Re-add khi CC fix |
| A3 skills preload | ❌ **BỎ** | **không có** field `skills:` cho subagent (verified) |
| A4 MultiEdit matcher | ✅ done | `Edit\|Write\|MultiEdit` |
| A5 cli/ → tests/ | ✅ done | `plugins/caw/harness/tests/` |
| A6 GLOSSARY + cross-link | ✅ done | GLOSSARY **giữ** (đã quyết), 2 HARNESS doc cross-link |
| B1 companion onboarding | ✅ done | 3 lệnh + CONTEXT7_API_KEY + setup preflight |
| B2 hooks refactor | ✅ done | còn 9 file .js (cắt suggest-compact, warn-debug, dangerous-actions) |
| B3 secret-scanner | ✅ done | chuẩn hoá **gitleaks** (xoá pre-commit-secrets.js) |
| B4 rules → .claude/rules lazy | ✅ done | scaffold + `paths:` native lazy-load + bỏ Read eager |
| B5 dangerous-actions → permissions.deny | ✅ done | hook xoá, deny block bật mặc định |
| B6 status line | ✅ done | `caw-statusline.sh` đọc harness.db (DB source of truth) |
| C1 evolution | ⏳ **một phần** | có `/caw:maintain` (manual). Event-driven (auto khi story close) **chưa làm** |
| C2 tools/backlog | ✅ done | fix chạy v2 (US-NNN/epics) + status overlay từ harness.db |
| **C3 canonical spec** (archive→spec) | ❌ **chưa làm** |  |
| **C4 constitution** | ⏳ **một phần** | D3 đã làm constitution dùng `.claude/rules/project.md` (planner Step 0.5 + clarify gate). **Còn**: reviewer flag invariant + cân nhắc `CONSTITUTION.md` riêng |
| D3 spec-kit (constitution + clarify) | ✅ done | planner Step 0.5 constitution + Step 0.7 clarify gate |
| D1 parallelism + worktree | ✅ done | verified `isolation: "worktree"` native → `/caw:code --all` parallel groups dùng worktree riêng + merge; `worktree.baseRef: head`; planner ép group file-disjoint |
| D2 monorepo skill scoping | 🗺️ defer | bỏ qua — caw chỉ 4 authored skill, chưa tràn context. Làm khi monorepo có nhiều skill per-package |

> **Verify-trước-khi-làm đã cứu 2 lần:** A2/A3 (`model:`/`skills:` field không hoạt động → bỏ)
> và B4 (`paths:` thực ra CÓ hoạt động ở `.claude/rules/` → làm). Đừng đoán fact.
>
> **Ngoài plan, đã fix thêm** (session sau khi viết plan): story/task terminology + `US-NNN`
> + epics convention; gitleaks strip mọi v1 hook variant; CLAUDE.md `@-import` append;
> `--refresh` re-sync UPPER policy docs; `resolve_db_path` → project root (DB không còn sinh
> rác theo cwd); migrate FE/BE từ v1 sang US-NNN.

---

## 📌 FACTS đã verify — agent DÙNG NGUYÊN, KHÔNG đoán lại, KHÔNG web-search đổi

- Plugin slug (marketplace official tự có sẵn, không cần add):
  `superpowers@claude-plugins-official`, `frontend-design@claude-plugins-official`,
  `context7@claude-plugins-official` ← KHÔNG dùng `context7@context7-marketplace`.
- Context7 là MCP server (npx); env tuỳ chọn `CONTEXT7_API_KEY` (free key ở
  context7.com/dashboard) → thiếu = tier ẩn danh rate-limit thấp.
- Native agent memory: field `memory: user|project|local` (CC v2.1.33). `project` =
  version-controlled, team-shared. 200 dòng đầu MEMORY.md nạp vào system prompt.
  ⚠️ **Caveat (verified):** memory chỉ activate khi `tools:` có ≥1 trong Read/Edit/Write
  (bug #57507) — caw đã đảm bảo cả 5 agent có đủ.
- `paths:` lazy-load CHỈ chạy ở `.claude/rules/` cấp **project**, KHÔNG chạy với rule
  trong plugin (`${CLAUDE_PLUGIN_ROOT}/rules/`). ✅ **verified đúng** (claude-code-guide) —
  B4 đã scaffold rules ra `.claude/rules/`.
- ⚠️ **`model:` per-agent frontmatter bị bug #44385 — CC BỎ QUA** (subagent dùng model
  của parent). Đừng dựa vào nó để route model.
- ⚠️ **KHÔNG có field `skills:`** preload cho subagent (verified). Skill chỉ load runtime
  qua Skill tool.
- hooks.json plugin dùng cấu trúc nested `{"hooks":{"PreToolUse":[...]}}` + matcher
  **case-sensitive** (`Edit` ≠ `MultiEdit`). PreToolUse chặn = **exit 2**.

## ✅ ĐÃ FIX (commit 4035d35) — ĐỪNG làm lại
Coding rule wired vào coder/reviewer (Read eager); trace hook; drop code-review rule;
task-read-gate; gộp 2 settings.json; sửa doc "every agent loads". (Tier B #B4 ĐÃ NÂNG
CẤP phần rule này sang lazy-load — không phải làm lại.)

---

## TIER A — Sửa frontmatter/config (mỗi việc ~5–15’, rủi ro thấp, lợi ích cao)  ✅ DONE

### A1. `memory: project` cho 5 agent  ✅ DONE — giá trị cao nhất Tier A
- File: tất cả `plugins/caw/agents/*.md` (frontmatter + body).
- Thêm `memory: project` + section Memory: *"Trước khi làm: đọc memory. Sau khi xong:
  ghi pattern/lỗi tái diễn/quyết định kiến trúc vào memory."* (coder/reviewer đầy đủ;
  planner/tester/setup gọn). planner thêm `Edit` vào tools để memory activate.
- Vì sao: bổ sung tầng "kiến thức học qua session" (DB = state, markdown = prose, memory
  = lessons). Native, team-shared, 0 bảo trì.
- Accept: ✅ 5 agent có `memory: project`; `.claude/agent-memory/` team-shared (KHÔNG gitignore).

### A2. Model routing per-agent (`model:`)  ❌ BỎ (verified non-functional)
- Verdict: `model:` frontmatter bị **bug #44385** — CC bỏ qua, subagent dùng model parent.
  CLAUDE.md có maintainer-note cảnh báo đừng re-add. Re-visit khi CC ship fix.

### A3. Skill preload (`skills:`)  ❌ BỎ (field không tồn tại)
- Verdict: **không có** field `skills:` preload cho subagent. Skill chỉ load runtime.
  Skill lõi vẫn để Skill-tool (api-contract/error-handling-patterns trong skills_hint).

### A4. Matcher thêm `MultiEdit`  ✅ DONE
- `hooks.json`: hook giữ lại dùng `Edit|Write|MultiEdit`.

### A5. cli/ → tests/  ✅ DONE
- Gộp vào `plugins/caw/harness/tests/`; cập nhật `.github/workflows/test.yml`, README, CLAUDE.md.

### A6. Dọn vặt  ✅ DONE
- GLOSSARY **giữ** (có giá trị tham khảo, không vestigial — đã quyết). Cross-link
  `HARNESS.md` (template) ⟷ `harness/README.md` (source). Không ref gãy.

---

## TIER B — Scaffold / wiring (mỗi việc ~30–90’, rủi ro vừa)  ✅ DONE

### B1. Companion onboarding  ✅ DONE
- (a) 3 lệnh cài companion tường minh trong README/quickstart + plugin README.
- (b) `CONTEXT7_API_KEY` rỗng trong settings template + note (không hardcode).
- (c) `setup.md` Phase 0.5 preflight: thử `Skill(test-driven-development)` → cảnh báo +
  3 lệnh, KHÔNG chặn cứng.
- (d) "Honest note" làm rõ 2 đường nhận companion. Accept: ✅ grep `context7@context7-marketplace` trống.

### B2. Refactor hooks (→ 9 file)  ✅ DONE
- **GIỮ**: `task-read-gate`, `record-trace`, `session-summary`, `stop-format-typecheck`
  + `post-edit-accumulator`, `prompt-injection-detector` (strict-only), gitleaks runner
  trong setup, + dispatcher `run-with-flags` + lib `hook-flags`/`resolve-formatter`.
- **CẮT**: `suggest-compact` (native autocompact), `warn-debug-leftovers` (rule+lint),
  `dangerous-actions-blocker` (→ permissions.deny, B5), `pre-commit-secrets.js` (→ gitleaks, B3).
- Accept: ✅ hooks.json chỉ còn hook giữ lại; tests xanh; không ref file đã xoá.

### B3. Secret-scanner → gitleaks  ✅ DONE (chọn nhánh A)
- Wire gitleaks pre-commit hook trong `/caw:setup` (marker block, strip mọi v1 variant) +
  xoá `pre-commit-secrets.js`. Accept: ✅ commit có secret bị chặn (verified trên sos/Direct2Vet).

### B4. Rule coding → `.claude/rules/` lazy-load  ✅ DONE
- `/caw:setup` scaffold 5 coding rule (`coding-standards`, `coding-style`, `package-manager`,
  `commit-conventions`, `react-state-deps`) vào `.claude/rules/` (giữ `paths:`). Bỏ Read
  eager ở coder Step 3.5 + reviewer Step 1.5. Rule không có `paths:` (harness-contract,
  skill-loading) vẫn Read explicit. `.gitignore` surgical (giữ `.claude/rules/` committed).
- Accept: ✅ sửa `.ts` → rule tự nạp; file không khớp → không nạp.

### B5. `dangerous-actions-blocker` → `permissions.deny`  ✅ DONE
- 15 deny rules trong settings (rm -rf, push --force, mkfs, DROP TABLE…), hook gỡ sạch.
  Bật mặc định (an toàn hơn hook strict-only). Accept: ✅ lệnh huỷ diệt bị từ chối.

### B6. Status line surface harness state  ✅ DONE
- `plugins/caw/statusline/caw-statusline.sh` đọc `harness.db` read-only → in
  `caw ▶ <story> · lane:<x> · done/total`. Wired trong settings template; im lặng ngoài
  caw project. Accept: ✅ khớp `harness-cli query matrix` (verified FE/BE).

---

## TIER C — DECISION trước, rồi thực thi (lớn hơn)

### C1. Tầng evolution (audit/propose/maturity/state-drift/scoring, ~1090 LOC)  ⏳ MỘT PHẦN
Hiện document trong HARNESS.md; pipeline gọi qua `/caw:maintain` (manual). **Chưa** có
auto-trigger event-driven.
- ✅ **Đã làm:** `/caw:maintain` command (audit + maturity + propose, `--commit` file proposals)
  — biến "chạy tay theo doc dài" thành 1 bước khám phá được.
- ⏳ **Còn (C1-A nâng cao):** wire `audit/maturity/propose` chạy **event-driven tại điểm
  phản tỉnh tự nhiên** — khi **story/milestone hoàn tất** (pattern gstack `/retro`, GSD
  `complete-milestone`). Trigger tốt hơn cron: đúng lúc, không dựa kỷ luật. (Ý tưởng: hook
  Stop hoặc coder cuối story gọi `harness-cli audit` khi story status → implemented.)
- Quyết: team có chạy audit/maturity định kỳ không? Nếu có → làm event-driven trigger.

### C2. `tools/backlog` (~7000 LOC Astro/React)  ✅ DONE
- ✅ **verify status-drift:** board trước đọc markdown `overview.yaml` (board TRỐNG với v2).
  Đã fix: scan US-NNN + recurse epics/ + **overlay status/lane từ harness.db** (source of
  truth, fallback markdown) + map status v2 + security (host 127.0.0.1).
- **DECISION value-vs-maintenance** (còn ngỏ): sau B6 status line, viewer 7000 LOC còn xứng
  bảo trì? — để owner quyết khi cần; hiện đã chạy đúng v2.

### C3. Canonical capability spec (pattern OpenSpec propose→apply→**archive**)  ❌ CHƯA LÀM
- caw tích **đống story đã xong** nhưng không fold lại → sau N story, "hệ thống HIỆN làm
  gì" nằm rải rác. Học OpenSpec: khi **archive story**, fold delta vào một **canonical
  spec per-capability** (markdown, vd `docs/caw/specs/<capability>.md`).
- Lợi: cho human/agent một nguồn "current truth" query được; input tốt cho C1 maturity/audit.
- Markdown-native (không đụng DB). Accept: archive một story → canonical spec tương ứng cập nhật.

### C4. Constitution layer (pattern Spec Kit `/speckit.constitution`)  ⏳ MỘT PHẦN
- ✅ **Đã làm (D3):** planner Step 0.5 đọc constitution (`.claude/rules/project.md` lock-ins,
  forbidden, domain rules + conventions + CLAUDE.md) + Step 0.7 clarify gate + Step 5
  constitution-compliance check. Plan vi phạm lock-in mà không có ADR = invalid.
- ⏳ **Còn:** (a) **reviewer** flag vi phạm invariant rõ ràng như một dimension (hiện chỉ
  planner enforce); (b) cân nhắc tách `docs/caw/CONSTITUTION.md` riêng cấp **sản phẩm/kiến
  trúc** (module boundary, data principle, security) thay vì chỉ stack lock-ins trong
  `project.md`. Accept: planner đọc constitution (✅); reviewer flag vi phạm invariant (⏳).

---

## TIER D — Roadmap
- **D1. Parallelism + git worktree isolation**  → ✅ **ĐÃ LÀM**. Verify (claude-code-guide):
  Agent tool có param native `isolation: "worktree"` — mỗi subagent một worktree riêng
  (`.git/index` riêng, auto-cleanup). `/caw:code --all` giờ spawn coder song song với
  `isolation: "worktree"` cho group ≥2 task, merge worktree về sau mỗi group; settings
  `worktree.baseRef: "head"` để worktree fork từ branch hiện tại (không phải default);
  planner ép `parallelization_groups` **file-disjoint** để merge không conflict. Vẫn GIỮ
  lean **5 agent** — không nở agent (không GSD 33a/67c, không ECC 48a/143c); chỉ chạy
  song song cùng coder agent trong worktree riêng.
- **D2. Monorepo skill scoping**: 🗺️ **defer (bỏ qua)** — caw chỉ có 4 authored skill,
  chưa tràn context. Đáng làm khi monorepo có **nhiều skill per-package**: đặt skill theo
  `packages/x/.claude/skills/` để discover on-demand; theo dõi char budget (`/context`,
  `SLASH_COMMAND_TOOL_CHAR_BUDGET`).
- **D3. Tách specify (what/why) ↔ plan (how)** + bước `clarify`  → ✅ **ĐÃ LÀM** (clarify gate
  + constitution ở planner). Phần "tách specify↔plan" rõ ràng hơn + skill lẻ Matt Pocock
  (`to-prd`, `to-issues`, `diagnose`, `zoom-out`) vẫn có thể nhặt thêm.
- **(Chiến lược) Đánh giá lại "DB harness có đáng"**: caw là outlier dùng DB (nhiều framework
  dùng markdown git-native). Giữ nếu query cross-agent là giá trị thật, nhưng tối thiểu vá
  drift markdown↔DB (gắn C2/C3). ✅ C2 đã vá drift (board đọc DB); C3 sẽ fold spec.

---

## Thứ tự đề xuất chạy (CẬP NHẬT — phần lớn đã xong)
1. ✅ **Tier A** (A1, A4, A5, A6 done; A2/A3 bỏ sau verify).
2. ✅ **Tier B** (B1-B6 done).
3. **Tier C**: C2 ✅; C4 một phần (D3) ✅; **còn C1-event-driven, C3 canonical spec, C4-reviewer-flag**.
4. **Tier D**: D3 ✅; D1/D2 + DB-strategy theo nhu cầu.

### Việc còn lại đáng cân nhắc (theo giá trị)
- **C4-b** reviewer flag invariant — siết alignment, effort thấp (sửa reviewer prompt).
- **C1-A** event-driven audit khi story close — tự động hoá evolution layer.
- **C3** canonical capability spec — fold story đã xong thành "current truth".
- **D1/D2** — chỉ khi scale team/monorepo thật.

> Mỗi việc có acceptance check — agent nên chạy `pytest plugins/caw/harness/tests`
> (hiện **105 pass**) sau mỗi tier để chắc không hồi quy.
