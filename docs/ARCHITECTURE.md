# DSH 视频素材与分镜资产管理器 (dsh-video-manager)
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
`dsh-video-manager` 插件定位为 **AI 视频剪辑工作流的核心中枢与基础设施**：
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
│  ├─ 数据库：<Workspace>/.dsh-video-manager/video_manager.db                             │
│  ├─ 缓存池：<Workspace>/.dsh-video-manager/cache/ (storyboards/, keyframes/, exports/)   │
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
├── .dsh-video-manager/            # 插件私有持久化目录 (已自动加入 .gitignore)
│   ├── video_manager.db           # SQLite 核心数据库文件 (node:sqlite)
│   └── cache/                     # 二进制衍生文件缓存池
│       ├── storyboards/           # 4x4 故事板雪碧图 ({video_id}_storyboard.jpg)
│       ├── keyframes/             # 分镜代表性关键帧图片 ({video_id}_shot_{idx}.jpg)
│       └── exports/               # 导出的剪辑工程目录及文件
│           ├── jianying_草稿名_时间戳/
│           │   ├── draft_content.json
│           │   └── draft_meta_info.json
│           ├── 序列名_时间戳.fcpxml
│           └── 序列名_时间戳.edl
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

#### 5. 全文与语义检索虚表 (`video_shots_fts`)
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
   │     └─► 触发 /api/video-manager/videos/import-files
   │
   └─► 场景 B: 点击 "扫描导入当前文件夹"
         └─► 触发 /api/video-manager/videos/scan-dir
               │
               ▼
   [Host 端 MediaEngine 递归处理]
   1. 获取当前目标挂载 parent_id（若选中了目录则以此为父节点，否则为根）
   2. 递归遍历磁盘物理子目录结构：
      保持 "甘南环线旅游 ➔ 扎尕那" 层级，调用 ensureFolder 逐级落库
   3. 对遍历到的每个视频文件执行并发扫描：
      ├─ 检查视频是否已在库中 (基于 file_path 幂等防重)
      ├─ 调用 ffprobe 提取精准宽高、帧率、编码、码率与时长
      ├─ 调用 ffmpeg 自动抽取合成 4x4 故事板雪碧图
      └─ 写入 videos 表，状态设为 'imported'
   4. 前端收到成功响应，自动关闭弹窗并刷新左侧目录树与中栏视频流
```

- **防重复并发锁 (`isImporting`)**：
  点击导入按钮瞬间激活前端全局锁，按钮变为 `disabled` 并展示转圈动画与友好黄色通知条，彻底杜绝多次狂点引发的重复探测与并发请求。
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
- **音乐节奏与 BPM 节拍计算**：
  提取音轨特征流，探测能量突变峰值，估算音频主节奏 BPM（如 120 BPM）及重音时间戳序列。

### 5.3 工作台直驱 AI 多模态深度分析与审计闭环

与传统的纯对话式 Agent 相比，工作台直驱流水线专为批量生产力打造：

```
[创作者在工作台点击 "AI 深度分析" 或 "批量 AI 分析"]
                     │
                     ▼
  POST /api/video-manager/videos/:id/ai-analyze
                     │
                     ▼
      [Host 端 VideoAiAnalyzer 引擎]
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

### 5.4 AI Agent 自动化剪辑与分镜召回流水线

在复杂的对话式交互场景中，AI Agent 可通过 11 个专用工具执行高阶编排：

```
1. 需求理解与跨视频分镜语义召回:
   用户: "帮我找一段草原日落航拍大远景，接着接一段红裙旋转的特写镜头"
   Agent ➔ video_manager_search_shots({
     query: "草原日落 航拍大远景",
     shot_type: "大远景",
     limit: 3
   })
   系统 ➔ 基于 FTS5 倒排索引与加权算法，10ms 内返回候选镜头及其精准 start_time, end_time, file_path

2. 素材详情核对与故事板复查:
   Agent ➔ video_manager_get_video({ video_id: "vid_c0398", include_shots: true })
   系统 ➔ 返回视频完整参数、各镜头详细构图与音频节拍

3. 剧本时间线编排与剪辑工程交付:
   Agent 规划好时间线入出点，调用工程导出工具:
   Agent ➔ video_manager_export_project({
     format: "jianying",
     sequence_name: "甘南草原日落短片",
     clips: [
       { video_id: "vid_01", in_point: 0.0, out_point: 4.5, description: "日落金山大远景" },
       { video_id: "vid_02", in_point: 9.2, out_point: 14.5, description: "红裙女子草原旋转" }
     ]
   })
   系统 ➔ 生成合规剪映草稿目录，用户打开电脑剪映即可看到完整粗剪时间线！
```

