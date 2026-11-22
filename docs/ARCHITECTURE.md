# DSH 媒体中心 (dsh-media-center)
## 系统架构与深度设计规范文档

---

## 目录 (Table of Contents)

1. [项目愿景与核心痛点](#1-项目愿景与核心痛点)
2. [核心架构设计原则与红线 (Architectural Invariants)](#2-核心架构设计原则与红线)
3. [分层系统架构 (System Architecture)](#3-分层系统架构)
4. [核心数据模型与存储规范 (Data Schema & Storage)](#4-核心数据模型与存储规范)
5. [关键业务流水线设计 (Key Pipelines & Data Flows)](#5-关键业务流水线设计)
   - 5.1 [素材导入与多级目录树镜像流水线](#51-素材导入与多级目录树镜像流水线)
   - 5.2 [底层视听特征提取与故事板合成流水线](#52-底层视听特征提取与故事板合成流水线)
   - 5.3 [工作台直驱 AI 多模态深度分析与审计闭环](#53-工作台直驱-ai-多模态深度分析与审计闭环)
   - 5.4 [AI Agent 自动化剪辑与分镜召回流水线](#54-ai-agent-自动化剪辑与分镜召回流水线)
   - 5.5 [主流剪辑软件工程导出流水线](#55-主流剪辑软件工程导出流水线)
6. [Web 工作台 (Client UI) 架构与响应式设计](#6-web-工作台-client-ui-架构与响应式设计)
7. [Host 端服务与接口契约 (API & Tools)](#7-host-端服务与接口契约)
8. [环境适配、依赖治理与安全架构](#8-环境适配依赖治理与安全架构)
9. [未来演进路线 (Roadmap)](#9-未来演进路线)

---

## 1. 项目愿景与核心痛点

### 1.1 行业背景与痛点
在 AI 赋能的视频剪辑、自动化卡点混剪、影视解说创作等场景中，多模态大语言模型（Multimodal LLM）与 AI Agent 面临以下几个核心痛点：

1. **原始视频数据体积巨大，无法直接塞入 LLM 上下文**：
   4K 60fps、Log 格式的原始拍摄视频体积动辄数 GB 到数十 GB。若直接由大模型端到端处理，无论是网络传输、视频抽帧还是多模态计算，都会面临 Token 爆炸、延迟极高乃至显存溢出（OOM）的问题。
2. **缺乏结构化、毫秒级的时间轴分镜与视听元数据**：
   大模型缺乏对视频“镜头切分点（In/Out Points）、景别（Shot Type）、运镜方式（Camera Movement）、光影构图、气口停顿、音乐节拍（BPM）”的结构化认知。没有结构化数据，剪辑决策只能停留在宽泛的概念描述，无法精确定位到具体的秒数区间。
3. **缺乏直观的人机协同校验与资产组织工作台**：
   纯对话形式的 Agent 交互在素材繁多（成百上千条素材）时体验极差。创作者需要直观查看素材层级、快速预览画面、就地微调 AI 分析结果、批量整理分类。
4. **与下游专业剪辑软件（剪映/FCPX/PR）严重脱节**：
   Agent 输出的剪辑建议如果只能以纯文本表格呈现，用户仍需人工在剪辑软件中重新打点裁剪，生产力提升大打折扣。必须能够直接生成专业剪辑软件工程文件。

### 1.2 系统定位
`dsh-media-center` 插件定位为 **AI 视频剪辑工作流的核心中枢与基础设施**：
- **向上承接**：为 Web 前端创作者提供沉浸式三栏工作台，支持多级目录组织、可视化素材导入、多模态直驱分析、人机协同标注与工程导出。
- **向下打通**：对接本地底层媒体引擎（FFmpeg/FFprobe），提取关键帧、音视频参数、静音停顿与音乐节拍，生成单张 4x4 故事板大图。
- **横向赋能**：通过标准 DSH Tools 体系向 AI Agent 暴露 11 个标准化模型交互工具，支撑 Agent 在对话中进行语义分镜检索、智能脚本排布与工程渲染。

---

## 2. 核心架构设计原则与红线

为了保障系统在高强度创作、海量媒体资产管理下的稳定性与数据安全，确立了以下六大核心设计原则：

```
┌────────────────────────────────────────────────────────────────────────┐
│                        六大核心设计原则与安全红线                      │
├───────────────────────────────┬────────────────────────────────────────┤
│ 1. 物理源文件绝对只读 (Zero-Data-Loss)│ 严禁删除/篡改任何物理视频原片          │
│ 2. 零外部本地编译依赖 (Zero-GYP)       │ Node 24 原生 ESM + node:sqlite         │
│ 3. 视觉 Token 极度节约 (Token Thrift) │ 4x4 故事板雪碧图单图输入，节约 90%+ Token│
│ 4. 插件双轨驱动模型 (Dual-Track Drive)│ 工作台一键直驱分析 + Agent Tools 对话编排 │
│ 5. 沉浸式阅读优先 (View-Mode First)    │ 默认纯净浏览展示，点击编辑进入表单     │
│ 6. 100% 宿主主题自适应与纯矢量规范    │ 严格绑定 --dsw-alias-* 变量，纯矢量 SVG │
└───────────────────────────────┴────────────────────────────────────────┘
```

1. 🚨 **物理源文件绝对只读 (Zero-Data-Loss Invariant)**：
   - 用户的原始视频文件可能是珍贵不可再生的 4K 原片、采访实录或商业素材。
   - 代码层无论在“单片移出素材库”、“删除分类目录”、“批量清理素材”还是“Agent 异常调用”场景下，**绝对禁止调用任何物理删除或篡改磁盘源视频的 API（如 `fs.unlinkSync`, `fs.rmSync` 等）**。
   - 系统中记录的 `file_path` 纯粹为只读资产引用；删除操作仅清理 SQLite 内部元数据及本插件生成的缓存大图。
2. ⚡ **零外部本地编译依赖 (Zero-Native-Compilation Dependency)**：
   - 传统的 SQLite 驱动（如 `better-sqlite3`, `sqlite3`）依赖 node-gyp C++ 本地编译，极易因操作系统、Python 环境或 Visual Studio 编译工具链缺失导致安装失败。
   - 本插件深度基于 **Node.js 24 原生内置的 `node:sqlite` (`DatabaseSync`)**，做到 Host 端原生纯 JS/ESM 执行，零 C++ 编译负担，跨 Windows / macOS / Linux 即装即用。
3. 🎯 **视觉 Token 极度节约哲学 (Token-Thrift Strategy)**：
   - 多模态模型处理长视频或多张高清原图时开销巨大。本方案引入 **4x4 故事板雪碧图 (Contact Sheet)** 技术，将全片自适应切分为 16 个代表性关键快照，拼合为单张轻量 JPEG（约 150KB）。
   - 模型**只需分析 1 张图片**即可洞察全片时序走势与分镜光影，视觉 Token 开销下降 **90% 以上**。
4. 🔄 **双轨驱动范式 (Dual-Track Architecture)**：
   - **自动化流水线轨**：在工作台内支持一键直驱多模态模型批量分析，自动记录分析耗时、Token 消耗与模型审计，免去多轮 Agent 会话周转。
   - **交互决策轨**：保留全套标准 Model-Facing Tools，供 AI Agent 在对话中自由探索素材、撰写剪辑脚本、跨视频语义召回与导出成片草稿。
5. 📖 **生产力阅读模式优先 (View-Mode First)**：
   - 拒绝将大量粗暴的输入框直接堆砌在界面上。分镜卡片、音频参数、视频摘要默认以精致的段落排版、标签徽标和星星评分呈现。
   - 用户主动点击【✏️ 编辑】按钮才进入修改态，保存后恢复清爽阅读视图。
6. 🎨 **100% 宿主视觉系统自适应与纯矢量设计**：
   - 严格绑定 DSH 官方规范的 `--dsw-alias-*` CSS 变量，深色（Dark）模式与浅色（Light）模式实时自适应变色，杜绝白底白字与低对比度问题。
   - 彻底摒弃 Emoji，全界面采用 Lucide 风格的精细 2px 矢量 SVG 图标组件。

---

## 3. 分层系统架构

系统整体分为 **Client 端（Web UI 工作台）**、**Host 端（Node.js 服务运行时）**、**数据与缓存持久层**，以及 **外部 AI 模型与下游剪辑生态**。

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   DSH Web GUI (Client)                                  │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 视频资产管理工作台 (注册于 sidebar.panellist 与 main 插槽)                         │  │
│  │ ├─ 左栏：多级目录树 (展开/折叠、自底向上递归计数、··· 操作菜单、Resizable 调宽)    │  │
│  │ ├─ 中栏：素材瀑布流/网格 (动态故事板快照、多选批量操作条、审计胶囊、检索过滤)      │  │
│  │ ├─ 右栏：深度视听详情工作台 (HTML5视频播放器、分镜时间轴、音频/字幕、基础参数编辑)│  │
│  │ └─ 浮层：可视化目录/文件浏览器 (磁盘盘符直达、批量多选导入、防重提交锁)           │  │
│  └─────────────────────────────────────────▲─────────────────────────────────────────┘  │
└────────────────────────────────────────────┼────────────────────────────────────────────┘
                                             │ HTTP REST / HTTP 206 流媒体播放
┌────────────────────────────────────────────▼────────────────────────────────────────────┐
│                             DSH Plugin Host 端 (Node 24 ESM)                            │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ WebServer API 路由层 (src/host/api/router.js)                                     │  │
│  │ ├─ 目录树与素材 CRUD 接口         ├─ HTTP 206 范围请求视频流分片播放              │  │
│  │ ├─ 文件系统跨盘符动态浏览探测     ├─ 故事板大图与分镜关键帧静态服务               │  │
│  │ └─ 单片/批量 AI 深度分析触发接口  ├─ 剪辑工程一键导出接口                         │  │
│  └──────────────────┬───────────────────────────────┬────────────────────────────────┘  │
│                     │                               │                                   │
│  ┌──────────────────▼─────────────────┐   ┌─────────▼────────────────────────────────┐  │
│  │ MediaEngine 媒体处理引擎           │   │ VideoAiAnalyzer 直驱分析引擎             │  │
│  │ (src/host/media/engine.js)         │   │ (src/host/ai/video-analyzer.js)          │  │
│  │ ├─ FFmpeg/FFprobe 环境分级探测     │   │ ├─ 自动继承 DSH Profile 凭据与模型       │  │
│  │ ├─ 4x4 故事板雪碧图自适应合成      │   │ ├─ 4x4 故事板大图 Base64 视觉注入        │  │
│  │ ├─ silencedetect 气口静音区间提取  │   │ ├─ 影视级 JSON 约束提示词模板渲染        │  │
│  │ └─ 音频 Onset / BPM 节拍计算       │   │ └─ 耗时、Prompt/Completion Token 审计入库│  │
│  └──────────────────┬─────────────────┘   └─────────┬────────────────────────────────┘  │
│                     │                               │                                   │
│  ┌──────────────────▼─────────────────┐   ┌─────────▼────────────────────────────────┐  │
│  │ ProjectExporter 剪辑工程导出服务   │   │ ShotSearchService 分镜多维检索服务       │  │
│  │ (src/host/export/project-exporter) │   │ (src/host/search/shot-search.js)         │  │
│  │ ├─ 剪映电脑版草稿目录 (微秒时间戳) │   │ ├─ 中英文分词与 Bi-gram 索引分块         │  │
│  │ ├─ Final Cut Pro XML (v1.9)        │   │ ├─ SQLite FTS5 倒排候选召回              │  │
│  │ └─ CMX 3600 标准 EDL 时间线导出    │   │ └─ 景别、运镜、构图综合权重重排          │  │
│  └──────────────────┬─────────────────┘   └─────────┬────────────────────────────────┘  │
│                     │                               │                                   │
│  ┌──────────────────▼───────────────────────────────▼────────────────────────────────┐  │
│  │ Model-Facing Tools 注册层 (src/host/tools/register-tools.js)                     │  │
│  │ 注册 11 个标准化 Tool 至 DSH 运行时，供 AI Agent 对话中调用                      │  │
│  └──────────────────────────────────────────┬────────────────────────────────────────┘  │
│                                             │ SQL 读写 / FTS 查询                       │
│  ┌──────────────────────────────────────────▼────────────────────────────────────────┐  │
│  │ VideoDatabase 本地存储层 (src/host/db/database.js)                                │  │
│  │ 基于 Node.js 官方内置 node:sqlite (DatabaseSync)                                  │  │
│  └──────────────────────────────────────────┬────────────────────────────────────────┘  │
└─────────────────────────────────────────────┼───────────────────────────────────────────┘
                                              │ 磁盘 I/O
┌─────────────────────────────────────────────▼───────────────────────────────────────────┐
│                                本地持久化与生态集成                                     │
│  ├─ 数据库：<Workspace>/.dsh-media-center/media_center.db                             │
│  ├─ 缓存池：<Workspace>/.dsh-media-center/cache/ (storyboards/, keyframes/, exports/)   │
│  ├─ 外部模型：Zero-Plus / DeepSeek Vision / Qwen-VL 等多模态 LLM                         │
│  └─ 剪辑软件：剪映 (JianYing) / Final Cut Pro / Premiere / 达芬奇 (DaVinci Resolve)     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 核心数据模型与存储规范

### 4.1 目录组织与存储路径约定
系统严格保持工程根目录的整洁，将所有生成的元数据与缓存资源收敛于隐式工作目录中：

```text
<WorkspaceRoot>/
├── .dsh-media-center/           # 插件私有持久化目录 (已自动加入 .gitignore)
│   ├── video_manager.db           # SQLite 核心数据库文件 (node:sqlite)
│   └── cache/                     # 二进制衍生文件缓存池
│       ├── storyboards/           # 4x4 故事板雪碧图 ({video_id}_storyboard.jpg)
│       ├── keyframes/             # 分镜代表性关键帧图片 ({video_id}_shot_{idx}.jpg)
│       └── exports/               # 导出的剪辑工程目录及文件
│           ├── 项目名_时间戳.fcpxml
│           └── 项目名_时间戳.xml
```

### 4.2 数据库 Schema 深度设计

数据库启用 `PRAGMA foreign_keys = ON;` 保障级联关系一致性。

#### 1. 目录表 (`folders`)
支持任意深度的多级树状结构，通过自引用 `parent_id` 组织：
```sql
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,               -- 目录 UUID (如 fld_xxx)
  parent_id TEXT,                    -- 父目录 ID (根目录为 NULL)
  name TEXT NOT NULL,                -- 目录显示名称 (如 "扎尕那")
  relative_path TEXT NOT NULL,       -- 层级全路径 (如 "甘南环线旅游/扎尕那")
  source_dir_path TEXT,              -- 关联的物理磁盘文件夹绝对路径 (可选)
  level INTEGER NOT NULL DEFAULT 1,  -- 深度级别 (1=顶级项目, 2=子场景...)
  sort_order INTEGER DEFAULT 0,      -- 排序权重
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE
);
```

#### 2. 视频主表 (`videos`)
记录物理源文件元数据、提取的音视频编码参数、以及完整的 AI 分析开销审计信息：
```sql
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,                 -- 视频 UUID (如 vid_xxx)
  folder_id TEXT,                      -- 所属分类目录 ID
  file_name TEXT NOT NULL,             -- 文件名 (如 "日落金山_航拍4K.mp4")
  file_path TEXT NOT NULL UNIQUE,      -- 磁盘物理绝对路径 (唯一约束，只读资产引用)
  file_size INTEGER DEFAULT 0,         -- 文件大小 (字节)
  duration REAL DEFAULT 0,             -- 视频时长 (秒，浮点数)
  width INTEGER DEFAULT 0,             -- 分辨率宽度 (像素)
  height INTEGER DEFAULT 0,            -- 分辨率高度 (像素)
  fps REAL DEFAULT 0,                  -- 视频帧率 (如 59.94, 60, 30)
  codec TEXT,                          -- 视频编码 (如 H264, HEVC, PRORES)
  bitrate INTEGER DEFAULT 0,           -- 码率 (bps)
  audio_channels INTEGER DEFAULT 0,    -- 音频声道数
  sample_rate INTEGER DEFAULT 0,       -- 音频采样率 (Hz)
  status TEXT DEFAULT 'imported',      -- 状态: imported(待分析), analyzing(分析中), analyzed(已分析), error
  summary TEXT,                        -- 全片剧情与画面叙事摘要
  user_notes TEXT,                     -- 剪辑建议与人工备忘
  tags TEXT DEFAULT '[]',              -- 业务标签数组 (JSON 序列化存储)
  storyboard_path TEXT,                -- 4x4 故事板大图本地物理路径
  -- AI 审计与开销追踪字段
  ai_model TEXT,                       -- 分析所采用的多模态模型 (如 zero-plus)
  ai_prompt_tokens INTEGER DEFAULT 0,  -- 输入 Token 消耗
  ai_completion_tokens INTEGER DEFAULT 0, -- 输出 Token 消耗
  ai_total_tokens INTEGER DEFAULT 0,   -- 总 Token 消耗
  ai_latency_ms INTEGER DEFAULT 0,     -- 接口端到端分析耗时 (毫秒)
  ai_analyzed_at TEXT,                 -- 分析完成时间戳
  captured_at TEXT,                    -- 可信媒体录制时间；无标签时为 NULL，不使用文件/导入时间
  captured_at_source TEXT,             -- metadata:format.<tag> / metadata:video.<tag> / unknown / unavailable
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE SET NULL
);
```
> **安全隔离约定**：当外键 `folder_id` 对应的目录被删除时，外键触发 `ON DELETE SET NULL`，视频记录被自动解绑转移至根目录，**绝不级联删除视频记录，更绝不触碰磁盘源文件**。

#### 3. 分镜表 (`video_shots`)
记录按镜头切分的时间轴、景别、运镜方式、画面视觉描述与可用度评分：
```sql
CREATE TABLE IF NOT EXISTS video_shots (
  id TEXT PRIMARY KEY,                 -- 分镜 UUID (如 shot_xxx)
  video_id TEXT NOT NULL,              -- 所属视频 ID
  shot_index INTEGER NOT NULL,         -- 镜头序号 (从 1 递增)
  start_time REAL NOT NULL,            -- 镜头起始时间 (秒)
  end_time REAL NOT NULL,              -- 镜头结束时间 (秒)
  duration REAL NOT NULL,              -- 镜头持续时长 (秒)
  shot_type TEXT,                      -- 景别: 大远景/远景/中景/特写/大特写
  camera_movement TEXT,                -- 运镜: 推/拉/摇/移/跟/航拍俯瞰推镜头/升降/固定
  subject TEXT,                        -- 核心主体人物或运动
  visual_description TEXT,             -- 详细视觉描述与情节
  composition TEXT,                    -- 光影构图色彩分析
  tags TEXT DEFAULT '[]',              -- 分镜关键词标签 (JSON)
  quality_score REAL DEFAULT 3,        -- 剪辑可用度评分 (1.0 - 5.0)
  keyframe_path TEXT,                  -- 分镜代表性关键帧图片物理路径
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE
);
```

#### 4. 音频与提示表 (`video_audio`)
记录语音字幕时间轴、音乐情绪与 BPM、停顿区间：
```sql
CREATE TABLE IF NOT EXISTS video_audio (
  video_id TEXT PRIMARY KEY,           -- 视频 ID (1:1 关联)
  transcripts TEXT DEFAULT '[]',       -- ASR 语音字幕 JSON: [{ start, end, text, speaker }]
  bgm_type TEXT,                       -- 配乐类型 (纯人声/背景音乐/环境音)
  bgm_mood TEXT,                       -- 音乐情绪氛围 (震撼抒情/欢快/紧张/平静等)
  bpm REAL DEFAULT 0,                  -- 音乐节拍速度 BPM
  beats TEXT DEFAULT '[]',             -- 重音节奏点时间戳数组 [0.5, 1.0, 1.5...]
  silence_intervals TEXT DEFAULT '[]', -- 气口停顿区间 JSON: [{ start, end, duration }]
  sfx_cues TEXT DEFAULT '[]',          -- 音效打点标记 JSON: [{ time, description }]
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE
);
```

#### 5. 本地音乐资产与分析档案 (`local_music_catalog`, `music_analysis_profiles`)

音乐目录只引用用户本地音频；分析档案按版本保存并绑定源文件属性指纹。指纹只用于发现常见替换，不是内容哈希。DSP 拍点候选和用户确认点分开保存；模型节奏提示及用户试听后确认的模型点另存于模型解读/编辑字段，不并入DSP确认点。瞬态检测只保留为本地算法内部中间量，旧版原始 onset 列表在迁移时清空且不再输出。

```sql
local_music_catalog(
  id, file_path UNIQUE, file_size, title, artist, duration, codec, sample_rate, channels,
  source_identity_json, license_status, license_note, license_identity_json
)
music_analysis_profiles(
  analysis_id, music_id, source_identity_json, analysis_version, method,
  window_start_seconds, window_duration_seconds, status, bpm, confidence,
  tempo_candidates_json, transient_onsets_json, beat_candidates_json,
  user_confirmed_beats_json, feature_summary_json,
  style_suggestions_json, style_rationale, style_provenance, style_confirmed_at,
  model_interpretation_json, model_provider, model_name, model_reasoning_effort, model_interpreted_at,
  model_interpretation_edits_json, model_interpretation_edited_at, created_at
)
```

`beat_candidates` 只来自本地 DSP 瞬态分析，不能保证是真正拍点；`user_confirmed_beats` 仅在用户试听后逐项确认时写入。可选的 `model_interpretation_json` 保存模型对对数频率频谱图的速度假设、按相对横轴位置映射的近似节奏提示、主观情绪/场景建议、风格标签与不确定性，并记录 provider/model。模型提示不是精确 BPM/拍点或DSP证据。`model_interpretation_edits_json` 单独保存用户编辑的解读/标签及用户试听确认的模型提示；`user_confirmed_model_beats` 与 `user_confirmed_beats` 保持不同来源。

#### 6. 全文与语义检索虚表 (`video_shots_fts`)
使用 SQLite FTS5 引擎维护分镜文本的全文倒排索引：
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS video_shots_fts USING fts5(
  shot_id UNINDEXED,
  video_id UNINDEXED,
  subject,
  visual_description,
  shot_type,
  camera_movement,
  tags
);
```

---

## 5. 关键业务流水线设计

### 5.1 素材导入与多级目录树镜像流水线

```
[用户在图形化浏览器中操作]
   │
   ├─► 场景 A: 选中具体视频文件 (单选/多选/全选)
   │     └─► 触发 POST /api/media-center/videos/import-files
   │
   └─► 场景 B: 点击 "扫描导入当前文件夹" 或多选子文件夹
         └─► 触发 POST /api/media-center/folders/scan 或 /folders/scan-selected
               │
               ▼
   [POST 立即创建导入任务并返回 job，不等待扫描/入库/故事板]
   └─► 客户端关闭导入弹窗，显示悬浮进度并轮询 GET /import-jobs/:id
         │
         ▼
   [后台 VideoImportJobManager]
   1. 流式递归枚举目录，让出事件循环；路径规范化、realpath 与请求内去重
   2. 扫描完成后固定 total 与 importable，避免把进行中的数量当成最终值
   3. 逐视频确认源文件未变化 → ffprobe → 立即写入 videos 表（列表可见）
      已存在记录跳过并计数 duplicates，不重复探测或覆盖已有元数据
   4. 独立故事板队列以有限并发生成；只更新仍存在且 file_path 匹配的行
      storyboard_status 为 pending/generating/ready/failed/not_started
   5. 任务进入 completed / completed_with_errors / failed，前端刷新列表
```

- **重复不是失败**：同一请求内重复路径、不同路径指向同一文件和库内已有记录都会跳过；`inserted` 只统计本次新增行，`duplicates` 与 `failed` 分开。POST 旧入口兼容返回 `imported_count:0`，调用方应以 `job`/`job_id` 跟踪结果。Agent 的旧导入工具仍同步等待任务与故事板完成并返回旧汇总结构。
- **中断与继续**：`POST /import-jobs/:id` 请求中断，后台在扫描、入库和故事板队列间检查取消标记并转为 `cancelled`。客户端保留原始导入请求，可在悬浮进度中一键重发；去重使已入库项跳过，因此继续是安全的。任务过期或服务重启后也可从本地保留的请求重新开始。
- **兼容预览**：浏览器通过完整 HEVC codec 串探测硬解能力；Main10 / 4:2:0 等硬件支持的档次直接播放原视频（不转码、不缓存），Rext / 4:2:2 / 4:4:4 等不支持档次显示“生成兼容预览”按钮，用户点击后才通过 FFmpeg 转码为 540p H.264/AAC 缓存（`cache/previews/`）。Host 首次检查时用 ffprobe 惰性补齐 `video_profile`、`pix_fmt` 并写入数据库。源文件只读；界面显示生成状态并在完成后自动切换播放地址。也可通过 `POST /videos/:id/open` 调用操作系统默认播放器打开原始文件，不转码、不复制。
- **缓存管理**：`GET /cache` 统计故事板、兼容预览、关键帧和音乐频谱图占用；`POST /cache/clear` 支持只清理预览或一键清理全部衍生缓存。清理故事板目录时同步清空数据库中的故事板路径并重置状态，源视频不受影响。
- **故事板超时与重试**：生成超时随视频时长放宽（最多 15 分钟），超时与 FFmpeg 失败分开记录；视频卡片菜单可强制重新生成。
- **导入中断恢复**：服务重启后重试 `pending/generating` 故事板；`not_started` 表示迁移前的旧记录，不会全库重算。`ready` 但缓存文件已丢失的记录会重新生成。
- **前端防止重复提交**：导入期间全局锁阻止再次发起；进度面板支持从会话内恢复未完成任务，任务过期或服务重启后会清除恢复令牌。
- **自底向上目录计数累加 (Rollup Counts)**：
  父目录的视频数量和已分析数量不再局限于直属视频，而是通过 `getAllDescendantFolderIds` 自底向上递归累加整个子树的统计（如父目录正确呈现 `1/9`）。

### 5.2 底层视听特征提取与故事板合成流水线

为了大幅压缩 AI 分析的传输与计算开销，系统在底层做了深度的媒体特征预处理：

```
                    ┌────────────────────────────┐
                    │ 原始物理视频 (RAW/4K/Log)  │
                    └─────────────┬──────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  FFprobe 参数探测 │    │ 4x4 故事板大图拼合 │    │ 音频特征检测分析  │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         │ 分辨率/帧率/码率      │ 16 帧时序雪碧图       │ 气口停顿与 BPM
         ▼                       ▼                       ▼
    videos 规格字段        storyboard.jpg           silence / bpm
```

- **4x4 故事板合成算法**：
  通过 FFmpeg 滤镜链 `fps=16/${duration},scale=320:180,tile=4x4`，自适应全视频时长，均匀抓取 16 个代表性关键画面，拼成一张 1280x720 分辨率、大小仅约 150KB 的紧凑 JPEG 雪碧图。
- **气口静音停顿检测**：
  执行 `silencedetect=noise=-30dB:d=0.5`，解析 stderr 输出中的 `silence_start` 与 `silence_end`，输出停顿区间数组，为解说类视频自动气口切除提供毫秒级坐标。
- **历史全片音轨节奏状态**：旧版 `detectBpmAndBeats` 不执行真实节奏估计，其历史 `120 BPM` 和规则化节拍网格不能视为测量结果。当前该入口明确返回 unavailable/null，并在检测失败时保留已有人工数据。
- **本地音乐工作台节奏估计**：独立模块将最多 600 秒音频解码为有界 PCM，做能量瞬态候选与自相关 BPM 估计；不生成假拍点。瞬态不一定是节拍/强拍，结果需试听校正。Jamendo 目前仅搜曲目元数据，不下载、不授予使用权。

### 5.3 工作台直驱 AI 多模态深度分析与审计闭环

与传统的纯对话式 Agent 相比，工作台直驱流水线专为批量生产力打造：

```
[创作者在工作台点击 "AI 深度分析" 或 "批量 AI 分析"]
                     │
                     ▼
  POST /api/media-center/videos/:id/ai-analyze
  或 POST /api/media-center/videos/batch-ai-analyze
                     │
                     ▼
      [Host 端 VideoAiAnalyzer 引擎]
   0. 批量任务按设置中的 1–8 并发数启动 worker；单条任务不受该并发限制。
   1. 解析模型配置 (resolveAiConfig):
      ├─ 自动读取 DSH Profile 中激活的多模态视觉大模型 (默认 zero-plus)
      ├─ 从 ~/.dsh/.credentials.yaml 自动解析 API Key
      └─ 允许在【设置】中自定义覆盖 BaseURL、APIKey、模型名称与 Prompt 模板
   2. 准备视觉素材:
      ├─ 读取该视频预生成的 4x4 故事板大图
      └─ 编码为 data:image/jpeg;base64 字符串
   3. 动态渲染 Prompt:
      ├─ 注入 {{video_name}}, {{duration}}, {{resolution}}, {{fps}}, {{folder_name}}
      └─ 施加严格的影视剪辑 JSON 输出约束
   4. 发起多模态推理请求:
      ├─ 记录请求开始时间戳 startTime
      ├─ 调用 /v1/chat/completions (temperature: 0.3)
      ├─ 记录完成时间并计算耗时 latencyMs = Date.now() - startTime
      └─ 提取 Token 消耗指标: prompt_tokens, completion_tokens, total_tokens
   5. 结构化解析与原子入库:
      ├─ 正则/严格解析大模型输出的标准 JSON
      ├─ db.upsertShots 批量写入镜头分镜
      ├─ db.upsertVideoAudio 写入 BGM 情绪与静音点
      └─ db.upsertVideo 写入全片摘要、业务标签并持久化审计指标
                     │
                     ▼
          [Web 前端即刻响应刷新]
   • 卡片展示审计胶囊: ⚡ 20.8s · 3369 tokens · zero-plus
   • 分镜解析卡片优雅列出各镜头景别、运镜、画面详述与评分
```

## 5.4 单片段按需精读工作流

1. 用户在已保存分镜卡片上主动发起精读；系统依据片段时长抽取 4/9/16 帧并展示各帧真实源 PTS，全部取自半开片段范围。
2. 复用工作台当前服务商/模型/推理档位，对图片和时间戳执行单次分析。模型未看过完整视频；低帧率重复帧被明确提示，候选不自动覆盖原标注。
3. 每次分析与原分镜快照、源区间、故事板、分析提示词及用量一并保存。用户逐字段勾选应用；后端对边界及所选字段做原子冲突检查。失败保留已获得的审计数据和候选/故事板（如已生成），不覆盖已有描述。
4. 支持 Agent 的分析候选、读取历史、以及必须有明确用户授权才应用字段的工具。

### 5.5 DSH 会话 Agent 剪辑项目流程

创意讨论、选曲、叙事结构和反复编排均发生在 DSH 会话中。Agent 可按需调用素材检索、已有分镜详情、本地音乐目录、BPM 估算与瞬态候选等工具；可先展示计划、接受反馈、再提交新版结构化候选。

1. `media_center_edit_preview_project` 接收 Agent 生成的 EditProject v1。插件不调用模型，只核验项目结构、素材库 ID、音乐库成员、范围/时长、剪辑轨、源文件可读性和授权状态；客户端路径不被接受或写入项目。
2. 音乐通过本地引用目录试听和有界 PCM 测量；Jamendo 仅搜索元数据，不下载或核发许可。瞬态不等于节拍/强拍，插件会将节奏关系标注为未核验；自由文本也不能当作证据。
3. 项目预览仅保存在服务器内存 30 分钟，不写入数据库；源文件以 realpath、dev/ino、size、mtime_ns 弱指纹及分镜字段快照检查（不是密码学内容哈希）。保存前会复核源及分镜是否变化。
4. 用户在 DSH 会话明确确认后，Agent 调用保存工具；插件只接受服务端预览 ID 并将结构化项目写入 SQLite。之后用 `media_center_edit_projects` 在会话中查询项目。
5. 保存后的项目出现在“项目库”页签，可查看时间线、编辑标题/片段顺序/入出点并导出 FCPXML 或 Premiere XML；剪辑软件兼容性仍需实际导入验证。

---

## 5.6 DSH Agent 自动化素材管理与项目保存

---

## 5.6 DSH 会话 Agent：资产发现到项目保存

1. Agent 在 DSH 对话中理解需求，调用 `media_center_search_videos` / `media_center_search_shots` 找素材，用 `media_center_get_video` 查看现有分镜与范围；必要时触发故事板或精读。
2. Agent 调用音乐库 list/analyze/detail 工具读取完整音轨（最多600秒）的BPM估计与DSP拍点候选；原始 onset 列表不保存、不返回。用户可在音乐库 UI 主动请求当前配置的图像模型解读派生频谱图；`media_center_edit_music_analysis_detail` 返回近似速度/相对节奏提示、场景与风格标签、模型来源及用户编辑/确认。模型时间提示是粗略视觉估计，不能冒充DSP测量或精确节拍；用户确认模型点会与DSP `user_confirmed_beats` 分开。选曲和最终剪辑编排仍由 DSH 会话 Agent 负责。
3. Agent 在会话中提出并迭代 EditProject v1；调用 `media_center_edit_preview_project` 后向用户展示规范化项目及警告。插件只校验素材 ID、分镜边界、时长、轨道、文件属性和权利声明。
4. 用户明确要求保存后，Agent 调用 `media_center_edit_save_project`；保存项目会出现在项目库，可通过 `media_center_edit_projects` 查询、`media_center_edit_update_project` 修订，或 `media_center_export_project` 按项目 ID 导出工程。

### 5.7 项目库与工程导出流水线

项目库以 `editing_projects` 为唯一数据源，项目只保存素材库 ID 和帧时间线；导出时由 Host 重新解析视频/音乐路径并检查文件存在性。

| 格式 | 适用软件 | 说明 |
|---|---|---|
| **FCPXML 1.9（.fcpxml）** | Final Cut Pro、剪映（需实测） | `<resources>` 资源、`<spine>` 视频/音频轨、有理数帧时间、`media-rep` 文件引用；保留视频原声和音乐轨 |
| **Premiere Pro XML（.xml）** | Premiere Pro、DaVinci Resolve | xmeml version 4；视频轨 + 音频轨；`file://localhost/` 路径；剪映兼容性未验证 |

旧版剪映 Draft JSON 与 EDL 导出入口已移除；视频库右上角的一次性“导出剪辑工程”按钮也已移除。导出只写 `cache/exports/`，不修改或复制源媒体。

---

## 6. Web 工作台 (Client UI) 架构与响应式设计

### 6.1 桌面端三栏布局与 Resizable Splitter
- **左栏（目录树导航）**：
  - 树状展示一级项目与二级子场景；
  - 节点包含折叠/展开三角、文件夹图标、名称、统计徽标与 `···` 操作菜单；
  - 增加 `flexShrink: 0` 保护机制，防止长目录文本将图标压缩消失；
  - **无偏移拖拽调宽**：通过 `e.clientX - workbenchRect.left` 消除宿主全局侧边栏占位产生的 280px 偏移，实现鼠标与分割线 1:1 绝对重合平滑拖拽。
- **中栏（素材卡片流）**：
  - 顶部 Filter Bar 提供**多维排序选择器**（支持拍摄时间、导入时间、文件名、视频时长双向排序）；以 `localStorage` 保存当前浏览器的上次选择，并在首次请求列表前恢复，存储不可用或值非法时安全回退；
  - 拍摄时间仅采信媒体录制标签，保留时区语义，未知值升降序均排末尾。旧版把导入时间写为拍摄时间的记录，在增加 `captured_at_source` 时清空伪值，首次请求列表/详情时以最多 2 路只读 FFprobe（每文件 15 秒超时）补齐；只更新拍摄时间及来源，不改导入时间、修改时间或 AI 标注。源文件不可访问时标记 `unavailable`，下次重载可重试；
  - 支持多选 Checkbox、全选快捷框、批量操作滑出工具栏；
  - 卡片集成缩略图、时长徽标、拍摄时间标签、高反差状态标签（深灰底色 + 纯白文字，浅色模式下杜绝白底白字）；
  - 卡片底部常驻微型 AI 审计胶囊（`⚡ 耗时 · Token · 模型`）。
- **右栏（视听详情深度工作台）**：
  - 顶部集成 HTML5 视频播放器，支持点击任意分镜“▶ 播放该段”实现毫秒级精准跳播与循环播放；
  - 三大 Tab：`分镜解析`、`音频与提示`、`基础信息`；
  - 践行“**阅读模式优先**”原则，默认展现优雅排版与评分星星，点击【✏️ 编辑】无缝切换至输入表单；
  - 基础信息 Tab 配备专门的 **【AI 深度分析审计报告】** 专区。

### 6.2 移动端与小屏幕自适应 (Responsive `< 840px`)
针对手机竖屏、分屏窗口等小视口环境，系统动态切换为触摸友好的**三重视图分段切换器**：

```text
┌─────────────────────────────────────────┐
│ [≡ 视频资产管理]   [⚙ 设置]   [+ 导入]  │
├─────────────────────────────────────────┤
│  [ 📁 分类目录 ] [ 🎬 素材列表 ] [ 📋 视频详情 ] │  <-- 顶部三段式切换 Tab
├─────────────────────────────────────────┤
│                                         │
│  当前激活视图:                           │
│  - 视图 1 (分类目录): 全宽目录树操作    │
│  - 视图 2 (素材列表): 单列横向图文卡片  │
│  - 视图 3 (视频详情): 顶栏常驻返回按钮  │
│                       全屏播放器与分镜  │
└─────────────────────────────────────────┘
```
- 弹窗宽度自动自适应为 `95vw`，保证在手机端不溢出并提供舒适的滚动体验。

---

## 7. Host 端服务与接口契约

### 7.1 WebServer REST API 契约一览

Host 端在 `/api/media-center` 前缀下注册以下 HTTP 接口：

| 方法 | 路由路径 | 功能说明 | 核心参数 |
|---|---|---|---|
| `GET` | `/folders` | 获取层级目录树（含汇总统计） | - |
| `POST` | `/folders` | 创建新分类目录 | `{ name, parent_id? }` |
| `PUT` | `/folders/:id` | 重命名分类目录 | `{ name }` |
| `DELETE` | `/folders/:id` | 删除目录（素材自动移入根目录） | - |
| `GET` | `/videos` | 检索素材列表（支持多维排序） | `folder_id`, `status`, `query`, `tag`, `sort_by`, `sort_dir` |
| `GET` | `/videos/:id` | 获取单视频完整详情 | `include_shots`, `include_audio` |
| `PUT` | `/videos/:id` | 更新视频基本信息与备注 | `{ summary, tags, user_notes, folder_id, file_name }` |
| `DELETE` | `/videos/:id` | 移出素材库（绝不删源文件） | - |
| `POST` | `/videos/batch-delete` | 批量移出素材库 | `{ video_ids: string[] }` |
| `POST` | `/videos/batch-move` | 批量移动素材分类 | `{ video_ids: string[], folder_id }` |
| `POST` | `/videos/:id/shots` | 更新或保存分镜列表 | `{ shots: [...] }` |
| `POST` | `/videos/:id/audio` | 更新音频与字幕信息 | `{ transcripts, bgm_mood, bpm }` |
| `POST` | `/videos/:id/ai-analyze` | 直驱触发单片 AI 深度分析 | - |
| `POST` | `/videos/batch-ai-analyze`| 批量排队触发 AI 分析 | `{ video_ids: string[] }` |
| `POST` | `/videos/scan-dir` | 扫描本地物理文件夹镜像导入 | `{ directory_path, parent_id? }` |
| `POST` | `/videos/import-files` | 创建异步导入任务（文件） | `{ file_paths: string[], folder_id? }` → `{ job, job_id }` |
| `GET` | `/import-jobs/:id` | 轮询导入、去重与故事板进度 | - |
| `POST` | `/import-jobs/:id` | 中断正在运行的导入任务 | - |
| `POST` | `/videos/:id/open` | 用操作系统默认播放器打开原视频（不转码） | - |
| `GET/POST` | `/videos/:id/preview` | 查询或启动 HEVC 等编码的 H.264 兼容预览转码 | - |
| `DELETE` | `/videos/:id/preview` | 删除该视频的兼容预览缓存 | - |
| `GET` | `/cache` | 统计故事板、预览、关键帧、音乐频谱缓存占用 | - |
| `POST` | `/cache/clear` | 清理衍生缓存（`scope: previews|all`） | `{ scope? }` |
| `GET` | `/fs/browse` | 跨磁盘驱动器浏览本地目录/文件 | `dir_path` |
| `GET` | `/stream/:id` | HTTP 206 视频分片流式播放；`?preview=1` 使用兼容转码缓存 | 支持 `Range: bytes=start-end` |
| `POST` | `/storyboard/:id` | 强制重新生成当前视频故事板 | - |
| `GET` | `/storyboard/:id` | 获取 4x4 故事板大图 JPEG | - |
| `GET` | `/keyframe/:id/:idx` | 获取分镜关键帧 JPEG | - |
| `GET` | `/editing/projects` | 项目库摘要列表 | `limit`, `offset` |
| `GET/PUT/DELETE` | `/editing/projects/:id` | 读取、按 revision 更新或删除项目 | `{ project, expected_revision }` |
| `POST` | `/editing/projects/:id/export` | 按项目 ID 导出 FCPXML / Premiere XML | `{ format, include_source_audio? }` |
| `GET/POST`| `/settings` | 读取或更新全局配置 (FFmpeg等) | `{ ffmpeg_path, ffprobe_path }` |
| `GET/POST`| `/ai-settings` | 读取或更新 AI 模型与提示词模板 | `{ ai_model, ai_prompt_template, ... }` |

### 7.2 Model-Facing Agent Tools 契约一览

向 DSH 运行时注册的 31 个工具，均遵循输入参数严谨、输出紧凑原则。核心工程工具包括：

1. `media_center_list_folders`：列出资产库多级目录树与统计。
2. `media_center_scan_directory`：扫描本地物理文件夹镜像导入。
3. `media_center_import_files`：导入指定的单个或多个视频文件路径。
4. `media_center_search_videos`：多维度检索素材库。
5. `media_center_get_video`：读取单视频绝对物理路径、分镜与音频。
6. `media_center_trigger_analysis`：触发底层故事板大图与静音/BPM 提取。
7. `media_center_upsert_shots`：回写分镜结构化解析。
8. `media_center_update_audio_info`：回写音频、字幕与情绪打点。
9. `media_center_update_video`：更新视频全局摘要、标签与状态。
10. `media_center_search_shots`：跨素材分镜自然语言语义检索。
11. `media_center_export_project`：按项目 ID 导出 FCPXML / Premiere XML 工程。
12. `media_center_configure_ffmpeg`：查看或动态配置 FFmpeg 路径。
13. `media_center_edit_preview_project`：校验并预览 Agent 编排的 EditProject。
14. `media_center_edit_compose_project`：按有序分镜自动组装时间线并返回预览。
15. `media_center_edit_save_project`：用户确认后保存服务端预览。
16. `media_center_edit_update_project`：按 revision 修订已保存项目。

---

## 8. 环境适配、依赖治理与安全架构

### 8.1 FFmpeg / FFprobe 四级适配机制
为保证系统在不同的 Windows、macOS 或 Linux 环境下零配置启动，MediaEngine 采用分层探测策略：
1. **第一优先级**：数据库中存储的用户自定义路径（在【设置】面板或通过配置工具指定）；
2. **第二优先级**：系统 PATH 环境变量检测（自动执行 `where.exe` 或 `which`）；
3. **第三优先级**：Windows 常见安装目录盲测（如 `~/.local/bin/ffmpeg.exe`、`C:\ffmpeg\bin\ffmpeg.exe`、`D:\ffmpeg\bin\ffmpeg.exe` 等）；
4. **第四优先级**：降级与优雅提示。若均未找到，工作台常驻黄色提示条引导配置，不阻断常规浏览功能。

### 8.2 研发协同与版本发布纪律
本工程在 [AGENTS.md](../AGENTS.md) 中严格约定了团队开发纪律：
- **禁止私自 commit**：所有代码改动完成后必须保持工作区待审阅状态，由用户亲自验证无误并明确下达提交指令后方可提交。
- **禁止私自打 Tag 或升版本**：常规“提交”指令只执行普通的 `git add` 与 `git commit`，严禁擅自修改 `package.json` 版本号，严禁擅自执行 `git tag`。

---

## 9. 未来演进路线 (Roadmap)

1. **多模态长视频原生时序大模型接入**：
   在现有 4x4 故事板单图方案的基础上，探索支持原生 Video Token 输入的大模型通道（如 Google Gemini 1.5 Pro / Flash、Qwen-VL-Max），支持可变时序抽帧与多粒度特征融合。
2. **AI 智能粗剪剧本生成器 (Script-to-Timeline)**：
   在工作台右栏引入“AI 剧本生成”交互面板。用户输入一篇旅行日记或解说文案，Agent 自动根据分镜语义检索匹配镜头、按照 BPM 鼓点排布时间线，并一键直出剪映粗剪草稿。
3. **达芬奇 (DaVinci Resolve) 工程深度对接**：
   除 FCPXML 外，支持直接生成达芬奇 `.drp` 脚本或基于 Python Scripting API 的直接时间线注入。
4. **素材人脸与语音说话人聚类 (Face & Speaker Clustering)**：
   利用轻量离线模型对视频中的人物面孔和说话人声音进行无监督聚类，实现按人物角色过滤镜头素材。
