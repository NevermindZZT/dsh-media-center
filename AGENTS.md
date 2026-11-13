# AGENTS.md - DSH 媒体资源库插件核心约束与开发规范

本文档记录 `dsh-video-manager` 插件的核心红线、技术选型约束、UI 交互规范以及面向 AI Agent 的设计要求。所有后续介入此项目的 Agent 必须严格遵守以下规范。

---

## 一、核心绝对安全红线 (Safety Guardrails)

### 🚨 物理源媒体文件绝对只读 (Zero-Data-Loss Invariant)
1. **严禁物理删除源文件**：
   无论是用户点击“移出素材库”、删除分类目录、批量清理素材、还是 Agent 调用任何删除/清空工具，**绝对禁止调用任何物理删除或修改源媒体文件的 API（如 `fs.unlinkSync`, `fs.rmSync`, `fs.promises.unlink` 等）**！
2. **只读资产原则**：
   用户的视频、音乐及其他媒体资产可能是耗费巨大成本创作或取得的珍贵源文件。系统中的 `file_path` 字段仅作为引用指针。
3. **允许清理的范围**：
   删除操作**仅允许清除 SQLite 数据库中的相关记录**，以及 `.dsh-video-manager/cache/` 下由本插件生成的临时衍生缓存（故事板大图 `storyboards/`、分镜关键帧 `keyframes/`、音乐频谱图 `music-spectrograms/`、导出的草稿 `exports/`）。

### 🛑 Git 提交与版本管理纪律规范 (Strict Commit & Versioning Rules)
1. **必须验证后方可提交**：
   严禁改动后私自执行 `git commit`！每次代码修改完成后，必须先在当前会话中呈现修改结果并由**用户亲自在 Web 界面或环境中验证**。
2. **严禁擅自修改版本号与打 Tag**：
   当用户下达“提交”、“提交改动”等常规指令时，**只执行普通的 `git add` 和 `git commit`**，**严禁擅自修改 package.json 版本号，严禁擅自创建 git tag**！
   只有在用户**明确要求“改动版本号为 X”或“打 tag X”**时，方可修改版本号并打标签。未获明确指令前，版本号与 Tag 保持原样不变。

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

在 DSH 视频/媒体工作流中，素材发现与标注管理在插件工具中完成；创意讨论、最终选曲和时间线迭代仍由当前 DSH 会话 Agent 负责。插件按用户主动请求可用已配置的图像模型解读派生频谱图，给出带置信度的粗略速度/相对节奏点提示及主观场景/风格建议；这些不是DSP测量或精确拍点，标签可人工编辑，模型点须另行试听确认，不自动写入DSP确认点。

1. **找素材与素材证据**：
   - 使用 `video_manager_search_shots` 搜索镜头，并用 `video_manager_get_video({ video_id, include_shots:true, include_audio:true })` 查看完整分镜标注与时间范围；必要时先查看故事板或使用单片段精读候选。
   - 如果用户要求导入多个文件夹，使用视频资产库的“导入文件夹”浏览器多选当前目录的直接子文件夹；系统会将其建在左侧当前选中素材分类下，并递归导入所选目录中的视频。Agent 工具 `video_manager_import_subfolders` 只能传用户明确选定的目录，不能猜测本地路径。
   - 分镜是既有文字标注，不代表本轮 AI 已观看原片；请在会话中如实标明未核验的内容。
2. **音乐与测量**：
   - 使用 `video_manager_edit_music_list` 检索本地音乐，`video_manager_edit_music_analyze` 默认测量整首音频（最多600秒）；本地 transient 检测仅为内部中间量，原始 onset 时间列表不再存取/返回。BPM 与DSP `beat_candidates` 均为估计，只有试听并明确确认的点才进入 `user_confirmed_beats`。
   - 只有用户试听并明确确认DSP `beat_candidates` 时，才调用 `video_manager_edit_music_confirm_beats`；模型生成的近似节奏提示只可从 UI 勾选并单独标记为 `user_confirmed_model_beats`，永不并入DSP `user_confirmed_beats`。Agent 风格建议仍须用户明确批准后才通过 `video_manager_edit_music_set_styles` 保存。
   - 可通过音乐库 UI 的“大模型频谱解读”，或仅在用户明确要求时调用 `video_manager_edit_music_spectrogram_interpret({music_id,analysis_id,confirmed:true})`，将所选窗口生成的对数频率谱图发送给已配置图像模型；只传派生图片，不传原始音频。模型的速度/相对节奏点是粗略视觉估计，场景/风格建议是主观判断，需试听/人工审阅。
   - Jamendo 只搜索元数据；它不是授权验证或自动下载。只有用户明确确认个人用途后，才能用 `video_manager_edit_music_confirm_personal` 记录其声明。
3. **会话内反复编排**：
   - Agent 在对话中根据用户创作需求、候选镜头、真实音乐元数据/测量摘要提出想法；展示后接受反馈并修改。此阶段不调用插件内的 AI 规划器，因为该规划器已移除。
   - 形成 EditProject v1 时，视频与音乐 source 只引用素材库 ID（不传绝对路径）；时间线使用项目整数帧，视频片段必须提供现有 `shot_id` 证据，音乐必须为一条且含权利状态声明。未确认拍点时不填写 beats。
4. **预览与用户授权保存**：
   - 调用 `video_manager_edit_preview_project({ project })` 让插件核验工程结构、来源 ID、分镜范围、音乐成员、文件可用性和预览时源/标注快照。项目暂不持久化；工具返回规范化项目、警告和预览 ID。
   - 在 DSH 会话中向用户展示完整规范化项目和警告；只有用户明确要求保存后，才调用 `video_manager_edit_save_project({ preview_id, confirmed:true })`。保存只能提交该服务端预览 ID，不能替换内容。
   - 保存后的项目可用 `video_manager_edit_projects` 查询。剪映导出仍为实验性视频轨简化格式，不包含音乐，也未在 Windows 剪映 11.7.3 验证；不得承诺用户可直接打开。