### 5.5 主流剪辑软件工程导出流水线

导出引擎 `ProjectExporter` 实现了三种工业级工程格式的精密构建：

| 格式名称 | 适用软件 | 核心技术要点 |
|---|---|---|
| **剪映本地草稿 (JianYing / CapCut)** | 剪映电脑版 (Mac / Windows) | • 建立 `draft_content.json` 与 `draft_meta_info.json`\u003cbr>• **微秒（Microseconds, us）时钟对齐**：$1\text{s} = 1,000,000\mu\text{s}$\u003cbr>• 绑定源素材绝对路径与多轨道片段 UUID 映射 |
| **Final Cut Pro XML (FCPXML v1.9)** | Final Cut Pro X, Premiere Pro, 达芬奇 | • 标准 XML 骨架，输出 `<spine>` 视音频脊线\u003cbr>• 换算为标准有理数时间单位 `${frames}/${fps}\text{s}`\u003cbr>• 挂载 `<format>` 规格与素材资源库 `<resources>` |
| **CMX 3600 EDL** | 通用全平台非编剪辑软件 | • 生成标准 8 栏 EDL 文本时间线\u003cbr>• 计算精准时间码格式 `HH:MM:SS:FF` (帧数基于帧率取整对齐) |

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

Host 端在 `/api/video-manager` 前缀下注册以下 HTTP 接口：

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
| `POST` | `/videos/import-files` | 导入指定单个/多个视频文件 | `{ file_paths: string[], folder_id? }` |
| `GET` | `/fs/browse` | 跨磁盘驱动器浏览本地目录/文件 | `dir_path` |
| `GET` | `/stream/:id` | HTTP 206 视频分片流式播放 | 支持 `Range: bytes=start-end` |
| `GET` | `/storyboard/:id` | 获取 4x4 故事板大图 JPEG | - |
| `GET` | `/keyframe/:id/:idx` | 获取分镜关键帧 JPEG | - |
| `POST` | `/export` | 导出剪辑工程 (剪映/FCPXML/EDL) | `{ format, sequence_name, clips }` |
| `GET/POST`| `/settings` | 读取或更新全局配置 (FFmpeg等) | `{ ffmpeg_path, ffprobe_path }` |
| `GET/POST`| `/ai-settings` | 读取或更新 AI 模型与提示词模板 | `{ ai_model, ai_prompt_template, ... }` |

### 7.2 Model-Facing Agent Tools 契约一览

向 DSH 运行时注册的 11 个工具，均遵循输入参数严谨、输出紧凑原则：

1. `video_manager_list_folders`：列出资产库多级目录树与统计。
2. `video_manager_scan_directory`：扫描本地物理文件夹镜像导入。
3. `video_manager_import_files`：导入指定的单个或多个视频文件路径。
4. `video_manager_search_videos`：多维度检索素材库。
5. `video_manager_get_video`：读取单视频绝对物理路径、分镜与音频。
6. `video_manager_trigger_analysis`：触发底层故事板大图与静音/BPM 提取。
7. `video_manager_upsert_shots`：回写分镜结构化解析。
8. `video_manager_update_audio_info`：回写音频、字幕与情绪打点。
9. `video_manager_update_video`：更新视频全局摘要、标签与状态。
10. `video_manager_search_shots`：跨素材分镜自然语言语义检索。
11. `video_manager_export_project`：一键导出剪映草稿/FCPXML/EDL 工程。
12. `video_manager_configure_ffmpeg`：查看或动态配置 FFmpeg 路径。

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
