# AGENTS.md - DSH 视频管理插件核心约束与开发规范

本文档记录 `dsh-video-manager` 插件的核心红线、技术选型约束、UI 交互规范以及面向 AI Agent 的设计要求。所有后续介入此项目的 Agent 必须严格遵守以下规范。

---

## 一、核心绝对安全红线 (Safety Guardrails)

### 🚨 物理源视频文件绝对只读 (Zero-Data-Loss Invariant)
1. **严禁物理删除源文件**：
   无论是用户点击“移出素材库”、删除分类目录、批量清理素材、还是 Agent 调用任何删除/清空工具，**绝对禁止调用任何物理删除或修改源视频文件的 API（如 `fs.unlinkSync`, `fs.rmSync`, `fs.promises.unlink` 等）**！
2. **只读资产原则**：
   用户的视频素材可能是耗费巨大成本拍摄的珍贵原始素材（RAW/4K/Log 等）。系统中的 `file_path` 字段仅作为引用指针。
3. **允许清理的范围**：
   删除操作**仅允许清除 SQLite 数据库中的相关记录**，以及 `.dsh-video-manager/cache/` 下由本插件生成的临时衍生缓存（故事板大图 `storyboards/`、分镜关键帧 `keyframes/`、导出的草稿 `exports/`）。

### 🛑 Git 提交纪律规范 (No Direct Commit Without Verification)
- **严禁改动后直接私自执行 `git commit`！**
- 每次代码或功能修改完成后，必须先在当前会话中呈现修改结果并由**用户亲自在 Web 界面或环境中验证**。
- **只有在用户明确下达提交指令**（如“提交”、“可以 commit 了”、“打 tag 吧”等）后，Agent 方可执行 `git add` 和 `git commit`。未获明确批准前，保持工作区改动待核对状态。

---

## 二、架构与技术选型约束

1. **Node.js 内置标准库优先 (Node 24+)**：
   - 数据库层严格使用 Node.js 官方内置的 **`node:sqlite` (`DatabaseSync`)**。
   - 严禁引入 `better-sqlite3`、`sqlite3` 等依赖 node-gyp C++ 本地编译的第三方模块，以杜绝 Windows/macOS/Linux 跨平台编译失败或 Node 版本不兼容的问题。
2. **零外部运行依赖 (Zero-Runtime-Dependency)**：
   - Host 端完全基于 Node 24 原生 ESM。
   - Client 端直接利用 DSH 宿主环境通过 `window.__ModuleLoader__` 注入的 `React`，不引入多余臃肿的外部 runtime，秒速加载，即装即用。
3. **数据存储路径规范**：
   - 数据库默认文件：`<WorkspaceRoot>/.dsh-video-manager/video_manager.db`。
   - 衍生缓存默认目录：`<WorkspaceRoot>/.dsh-video-manager/cache/`。
   - 必须通过 `.gitignore` 将 `.dsh-video-manager/` 完整排除，防止大体积二进制缓存污染 Git 仓库。

---

## 三、目录组织与资产检索规范

1. **多级目录树组织**：
   - 必须支持至少两级目录层级（如：`一级项目: 甘南环线旅游 ➔ 二级场景: 扎尕那 / 甘加秘境`），并支持任意深度的多级子场景。
2. **父级目录自动递归汇总**：
   - 当用户在左侧目录树选中某父级目录时，**必须递归查询并展示该目录及其所有子孙目录中的全部视频素材**（使用 `getAllDescendantFolderIds` 实现 `IN (...)` 范围查询）。
   - 左侧目录树节点的数量徽标必须自底向上累加，准确反映该子树下包含的视频总数与分析进度。
3. **分类删除安全约定**：
   - 删除某个分类目录时，仅删除该目录记录，其内部的视频素材自动解除归属（归入根目录），绝不级联物理删除素材。

---

## 四、UI 与交互设计规范 (UI & UX Guidelines)

1. **严禁使用 Emoji**：
   - 界面上所有图标必须使用全套 2px 矢量的 **`Icon.*` SVG 线性/填充组件**（Lucide 规范），保持专业克制的工业软件视觉品质，杜绝粗糙与不协调。
2. **DSH 官方主题变量规范**：
   - 绝不可使用未受支持的非标准变量（如 `--dsw-alias-bg-canvas`）或硬编码颜色（如 `#1e293b`、`#0f172a` 等）。
   - 必须严格遵循 `--dsw-alias-*` 主题变量：
     - 基础背景：`var(--dsw-alias-bg-base)`
     - 抬升表面与卡片：`var(--dsw-alias-bg-layer-1)`
     - 次级表面与输入框：`var(--dsw-alias-bg-layer-2)`
     - 分割线：`var(--dsw-alias-border-l1)`、强调线：`var(--dsw-alias-border-l2)`
     - 主文字：`var(--dsw-alias-label-primary)`、副文字：`var(--dsw-alias-label-secondary)`
   - ⚠️ **弹窗背景禁忌**：模态弹窗卡片背景必须采用 `var(--dsw-alias-bg-layer-1)`，**严禁使用 `--dsw-alias-bg-overlay`**（其在暗色主题下被宿主固定为浅灰 `#61666b`，会导致白字发虚看不清）。
3. **按钮高对比度原则**：
   - 主操作按钮（Primary Action）统一采用稳定高对比度的蓝色（`#2563eb`）搭配纯白文字（`#ffffff`），确保在任何深色、浅色主题下对比度均在 **5:1 以上**，杜绝“白底白字”。
   - 次要按钮采用 `var(--dsw-alias-bg-layer-2)` + `var(--dsw-alias-border-l2)` + `var(--dsw-alias-label-primary)`。
4. **阅读模式优先 (View Mode First)**：
   - 素材详情（分镜解析、音频提示、基础信息）**默认必须处于正常阅读浏览状态**，展示优美的排版段落、标签与小徽标，严禁默认将满屏输入框直接糊在用户眼前。
   - 用户必须通过点击明确的 **【✏️ 编辑】** 按钮才进入可修改表单，保存或取消后即刻恢复清爽阅读模式。
5. **操作菜单收敛原则 (More Menu `···`)**：
   - 目录项和素材卡片上不应直接常驻刺眼的红色删除按钮，统一收纳在 **`···` (更多操作)** 弹出菜单中（包含重命名、移动到分类、AI 重新切分、移出素材库）。

---

## 五、面向 AI Agent 的交互与工具调用指南

在 AI 视频剪辑工作流中，Agent 应遵循以下标准编排范式：

1. **找素材与灵感召回**：
   - 使用 `video_manager_search_shots({ query: "日落金山 远景航拍" })` 进行自然语言分镜语义检索，获取镜头毫秒级入出点与文件物理路径。
   - 使用 `video_manager_get_video({ video_id, include_shots: true, include_audio: true })` 获取完整素材时序信息。
2. **素材多模态分析流程**：
   - 触发底层切分与故事板：调用 `video_manager_trigger_analysis({ video_id })`，获取 4x4 拼图大图绝对路径。
   - Agent 查看故事板大图后，调用 `video_manager_upsert_shots` 回写审美解析（景别、运镜、画面详述、评分）。
   - 调用 `video_manager_update_audio_info` 回写字幕时间戳、BPM 与音乐情绪。
   - 调用 `video_manager_update_video` 回写全片摘要并将状态设为 `analyzed`。
3. **成片工程导出**：
   - 当编排好剪辑序列后，调用 `video_manager_export_project`，优先输出 `jianying`（剪映本地草稿目录）或 `fcpxml`，直接交付给用户剪辑软件打开。
