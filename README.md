# DSH 视频素材与分镜资产管理器 (dsh-video-manager)

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-0066FF.svg)](https://github.com/deepseek-ai)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D24.0.0-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/database-node%3Asqlite-orange.svg)](https://nodejs.org/api/sqlite.html)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

专为 **AI 视频剪辑、自动化卡点混剪、影视解说创作** 工作流打造的 DeepSeek Harness 官方风格插件。

建立 **“物理视频资产 ➔ 结构化特征库 ➔ 人机协同标注 ➔ AI 自动化剪辑决策”** 的核心枢纽，解决大模型在视频剪辑场景中“吞不下大体积长视频、缺乏时间轴元数据、难以直接输出可剪辑工程”的痛点。

---

## 架构与深度设计文档

本项目具备完整的系统架构体系与设计规范，详细的技术剖析与接口契约请参阅：
👉 [**系统架构与深度设计规范文档 (docs/ARCHITECTURE.md)**](docs/ARCHITECTURE.md)

- **[核心架构设计原则与红线](docs/ARCHITECTURE.md#2-核心架构设计原则与红线)**：物理源文件绝对只读 (Zero-Data-Loss)、Node 24 原生 ESM + 内置 node:sqlite 零编译依赖、4x4 故事板雪碧图节约 90%+ 视觉 Token、双轨驱动架构。
- **[分层系统架构](docs/ARCHITECTURE.md#3-分层系统架构)**：Host 端（API/MediaEngine/AI/DB/Exporter）与 Client 端（React 响应式三栏工作台）深度协同。
- **[核心数据模型与存储规范](docs/ARCHITECTURE.md#4-核心数据模型与存储规范)**：SQLite Schema、多级目录树、AI 分析耗时/Token 审计字段。
- **[关键业务流水线设计](docs/ARCHITECTURE.md#5-关键业务流水线设计)**：素材镜像导入、视听特征提取、直驱多模态分析、Agent 剪辑召回、剪映/FCPXML/EDL 工程导出。
- **[Web 工作台与响应式设计](docs/ARCHITECTURE.md#6-web-工作台-client-ui-架构与响应式设计)**：桌面端 Resizable Splitter 调宽算法、移动端小屏断点（`< 840px`）单栏流式分段。

---

## 核心特性

- 📁 **多级目录树资产组织**：
  支持至少两级（乃至任意多级）树状分类结构（例如：`甘南环线旅游 ➔ 扎尕那 / 甘加秘境`）。选择父目录时**自动递归聚合显示其所有子目录**中的视频素材。
- 🧭 **可视化目录与视频文件浏览器**：
  不再需要手动打字输入路径！内置磁盘盘符（`C:\`, `D:\`）、项目工作区、常用目录快捷直达；支持可视化展开目录层级，支持单选/多选视频文件直接导入。
- 🖼️ **4x4 故事板大图 (Contact Sheet) 自动生成**：
  视频导入或分析时自动通过 FFmpeg 抽取 16 个代表性关键画面拼合成单张轻量雪碧图。AI Agent **仅需“看”一张图片** 即可纵览全片镜头节奏与视觉走向，**节约 90% 以上视觉 Token 开销**。
- 🔇 **音频静音停顿检测与音乐 BPM 卡点**：
  自动通过 `silencedetect` 滤镜标出所有气口停顿区间 `[start, end, duration]`，便于解说口播快速切除空白；自动计算音乐节奏 `BPM` 与节拍时间戳，为卡点混剪提供精准依据。
- 📝 **全流程结构化人机协同编辑**：
  保持专业生产力软件克制美感，**默认呈现舒适的正常阅读浏览模式**。点击【✏️ 编辑】即可就地调整分镜秒数、景别（大远景至大特写）、运镜（推拉摇移跟俯冲）、画面描述、语音字幕与标签，并支持一键保存。
- **单片段 AI 精读**：
  在【分镜解析】中按需对已有片段生成带源视频时间戳的自适应故事板；使用工作台配置的模型与推理档位生成候选描述，查看对比后手动勾选字段应用。结果记录模型、耗时、Token 和采样时间，无法获取的 Token 显示为“未提供”。精读只基于稀疏采样帧，不能保证精确动作时间或连续运镜；片段范围或待应用字段发生变化时需重新分析。该阶段只支持单片段，不支持批量精读。
- 📦 **素材整理与批量管理**：
  支持多选勾选素材，一键【批量移动到分类】、【批量移出素材库】。
- ↕️ **多维双向排序体系**：
  中栏支持按 **拍摄时间**（最新/最早）、**导入时间**（最新/最早）、**文件名**（A ➔ Z / Z ➔ A）、**视频时长**（长到短/短到长）进行实时动态排序。上次选择保存在当前浏览器，下次打开自动恢复。拍摄时间只读取媒体容器/视频流的录制时间标签（如 `creation_time`、QuickTime 创建日期），带时区的时间按浏览器本地时区显示；没有时区的标签保留相机墙上时间。没有有效标签时显示“拍摄时间未知”，不使用文件创建时间、修改时间或导入时间冒充。旧素材会在首次加载列表时只读重探测，保留导入时间、分镜和 AI 标注；未知拍摄时间在升降序中均排在末尾。
- ✂️ **主流剪辑软件工程一键导出**：
  AI Agent 排布或人工整理好的镜头片段，可一键直出 **剪映电脑版本地草稿目录（`draft_content.json`）**、**Final Cut Pro / Premiere XML（FCPXML v1.9）** 或 **CMX 3600 EDL**，在剪辑软件中秒开粗剪时间线。
- 🔍 **分镜多维与自然语言语义检索**：
  基于 SQLite FTS5 与多维分词打权算法，输入如 *“晨光照耀雪山日落金山”*，毫秒级跨视频精准召回最匹配的分镜片段与毫秒级入出点。
- 🎨 **DSH 官方主题 100% 自适应**：
  严格遵循 `--dsw-alias-*` 主题变量，深色/浅色模式实时平滑响应，杜绝“白底白字”与浅灰看不清；全套替换为精美矢量 SVG 线性图标，零粗糙 emoji。
- 🔒 **核心安全承诺（Zero-Data-Loss）**：
  素材移出、分类删除与批量移出仅更新数据库记录，不删除磁盘上的源视频或缓存文件。

---

## 面向 AI Agent 的专属工具集（15 个）

插件安装后，系统运行时会自动向 AI Agent 暴露以下标准化工具：

| 工具名称 | 作用说明 | 核心参数 |
|---|---|---|
| `video_manager_list_folders` | 读取多级目录分类树及各节点素材统计（支持递归包含子孙统计） | `{ parent_id? }` |
| `video_manager_scan_directory` | 扫描导入本地物理文件夹，自动镜像多级物理子目录并提取参数 | `{ directory_path }` |
| `video_manager_import_files` | 直接导入一个或多个指定视频文件到指定分类目录中 | `{ file_paths: string[], folder_id? }` |
| `video_manager_search_videos` | 多条件检索素材库（按目录、标签、分析状态、关键词、拍摄时间/时长排序） | `{ folder_id?, status?, query?, tag?, limit?, sort_by?, sort_dir? }` |
| `video_manager_get_video` | 获取单个视频的完整详情（物理绝对路径、基本参数、分镜列表、音频提示） | `{ video_id, include_shots?, include_audio? }` |
| `video_manager_trigger_analysis` | 触发后台抽取故事板大图、音频静音检测、BPM 分析与初始切分点 | `{ video_id }` |
| `video_manager_upsert_shots` | Agent 完成视觉理解后，批量回写分镜（景别、运镜、画面详述、评分） | `{ video_id, shots: [...] }` |
| `video_manager_update_audio_info` | 写入或校正语音转录字幕时间轴、BGM 情绪/BPM、音效（SFX）打点 | `{ video_id, transcripts?, bgm_mood?, bpm?, sfx_cues? }` |
| `video_manager_update_video` | 更新视频全局摘要（summary）、业务标签（tags）与人工备注 | `{ video_id, summary?, tags?, user_notes?, status? }` |
| `video_manager_search_shots` | 跨视频进行分镜语义检索，根据自然语言召回最契合的镜头及其入出点 | `{ query, shot_type?, camera_movement?, min_duration?, limit? }` |
| `video_manager_export_project` | 将选定镜头导出为专业工程文件（`jianying` 剪映草稿、`fcpxml`、`edl`） | `{ sequence_name, format, clips: [{ video_id, in_point, out_point }] }` |
| `video_manager_analyze_shot` | 仅生成单片段精读候选，不覆盖原标注 | `{ video_id, shot_id }` |
| `video_manager_get_shot_analysis` | 查询片段精读记录、候选和用量 | `{ video_id, shot_id, limit? }` |
| `video_manager_apply_shot_analysis` | 经用户明确授权后应用指定候选字段 | `{ run_id, fields, confirmed: true }` |
| `video_manager_configure_ffmpeg` | 查看或手动指定 `ffmpeg.exe` / `ffprobe.exe` 的绝对路径 | `{ ffmpeg_path?, ffprobe_path? }` |

---

## 典型 AI 剪辑自动化闭环工作流

```
1. 发现未分析素材
   Agent ➔ video_manager_search_videos({ status: "imported" })

2. 触发底层音视频特征抽取
   Agent ➔ video_manager_trigger_analysis({ video_id: "vid_xxx" })
   返回: 故事板大图绝对路径 (4x4 拼图) + 初始分镜切分点 + 静音区间 + 估算 BPM

3. 多模态理解与审美分析
   Agent 查看故事板大图与代表性关键帧图片，推理出每个镜头的景别、运镜特征与详细画面描述。

4. 结构化回写
   Agent ➔ video_manager_upsert_shots({ video_id: "vid_xxx", shots: [...] })
   Agent ➔ video_manager_update_audio_info({ video_id: "vid_xxx", transcripts: [...], bpm: 120 })
   Agent ➔ video_manager_update_video({ video_id: "vid_xxx", summary: "...", tags: ["航拍", "日落"], status: "analyzed" })

5. 需求检索与智能剪辑成片
   用户提问: "帮我找一段带有日照金山的开篇大远景，接一段藏寨炊烟中景"
   Agent ➔ video_manager_search_shots({ query: "日照金山 大远景" })
   Agent ➔ video_manager_export_project({
     format: "jianying",
     sequence_name: "扎尕那风光初剪",
     clips: [
       { video_id: "vid_01", in_point: 0, out_point: 4.5 },
       { video_id: "vid_02", in_point: 6.2, out_point: 10.0 }
     ]
   })
   用户打开剪映电脑版，草稿箱中已就绪排好轨道的完整粗剪工程！
```

---

## 数据持久化与存储位置规范

- **默认 SQLite 数据库文件**：`<WorkspaceRoot>/.dsh-video-manager/video_manager.db`
- **缓存与临时工程**：`<WorkspaceRoot>/.dsh-video-manager/cache/`
  - `storyboards/`：故事板雪碧大图
  - `keyframes/`：代表性关键帧图片
  - `exports/`：导出的剪映本地草稿目录、FCPXML 与 EDL 文件
- 插件会自动更新工作区的 `.gitignore`，自动忽略 `.dsh-video-manager/`，避免意外将二进制大缓存提交至 Git。

---

## 工作台 AI 模型与推理档位

在工作台【设置】中选择 DSH 已配置的服务商及支持图片输入的模型。如果该模型声明了可选推理档位，还须明确选择并保存档位；切换服务商或模型后，需要重新选择。请求直接使用已保存的档位，不会因请求失败而自动更换档位重试。已有配置如果尚未设置推理档位，需先打开设置完成选择。未声明推理档位的模型无需选择；无法读取能力时需刷新或检查模型配置。自定义 OpenAI 兼容端点维持原有调用方式，不使用 DSH 档位列表。

---

## 环境要求与依赖说明

- **Node.js**：`>= 24.0.0`（利用 Node 24 原生内置的 `node:sqlite` DatabaseSync，**0 外部 npm 二进制编译依赖**，跨平台稳定可靠）。
- **FFmpeg & FFprobe**：
  - 插件会自动检测系统环境变量 `PATH`。
  - 若未配置全局环境变量，可在面板右上角点击 **【设置】** 手动指定 `ffmpeg.exe` 和 `ffprobe.exe` 的绝对路径，即刻生效。

---

## 插件安装方法

在 DeepSeek Harness 会话中，通过内置工具执行安装：

```javascript
plugin_manager({
  action: "install_bundle",
  target: "D:\\code\\dsh-video-manager" // 项目绝对路径
})
```

安装完成后刷新 Web GUI，在左侧导航栏即可看到全新的 **“视频资产库”** 电影场记板图标！
