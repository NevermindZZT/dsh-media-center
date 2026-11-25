# DSH 媒体中心 (dsh-media-center)

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-0066FF.svg)](https://github.com/deepseek-ai)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D24.0.0-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/database-node%3Asqlite-orange.svg)](https://nodejs.org/api/sqlite.html)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

专为 **DSH 媒体工作流** 打造的本地媒体资源管理插件，覆盖视频、音乐及后续可扩展的其他媒体资产。

建立 **“本地媒体资产 ➔ 结构化特征库 ➔ 人机协同标注 ➔ DSH 会话 Agent 工作流”** 的核心枢纽，当前覆盖视频组织与分镜信息、音乐引用及只读音频测量，并可扩展至其他媒体资产。

---

## 架构与深度设计文档

本项目具备完整的系统架构体系与设计规范，详细的技术剖析与接口契约请参阅：
👉 [**系统架构与深度设计规范文档 (docs/ARCHITECTURE.md)**](docs/ARCHITECTURE.md)

- **[核心架构设计原则与红线](docs/ARCHITECTURE.md#2-核心架构设计原则与红线)**：物理源文件绝对只读 (Zero-Data-Loss)、Node 24 原生 ESM + 内置 node:sqlite 零编译依赖、4x4 故事板雪碧图节约 90%+ 视觉 Token、双轨驱动架构。
- **[分层系统架构](docs/ARCHITECTURE.md#3-分层系统架构)**：Host 端（API/MediaEngine/AI/DB/Exporter）与 Client 端（React 响应式三栏工作台）深度协同。
- **[核心数据模型与存储规范](docs/ARCHITECTURE.md#4-核心数据模型与存储规范)**：SQLite Schema、多级目录树、AI 分析耗时/Token 审计字段。
- **[关键业务流水线设计](docs/ARCHITECTURE.md#5-关键业务流水线设计)**：素材镜像导入、视听特征提取、直驱多模态分析、Agent 剪辑召回、项目库管理与 `.prproj`/FCPXML/Premiere XML 工程导出。
- **[Web 工作台与响应式设计](docs/ARCHITECTURE.md#6-web-工作台-client-ui-架构与响应式设计)**：桌面端 Resizable Splitter 调宽算法、移动端小屏断点（`< 840px`）单栏流式分段。

---

## 核心特性

- 📁 **多级目录树资产组织**：
  支持至少两级（乃至任意多级）树状分类结构（例如：`甘南环线旅游 ➔ 扎尕那 / 甘加秘境`）。选择父目录时**自动递归聚合显示其所有子目录**中的视频素材。
- 🧭 **可视化目录与视频文件浏览器**：
  内置磁盘、工作区与常用目录浏览，支持多选视频或子文件夹。导入在后台统计并跳过已入库文件；视频信息先入库、故事板随后后台生成，悬浮进度显示数量和结果，列表显示故事板状态。导入可中断，刷新或重启后仍可一键继续；重复文件安全跳过。视频列表按 200 条分页加载并显示总数，可继续加载剩余素材。鼠标悬停视频卡片可查看已有摘要；源视频始终只读。浏览器具备 HEVC 硬解能力时直接播放原视频，不转码、不生成缓存；HEVC Rext / 4:2:2 / 4:4:4 等硬件不支持的档次会显示“生成兼容预览”按钮，由用户点击后再生成并缓存 540p H.264 预览，完成后自动播放，源文件不变；也可通过视频菜单“用系统播放器打开原视频”。设置中可查看各类衍生缓存占用，并支持仅清理兼容预览或一键清理全部缓存（清理故事板后需重新生成）。
- 🖼️ **4x4 故事板大图 (Contact Sheet) 自动生成**：
  视频导入或分析时自动通过 FFmpeg 抽取 16 个代表性关键画面拼合成单张轻量雪碧图。长视频按最大 15 分钟的超时生成；失败后可从视频卡片菜单重新生成。AI Agent **仅需“看”一张图片** 即可纵览全片镜头节奏与视觉走向，**节约 90% 以上视觉 Token 开销**。
- **本地音乐库与音乐分析**：
  统一标题栏中央的媒体库页签切换到全屏【音乐库】页面；本地音频通过与视频导入共用弹窗框架的流程加入只读引用目录，图形浏览支持一次最多 50 个文件的多选导入，可试听并登记许可声明。音乐分析完全由本地 DSP 完成（最长 600 秒）：输出 BPM 与半速/倍速候选、1/4 拍网格、4/4 或 3/4 小节强拍、能量分段和可切点候选；前端使用 Canvas 长条时间轴绘制真实波形/频段特征、段落色带、拍线与切点，不使用频谱图图片，也不再调用图像模型分析音乐。
- 📝 **全流程结构化人机协同编辑**：
  保持专业生产力软件克制美感，**默认呈现舒适的正常阅读浏览模式**。点击【✏️ 编辑】即可就地调整分镜秒数、景别（大远景至大特写）、运镜（推拉摇移跟俯冲）、画面描述、语音字幕与标签，并支持一键保存。
- **单片段 AI 精读**：
  在【分镜解析】中按需对已有片段生成带源视频时间戳的自适应故事板；使用工作台配置的模型与推理档位生成候选描述，查看对比后手动勾选字段应用。结果记录模型、耗时、Token 和采样时间，无法获取的 Token 显示为“未提供”。精读只基于稀疏采样帧，不能保证精确动作时间或连续运镜；片段范围或待应用字段发生变化时需重新分析。该阶段只支持单片段，不支持批量精读。
- 📦 **素材整理与批量管理**：
  支持多选勾选素材，一键【批量移动到分类】、【批量移出素材库】；在【导入素材/目录】的图形化浏览器中可多选当前目录下的子文件夹，递归导入其中视频并镜像为当前选中分类的子分类。
- ↕️ **多维双向排序体系**：
  中栏支持按 **拍摄时间**（最新/最早）、**导入时间**（最新/最早）、**文件名**（A ➔ Z / Z ➔ A）、**视频时长**（长到短/短到长）进行实时动态排序。上次选择保存在当前浏览器，下次打开自动恢复。拍摄时间只读取媒体容器/视频流的录制时间标签（如 `creation_time`、QuickTime 创建日期），带时区的时间按浏览器本地时区显示；没有时区的标签保留相机墙上时间。没有有效标签时显示“拍摄时间未知”，不使用文件创建时间、修改时间或导入时间冒充。旧素材会在首次加载列表时只读重探测，保留导入时间、分镜和 AI 标注；未知拍摄时间在升降序中均排在末尾。
- **剪辑项目库**：
  独立“项目库”页签展示 Agent 保存的剪辑项目，包含封面、时长、片段数、画幅、版本号和时间线；支持项目改名、片段排序/删除、视频与音乐入出点微调，并按 revision 乐观锁保存，避免覆盖他人修改。
- **工程导出**：
  项目库中可导出 **原生 Premiere Pro `.prproj`**（Windows 剪映导入所需；通过本机 Python + `py-premiere` 生成）、**FCPXML 1.9** 和 **Premiere Pro XML（xmeml）**。导出时可选择本机绝对导出目录，按素材库 ID 解析真实路径，保留视频原声与音乐轨；网络硬盘素材保留映射盘符（如 `Z:\...`），不会改写成 UNC 路径。只写工程文件，不修改源媒体。`.prproj` 的实际剪映导入兼容性仍建议用目标版本验证。
- 🔍 **分镜多维与自然语言语义检索**：
  基于 SQLite FTS5 与多维分词打权算法，输入如 *“晨光照耀雪山日落金山”*，毫秒级跨视频精准召回最匹配的分镜片段与毫秒级入出点。
- 🎨 **DSH 官方主题 100% 自适应**：
  严格遵循 `--dsw-alias-*` 主题变量，深色/浅色模式实时平滑响应，杜绝“白底白字”与浅灰看不清；全套替换为精美矢量 SVG 线性图标，零粗糙 emoji。
- 🔒 **核心安全承诺（Zero-Data-Loss）**：
  素材移出、分类删除与批量移出仅更新数据库记录，不删除磁盘上的源视频或缓存文件。

---

## 面向 AI Agent 的专属工具集（28 个）

插件安装后，系统运行时会自动向 AI Agent 暴露以下标准化工具：

| 工具名称 | 作用说明 | 核心参数 |
|---|---|---|
| `media_center_list_folders` | 读取多级目录分类树及各节点素材统计（支持递归包含子孙统计） | `{ parent_id? }` |
| `media_center_scan_directory` | 扫描导入一个物理目录，递归镜像子目录；可指定素材父分类 | `{ directory_path, folder_id? }` |
| `media_center_import_subfolders` | 多选同一父目录下的子文件夹，并递归导入所有视频至当前素材分类下的对应子分类 | `{ parent_directory_path, directory_paths[], parent_folder_id? }` |
| `media_center_import_files` | 直接导入一个或多个指定视频文件到指定分类目录中 | `{ file_paths: string[], folder_id? }` |
| `media_center_search_videos` | 多条件检索素材库（按目录、标签、分析状态、关键词、拍摄时间/时长排序） | `{ folder_id?, status?, query?, tag?, limit?, sort_by?, sort_dir? }` |
| `media_center_get_video` | 获取单个视频的完整详情（物理绝对路径、基本参数、分镜列表、音频提示） | `{ video_id, include_shots?, include_audio? }` |
| `media_center_trigger_analysis` | 抽取故事板、初始片段和静音区间；视频原音轨的节奏检测不可用 | `{ video_id }` |
| `media_center_upsert_shots` | Agent 完成视觉理解后，批量回写分镜（景别、运镜、画面详述、评分） | `{ video_id, shots: [...] }` |
| `media_center_update_audio_info` | 写入或校正语音转录字幕时间轴、BGM 情绪/BPM、音效（SFX）打点 | `{ video_id, transcripts?, bgm_mood?, bpm?, sfx_cues? }` |
| `media_center_update_video` | 更新视频全局摘要（summary）、业务标签（tags）与人工备注 | `{ video_id, summary?, tags?, user_notes?, status? }` |
| `media_center_search_shots` | 跨视频进行分镜语义检索，根据自然语言召回最契合的镜头及其入出点 | `{ query, shot_type?, camera_movement?, min_duration?, limit? }` |
| `media_center_edit_update_project` | 按项目 ID 和 revision 更新已保存的剪辑时间线 | `{ project_id, expected_revision, project }` |
| `media_center_export_project` | 将已保存项目导出为 `.prproj`、FCPXML 或 Premiere XML，并可指定导出目录 | `{ project_id, format, include_source_audio?, destination_dir? }` |
| `media_center_analyze_shot` | 仅生成单片段精读候选，不覆盖原标注 | `{ video_id, shot_id }` |
| `media_center_get_shot_analysis` | 查询片段精读记录、候选和用量 | `{ video_id, shot_id, limit? }` |
| `media_center_apply_shot_analysis` | 经用户明确授权后应用指定候选字段 | `{ run_id, fields, confirmed: true }` |
| `media_center_configure_ffmpeg` | 查看或手动指定 `ffmpeg.exe` / `ffprobe.exe` 的绝对路径 | `{ ffmpeg_path?, ffprobe_path? }` |
| `media_center_edit_music_list` | 搜索/分页读取本地音乐资产目录；授权只是用户声明 | `{ query?, license_status?, limit?, offset? }` |
| `media_center_edit_music_import` | 将用户指定音频加入音乐资产目录（只引用，不复制） | `{ file_path, title?, artist?, source_name? }` |
| `media_center_edit_music_remove` | 移除音乐目录记录，不删除磁盘文件 | `{ music_id }` |
| `media_center_edit_music_confirm_personal` | 用户明确确认后记录个人分享声明 | `{ music_id, confirmed: true, license_note? }` |
| `media_center_edit_music_analyze` | 本地 DSP 分析：BPM 与候选、1/4 拍网格、小节强拍、段落和切点 | `{ music_id, duration_seconds? }` |
| `media_center_edit_music_analysis_detail` | 读取版本化分析档案；返回段落、拍点、切点和特征元数据 | `{ music_id, limit? }` |
| `media_center_edit_jamendo_search` | 搜索 Jamendo 曲目元数据；不下载、不验证使用许可 | `{ query, limit?, offset? }` |
| `media_center_edit_compose_project` | 按有序分镜引用自动查询边界、计算帧时间线、截取音乐并返回项目预览 | `{ title, rationale, shot_refs[], music_id, canvas?, fps? }` |
| `media_center_edit_preview_project` | 校验 DSH Agent 在会话中迭代形成的结构化时间线；不调用第二个模型或保存 | `{ project: EditProjectV1 }` |
| `media_center_edit_save_project` | 用户明确同意后保存当前服务端预览 ID | `{ preview_id, confirmed: true }` |
| `media_center_edit_projects` | 列出或读取本机已保存的剪辑项目 | `{ project_id?, limit?, offset? }` |

---

## 典型 AI 剪辑自动化闭环工作流

```
1. 发现未分析素材
   Agent ➔ media_center_search_videos({ status: "imported" })

2. 触发底层音视频特征抽取
   Agent ➔ media_center_trigger_analysis({ video_id: "vid_xxx" })
   返回: 故事板大图绝对路径 (4x4 拼图) + 初始片段 + 静音检测状态；BPM 检测不可用

3. 多模态理解与审美分析
   Agent 查看故事板大图与代表性关键帧图片，推理出每个镜头的景别、运镜特征与详细画面描述。

4. 结构化回写
   Agent ➔ media_center_upsert_shots({ video_id: "vid_xxx", shots: [...] })
   Agent ➔ media_center_update_audio_info({ video_id: "vid_xxx", transcripts: [...], bpm: 120 })
   Agent ➔ media_center_update_video({ video_id: "vid_xxx", summary: "...", tags: ["航拍", "日落"], status: "analyzed" })

5. 项目编排与工程导出
   用户提问: "帮我找一段带有日照金山的开篇大远景，接一段藏寨炊烟中景"
   Agent ➔ media_center_search_shots({ query: "日照金山 大远景" })
   Agent ➔ media_center_edit_preview_project({ project: { ... } })
   用户确认后 ➔ media_center_edit_save_project({ preview_id, confirmed: true })
   项目库查看/编辑 ➔ media_center_export_project({ project_id, format: "prproj", destination_dir: "D:\\Exports" })
   可导出原生 .prproj（Windows 剪映）、FCPXML 或 Premiere XML；剪映实际导入兼容性仍需验证。
```

---

## 数据持久化与存储位置规范

- **默认 SQLite 数据库文件**：`<WorkspaceRoot>/.dsh-media-center/media_center.db`
- **缓存与临时工程**：`<WorkspaceRoot>/.dsh-media-center/cache/`
  - `storyboards/`：故事板雪碧大图
  - `keyframes/`：代表性关键帧图片
  - `previews/`：浏览器兼容预览缓存
  - `music-features/`：音乐分析的可绘制波形/频段特征数据
  - `exports/`：默认导出的 `.prproj`、FCPXML 与 Premiere XML 工程文件；也可选择其他本机绝对目录
- 从旧版 `dsh-video-manager` 升级时，首次启动会自动把 `.dsh-video-manager/` 的数据和缓存迁移到 `.dsh-media-center/`，并更新数据库中的缓存路径；旧目录保留作为备份，可确认无误后手动删除。
- 插件会自动更新工作区的 `.gitignore`，忽略新旧数据目录，避免意外将二进制大缓存提交至 Git。

---

## DSH 会话 Agent 剪辑项目工作流

创意讨论、选曲决定、时间线编排和多轮修改均在 DSH 会话 Agent 中完成，避免插件内第二个模型界面与会话割裂。Agent 在对话中调用素材检索、视频/分镜详情、本地音乐库、只读音频测量与 Jamendo 元数据工具；它依据用户审阅的候选素材与实测摘要构造结构化剪辑项目，并可多轮修改。

当用户要求预览时，`media_center_edit_preview_project` 只校验 project v1、素材库 ID、分镜范围、时间线帧边界、音乐库成员、源文件可用性和授权状态，不调用模型、不写数据库、不修改或复制源素材。预览会返回规范化项目与服务端 30 分钟预览 ID；素材文件以 realpath 与文件系统属性弱指纹进行前后检查（非内容哈希），分镜更新后旧预览会失效。

用户查看完整预览并明确要求保存后，Agent 可调用 `media_center_edit_save_project`，只提交服务端预览 ID，不接受客户端替换工程内容。保存结果可在“项目库”页签查看、编辑和导出，也可通过 `media_center_edit_projects` 查询。Agent 应将瞬态称为候选，不能伪称强拍/精确卡点；音乐许可状态是用户声明，未经独立验证。`.prproj` 依赖本机 Python 3 与 `py-premiere`（`pip install py-premiere`）；FCPXML / Premiere XML 不依赖 Python。剪映对具体导入格式的支持仍需以实际版本验证。

---

## 插件内 AI 能力边界

插件继续负责素材/分镜/音频资产管理、素材深度分析、本地 DSP 音乐测量、项目数据校验与持久化。音乐 BPM、拍点、小节强拍、段落和切点均由本地音频特征计算，是估计值而不是乐谱真值：拍点由动态规划节拍跟踪给出，跟随局部变速而非固定网格；段落按 0.5 秒粒度计算并吸附到最近的起音。时间轴默认只显示依据段落切换、能量跃迁和强起音得出的编号卡点（已吸附到拍点，密度可调），小节线与起音线可按需叠加；绘制走 CSS 坐标，Windows 缩放下频谱与标记线保持一致。UI 允许试听核验。创意决策、选曲及时间线编排仍在 DSH 会话中完成。

---

## 素材与视觉模型配置

在工作台【设置】中选择 DSH 已配置的服务商及支持图片输入的模型。如果该模型声明了可选推理档位，还须明确选择并保存档位；切换服务商或模型后，需要重新选择。请求直接使用已保存的档位，不会因请求失败而自动更换档位重试。已有配置如果尚未设置推理档位，需先打开设置完成选择。未声明推理档位的模型无需选择；无法读取能力时需刷新或检查模型配置。自定义 OpenAI 兼容端点维持原有调用方式，不使用 DSH 档位列表。视觉模型仅用于视频故事板与镜头精读，不用于音乐分析。
- **批量 AI 分析并发**：设置中可配置 1–8 个同时请求；并发越高越依赖远端模型吞吐和本机解码/网络能力。单条分析不受该设置影响。
- **批量分析范围**：多选视频后可选“仅分析未分析过的视频”或“分析全部所选视频”；后者会重新生成并覆盖已有 AI 分析结果。
- **失败重试与原因**：设置中可配置失败自动重试次数（0–3，默认 1）；最终失败会在视频卡片显示具体原因，可在菜单中手动重试。视频分析与镜头精读不设置固定输出 token 上限，由所选模型自身能力决定。

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
  target: "D:\\code\\dsh-media-center" // 项目绝对路径
})
```

安装完成后刷新 Web GUI，在左侧导航栏即可看到全新的 **“媒体中心”** 入口！

### 可选：启用原生 `.prproj` 导出

Windows 剪映工程导入需要原生 `.prproj`。插件通过本机 Python 调用 MIT 许可的 `py-premiere` 生成：

```powershell
python -m pip install py-premiere
```

未安装时 FCPXML / Premiere XML 仍可正常导出，`.prproj` 会返回明确的安装提示。
