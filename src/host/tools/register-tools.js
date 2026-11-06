import { SHOT_ANALYSIS_FIELDS } from '../db/shot-analysis-store.js';

export function registerVideoManagerTools(ctx, { db, mediaEngine, projectExporter, shotSearchService, shotAnalysisService }) {
  if (!ctx.tools || typeof ctx.tools.register !== 'function') {
    return () => {};
  }

  const disposers = [];

  const addTool = (def) => {
    const fullDef = {
      ...def,
      output: {
        schema: { type: 'object' },
        render(args, value) {
          const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
          return [{ type: 'text', text }];
        }
      }
    };
    const dispose = ctx.tools.register(fullDef);
    disposers.push(dispose);
  };

  // 0. Shot deep-analysis tools: candidate creation is separate from application.
  const shotFields = new Set(SHOT_ANALYSIS_FIELDS);
  const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
  const unavailable = () => ({ success: false, error: '片段深度分析服务不可用' });
  // Return the review data rather than prompt snapshots; long fields are explicitly marked.
  const summarizeRun = run => {
    const truncated = [];
    const clipObject = (value, label, fields) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const result = {};
      for (const key of fields) {
        if (!Object.hasOwn(value, key)) continue;
        const item = value[key];
        if (typeof item === 'string') {
          result[key] = item.slice(0, 1200);
          if (item.length > 1200) truncated.push(`${label}.${key}`);
        } else if (key === 'tags' && Array.isArray(item)) {
          result[key] = item.slice(0, 20).map(tag => typeof tag === 'string' ? tag.slice(0, 200) : tag);
          if (item.length > 20 || item.some(tag => typeof tag === 'string' && tag.length > 200)) truncated.push(`${label}.tags`);
        } else if (key === 'quality_score' && (item === null || typeof item === 'number')) result[key] = item;
      }
      return result;
    };
    const baseline = run.shot_snapshot || run.baseline;
    const result = {
      run_id: run.id, video_id: run.video_id, shot_id: run.shot_id,
      status: run.status, start_time: run.start_time, end_time: run.end_time,
      sample_times: Array.isArray(run.sample_times) ? run.sample_times.slice(0, 16) : [],
      storyboard_path: run.storyboard_path || null,
      candidate: clipObject(run.candidate, 'candidate', [...SHOT_ANALYSIS_FIELDS, 'uncertainty', 'editing_suggestions']),
      baseline: clipObject(baseline, 'baseline', SHOT_ANALYSIS_FIELDS),
      provider: run.provider || null, model: run.model || null, reasoning_effort: run.reasoning_effort || null,
      audit: run.audit ? {
        prompt_tokens: run.audit.prompt_tokens ?? null, completion_tokens: run.audit.completion_tokens ?? null,
        total_tokens: run.audit.total_tokens ?? null, latency_ms: run.audit.latency_ms ?? null
      } : null,
      error_code: run.error_code || null, error_message: typeof run.error_message === 'string' ? run.error_message.slice(0, 300) : null,
      applied_fields: Array.isArray(run.applied_fields) ? run.applied_fields.filter(field => shotFields.has(field)) : [],
      created_at: run.created_at || null, finished_at: run.finished_at || null, applied_at: run.applied_at || null
    };
    if (truncated.length) {
      result.truncated_fields = truncated;
      result.review_notice = '部分字段已截断；请在工作台查看完整结果及当前标注后，再请求用户明确授权应用。';
    }
    return result;
  };
  const failure = error => ({ success: false, error: typeof error?.message === 'string' ? error.message.slice(0, 300) : '片段分析操作失败' });

  addTool({
    name: 'video_manager_analyze_shot',
    description: '对已有片段按采样帧生成深度分析候选和审计记录，不应用或覆盖原标注；读取结果后再由用户决定是否应用。',
    parameters: {
      type: 'object',
      properties: {
        video_id: { type: 'string', minLength: 1, maxLength: 200, description: '所属视频 ID。' },
        shot_id: { type: 'string', minLength: 1, maxLength: 200, description: '所属视频中的片段 ID。' }
      },
      required: ['video_id', 'shot_id'], additionalProperties: false
    },
    async execute(args) {
      if (!validId(args?.video_id) || !validId(args?.shot_id)) return { success: false, error: '需要有效的 video_id 和 shot_id' };
      if (typeof shotAnalysisService?.analyze !== 'function') return unavailable();
      try { return { success: true, run: summarizeRun(await shotAnalysisService.analyze(args.video_id, args.shot_id)) }; }
      catch (error) { return failure(error); }
    }
  });

  addTool({
    name: 'video_manager_get_shot_analysis',
    description: '查看片段最近的深度分析候选、原标注快照和消耗；返回内容不含提示词，截断字段须在工作台查看完整值。',
    parameters: {
      type: 'object',
      properties: {
        video_id: { type: 'string', minLength: 1, maxLength: 200, description: '所属视频 ID。' },
        shot_id: { type: 'string', minLength: 1, maxLength: 200, description: '片段 ID。' },
        limit: { type: 'integer', minimum: 1, maximum: 5, description: '最近记录数量，默认 3，最多 5。' }
      },
      required: ['video_id', 'shot_id'], additionalProperties: false
    },
    async execute(args) {
      if (!validId(args?.video_id) || !validId(args?.shot_id)) return { success: false, error: '需要有效的 video_id 和 shot_id' };
      const limit = args.limit === undefined ? 3 : args.limit;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5) return { success: false, error: 'limit 必须为 1 到 5 的整数' };
      if (typeof shotAnalysisService?.store?.listRuns !== 'function') return unavailable();
      try {
        const runs = await shotAnalysisService.store.listRuns({ video_id: args.video_id, shot_id: args.shot_id, limit });
        return { success: true, runs: runs.slice(0, limit).map(summarizeRun), limit };
      } catch (error) { return failure(error); }
    }
  });

  addTool({
    name: 'video_manager_apply_shot_analysis',
    description: '将深度分析候选中的指定字段应用到原片段标注；必须先展示完整候选并获得用户对这些字段的明确授权。不会修改视频源文件。',
    parameters: {
      type: 'object',
      properties: {
        run_id: { type: 'string', minLength: 1, maxLength: 200, description: '候选分析记录 ID。' },
        fields: { type: 'array', minItems: 1, maxItems: SHOT_ANALYSIS_FIELDS.length, uniqueItems: true,
          items: { type: 'string', enum: SHOT_ANALYSIS_FIELDS }, description: '用户明确授权应用的字段。' },
        confirmed: { type: 'boolean', description: '只有用户在看到完整候选后明确授权应用所列字段，才可设为 true。' }
      },
      required: ['run_id', 'fields', 'confirmed'], additionalProperties: false
    },
    async execute(args) {
      if (args?.confirmed !== true) return { success: false, error: '必须先向用户展示完整候选并获得明确授权，confirmed 才能为 true' };
      if (!validId(args.run_id)) return { success: false, error: '需要有效的 run_id' };
      const fields = args.fields;
      if (!Array.isArray(fields) || !fields.length || fields.length > SHOT_ANALYSIS_FIELDS.length ||
          fields.some(field => !shotFields.has(field)) || new Set(fields).size !== fields.length) {
        return { success: false, error: 'fields 必须是非空、无重复的允许字段列表' };
      }
      if (typeof shotAnalysisService?.store?.applyFields !== 'function') return unavailable();
      try {
        const result = await shotAnalysisService.store.applyFields(args.run_id, fields);
        return { success: true, run: summarizeRun(result.run), applied_fields: result.applied_fields };
      } catch (error) { return failure(error); }
    }
  });

  // 1. video_manager_list_folders
  addTool({
    name: 'video_manager_list_folders',
    description: '列出视频资产库的文件夹目录树（至少包含两级层级，如“项目名称/场景分类”），并返回各个目录下的视频总数及已分析视频数量。',
    parameters: {
      type: 'object',
      properties: {
        parent_id: {
          type: 'string',
          description: '可选的父目录 ID。留空则返回从顶级根目录开始的完整多级树。'
        }
      },
      additionalProperties: false
    },
    async execute() {
      const tree = db.getFolderTree();
      return { success: true, folder_tree: tree };
    }
  });

  // 2. video_manager_scan_directory
  addTool({
    name: 'video_manager_scan_directory',
    description: '扫描指定物理文件夹并导入视频素材。会自动按照物理子目录结构镜像创建多级分类目录（如 甘南环线旅游 -> 扎尕那），提取视频基础参数并生成故事板大图。',
    parameters: {
      type: 'object',
      properties: {
        directory_path: {
          type: 'string',
          description: '要扫描导入的本地文件夹绝对物理路径。'
        }
      },
      required: ['directory_path'],
      additionalProperties: false
    },
    async execute(args) {
      try {
        const result = await mediaEngine.scanAndImportDirectory(args.directory_path);
        return { success: true, ...result };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  });

  // 2.1 video_manager_import_files
  addTool({
    name: 'video_manager_import_files',
    description: '直接导入一个或多个指定的本地视频文件到指定分类目录中。提取视频参数并生成故事板大图。',
    parameters: {
      type: 'object',
      properties: {
        file_paths: {
          type: 'array',
          items: { type: 'string' },
          description: '要导入的视频文件绝对物理路径列表。'
        },
        folder_id: {
          type: 'string',
          description: '可选的归属分类目录 ID。'
        }
      },
      required: ['file_paths'],
      additionalProperties: false
    },
    async execute(args) {
      try {
        const result = await mediaEngine.importFiles(args.file_paths, args.folder_id || null);
        return { success: true, ...result };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  });

  // 3. video_manager_search_videos
  addTool({
    name: 'video_manager_search_videos',
    description: '多条件检索视频素材库。支持按目录层级、分析状态、文件名/描述关键词或标签过滤，返回紧凑的视频列表。',
    parameters: {
      type: 'object',
      properties: {
        folder_id: {
          type: 'string',
          description: '可选的目录 ID，过滤该目录或其子目录下的视频。'
        },
        status: {
          type: 'string',
          enum: ['imported', 'analyzing', 'analyzed', 'error'],
          description: '可选的状态过滤：imported=已导入待分析，analyzed=已完成分镜分析。'
        },
        query: {
          type: 'string',
          description: '可选的文件名、摘要或用户备注模糊匹配关键词。'
        },
        tag: {
          type: 'string',
          description: '可选的标签精准过滤。'
        },
        limit: {
          type: 'integer',
          description: '返回数量上限，默认 20。'
        },
        sort_by: {
          type: 'string',
          enum: ['captured_at', 'created_at', 'file_name', 'duration'],
          description: '可选的排序字段：captured_at=拍摄时间，created_at=导入时间，file_name=文件名，duration=视频时长。'
        },
        sort_dir: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: '可选的排序方向：asc=升序，desc=降序。'
        }
      },
      additionalProperties: false
    },
    async execute(args) {
      const videos = db.queryVideos(args);
      return {
        success: true,
        total: videos.length,
        videos: videos.map(v => ({
          id: v.id,
          file_name: v.file_name,
          file_path: v.file_path,
          folder_name: v.folder_name,
          folder_path: v.folder_path,
          duration: v.duration,
          resolution: `${v.width}x${v.height}`,
          fps: v.fps,
          codec: v.codec,
          status: v.status,
          tags: v.tags,
          summary: v.summary,
          captured_at: v.captured_at,
          storyboard_path: v.storyboard_path
        }))
      };
    }
  });

  // 4. video_manager_get_video
  addTool({
    name: 'video_manager_get_video',
    description: '获取单个视频的完整详情，包含视频源物理文件路径、基础参数、分镜列表（Shots）及音频信息（语音转录、静音区间、BPM）。',
    parameters: {
      type: 'object',
      properties: {
        video_id: {
          type: 'string',
          description: '视频唯一 ID。'
        },
        include_shots: {
          type: 'boolean',
          description: '是否包含分镜解析列表，默认为 true。'
        },
        include_audio: {
          type: 'boolean',
          description: '是否包含音频与提示信息（转录文本、静音区间、节奏卡点），默认为 true。'
        }
      },
      required: ['video_id'],
      additionalProperties: false
    },
    async execute(args) {
      const includeShots = args.include_shots !== false;
      const includeAudio = args.include_audio !== false;
      const video = db.getVideoById(args.video_id, includeShots, includeAudio);
      if (!video) {
        return { success: false, error: `Video not found: ${args.video_id}` };
      }
      return { success: true, video };
    }
  });

  // 5. video_manager_trigger_analysis
  addTool({
    name: 'video_manager_trigger_analysis',
    description: '触发对指定视频的底层特征分析。生成 4x4 故事板大图拼图（Contact Sheet）、自动检测音频静音区间、提取音乐节奏/BPM，并切分出初始分镜及其代表性关键帧图片。返回可供 AI 阅读的视觉故事板图片路径与初始切分点。',
    parameters: {
      type: 'object',
      properties: {
        video_id: {
          type: 'string',
          description: '要触发分析的视频 ID。'
        }
      },
      required: ['video_id'],
      additionalProperties: false
    },
    async execute(args) {
      const video = db.getVideoById(args.video_id);
      if (!video) {
        return { success: false, error: `Video not found: ${args.video_id}` };
      }

      db.upsertVideo({ id: video.id, status: 'analyzing' });

      try {
        // 1. Storyboard
        const storyboardPath = await mediaEngine.generateStoryboard(video);

        // 2. Silence detection
        const silenceIntervals = await mediaEngine.detectSilence(video);

        // 3. BPM and Beats
        const { bpm, beats } = await mediaEngine.detectBpmAndBeats(video);

        // Save audio analysis
        db.upsertVideoAudio(video.id, {
          silence_intervals: silenceIntervals,
          bpm,
          beats
        });

        // 4. Initial shots & keyframes
        const shots = await mediaEngine.detectInitialShots(video);
        db.upsertShots(video.id, shots);

        const updated = db.getVideoById(video.id, true, true);

        return {
          success: true,
          message: '底层音视频特征抽取完成。请基于返回的故事板大图及分镜关键帧进行多模态审美与内容理解，然后调用 video_manager_upsert_shots 完善分镜信息。',
          video_id: video.id,
          storyboard_image_path: storyboardPath,
          shots_count: shots.length,
          silence_intervals_count: silenceIntervals.length,
          estimated_bpm: bpm,
          shots: updated.shots
        };
      } catch (e) {
        db.upsertVideo({ id: video.id, status: 'error' });
        return { success: false, error: e.message };
      }
    }
  });

  // 6. video_manager_upsert_shots
  addTool({
    name: 'video_manager_upsert_shots',
    description: '批量写入或更新视频的分镜解析数据。AI Agent 分析完关键帧或故事板后，调用此工具结构化写入景别、运镜、画面详细描述、主体物及可用度评分。',
    parameters: {
      type: 'object',
      properties: {
        video_id: {
          type: 'string',
          description: '所属视频 ID。'
        },
        shots: {
          type: 'array',
          description: '分镜列表。',
          items: {
            type: 'object',
            properties: {
              shot_index: { type: 'integer', description: '分镜序号（从 1 开始）。' },
              start_time: { type: 'number', description: '镜头开始时间（秒）。' },
              end_time: { type: 'number', description: '镜头结束时间（秒）。' },
              shot_type: { type: 'string', description: '景别：特写/大特写/中景/全景/远景/大远景。' },
              camera_movement: { type: 'string', description: '运镜：固定/推镜头/拉镜头/摇镜头/移镜头/升降/航拍跟随。' },
              subject: { type: 'string', description: '镜头主体人物、动作或核心物体。' },
              visual_description: { type: 'string', description: '镜头画面的详细视觉描述与发生的情节。' },
              composition: { type: 'string', description: '构图、光影及色彩氛围描述。' },
              tags: { type: 'array', items: { type: 'string' }, description: '该分镜的关键词标签。' },
              quality_score: { type: 'number', description: '素材质量与剪辑可用度评分（1.0 - 5.0）。' }
            },
            required: ['start_time', 'end_time', 'visual_description']
          }
        }
      },
      required: ['video_id', 'shots'],
      additionalProperties: false
    },
    async execute(args) {
      const video = db.getVideoById(args.video_id);
      if (!video) {
        return { success: false, error: `Video not found: ${args.video_id}` };
      }
      const savedIds = db.upsertShots(args.video_id, args.shots);
      return {
        success: true,
        message: `成功保存 ${savedIds.length} 个分镜镜头。`,
        video_id: args.video_id,
        saved_shot_ids: savedIds
      };
    }
  });

  // 7. video_manager_update_audio_info
  addTool({
    name: 'video_manager_update_audio_info',
    description: '写入或更新视频的音频分析信息，包括语音转录文本与时间轴（Transcripts）、背景音乐情绪（bgm_mood）、BPM节拍及音效打点（SFX）。',
    parameters: {
      type: 'object',
      properties: {
        video_id: { type: 'string', description: '所属视频 ID。' },
        transcripts: {
          type: 'array',
          description: '语音转录字幕列表。',
          items: {
            type: 'object',
            properties: {
              start: { type: 'number', description: '字幕起始秒数。' },
              end: { type: 'number', description: '字幕结束秒数。' },
              text: { type: 'string', description: '说话内容。' },
              speaker: { type: 'string', description: '说话人标识（可选）。' }
            },
            required: ['start', 'end', 'text']
          }
        },
        bgm_type: { type: 'string', description: '配乐类型：纯人声/背景音乐/环境音。' },
        bgm_mood: { type: 'string', description: '音频情绪：欢快/紧张/抒情/震撼/悬疑/平静等。' },
        bpm: { type: 'number', description: '音乐节拍速度 BPM。' },
        sfx_cues: {
          type: 'array',
          description: '音效提示点。',
          items: {
            type: 'object',
            properties: {
              time: { type: 'number', description: '时间点（秒）。' },
              description: { type: 'string', description: '音效描述（如关门声、爆炸声、笑声）。' }
            },
            required: ['time', 'description']
          }
        }
      },
      required: ['video_id'],
      additionalProperties: false
    },
    async execute(args) {
      const video = db.getVideoById(args.video_id);
      if (!video) {
        return { success: false, error: `Video not found: ${args.video_id}` };
      }
      const audio = db.upsertVideoAudio(args.video_id, args);
      return { success: true, audio };
    }
  });

  // 8. video_manager_update_video
  addTool({
    name: 'video_manager_update_video',
    description: '更新视频的整体元数据，包括全片摘要（summary）、业务标签（tags）以及人工备注（user_notes）。',
    parameters: {
      type: 'object',
      properties: {
        video_id: { type: 'string', description: '视频 ID。' },
        summary: { type: 'string', description: '视频全局画面与情节摘要。' },
        tags: { type: 'array', items: { type: 'string' }, description: '全局标签列表。' },
        user_notes: { type: 'string', description: '备忘与剪辑提示。' },
        status: { type: 'string', enum: ['imported', 'analyzing', 'analyzed', 'error'] }
      },
      required: ['video_id'],
      additionalProperties: false
    },
    async execute(args) {
      const updated = db.upsertVideo({
        id: args.video_id,
        summary: args.summary,
        tags: args.tags,
        user_notes: args.user_notes,
        status: args.status
      });
      return { success: true, video: updated };
    }
  });

  // 9. video_manager_search_shots
  addTool({
    name: 'video_manager_search_shots',
    description: '跨视频进行分镜语义检索。根据自然语言描述（如“日落时分的雪山特写”、“奔跑的儿童”），毫秒级召回最契合的镜头片段及其精准入出点。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '镜头画面语义描述或关键词。'
        },
        shot_type: {
          type: 'string',
          description: '可选的景别过滤：特写/中景/全景等。'
        },
        camera_movement: {
          type: 'string',
          description: '可选的运镜过滤：推镜头/拉镜头/固定/航拍等。'
        },
        min_duration: {
          type: 'number',
          description: '最短镜头时长（秒）。'
        },
        limit: {
          type: 'integer',
          description: '返回数量上限，默认 20。'
        }
      },
      required: ['query'],
      additionalProperties: false
    },
    async execute(args) {
      const results = shotSearchService.search(args.query, args);
      return {
        success: true,
        query: args.query,
        count: results.length,
        shots: results.map(s => ({
          shot_id: s.id,
          video_id: s.video_id,
          file_name: s.file_name,
          file_path: s.file_path,
          folder_path: s.folder_path,
          start_time: s.start_time,
          end_time: s.end_time,
          duration: s.duration,
          shot_type: s.shot_type,
          camera_movement: s.camera_movement,
          subject: s.subject,
          visual_description: s.visual_description,
          tags: s.tags,
          quality_score: s.quality_score,
          relevance_score: s.relevance_score
        }))
      };
    }
  });

  // 10. video_manager_export_project
  addTool({
    name: 'video_manager_export_project',
    description: '将选定或编排好的镜头片段一键导出为专业剪辑软件工程文件。支持剪映本地草稿（jianying）、Final Cut Pro XML（fcpxml）或 CMX 3600 EDL。',
    parameters: {
      type: 'object',
      properties: {
        sequence_name: {
          type: 'string',
          description: '剪辑序列/草稿名称，如“甘南风光初剪第一版”。'
        },
        format: {
          type: 'string',
          enum: ['jianying', 'fcpxml', 'edl'],
          description: '导出工程格式：jianying=剪映本地草稿，fcpxml=Premiere/Final Cut Pro XML，edl=通用EDL。'
        },
        clips: {
          type: 'array',
          description: '时间线上的镜头片段列表（按播放顺序排列）。',
          items: {
            type: 'object',
            properties: {
              video_id: { type: 'string', description: '视频 ID。' },
              file_path: { type: 'string', description: '视频文件物理绝对路径（可选，缺省时自动根据 video_id 查找）。' },
              in_point: { type: 'number', description: '素材入点（秒）。' },
              out_point: { type: 'number', description: '素材出点（秒）。' },
              description: { type: 'string', description: '该片段的剪辑备注。' }
            },
            required: ['in_point', 'out_point']
          }
        },
        fps: {
          type: 'integer',
          description: '工程时间线帧率，默认为 30。'
        }
      },
      required: ['sequence_name', 'format', 'clips'],
      additionalProperties: false
    },
    async execute(args) {
      const filledClips = [];
      for (const c of args.clips) {
        let v = null;
        if (c.video_id) {
          v = db.getVideoById(c.video_id);
        } else if (c.file_path) {
          v = db.getVideoByPath(c.file_path);
        }
        filledClips.push({
          ...c,
          file_path: c.file_path || (v ? v.file_path : ''),
          file_name: v ? v.file_name : (c.file_path ? path.basename(c.file_path) : 'clip'),
          file_duration: v ? v.duration : 3600,
          width: v ? v.width : 1920,
          height: v ? v.height : 1080
        });
      }

      let result;
      if (args.format === 'edl') {
        result = projectExporter.exportEDL(args.sequence_name, filledClips, { fps: args.fps });
      } else if (args.format === 'fcpxml') {
        result = projectExporter.exportFCPXML(args.sequence_name, filledClips, { fps: args.fps });
      } else {
        result = projectExporter.exportJianYingDraft(args.sequence_name, filledClips, { fps: args.fps });
      }

      return {
        success: true,
        message: `工程成功导出至：${result.file_path || result.draft_folder}`,
        export_result: result
      };
    }
  });

  // 11. video_manager_configure_ffmpeg
  addTool({
    name: 'video_manager_configure_ffmpeg',
    description: '设置或查看 FFmpeg 和 FFprobe 的可执行文件绝对路径。在系统未全局配置环境变量时，可通过此工具手动指定路径。',
    parameters: {
      type: 'object',
      properties: {
        ffmpeg_path: {
          type: 'string',
          description: 'ffmpeg.exe 的绝对路径（可选）。'
        },
        ffprobe_path: {
          type: 'string',
          description: 'ffprobe.exe 的绝对路径（可选）。'
        }
      },
      additionalProperties: false
    },
    async execute(args) {
      if (args.ffmpeg_path) {
        db.setSetting('ffmpeg_path', args.ffmpeg_path);
      }
      if (args.ffprobe_path) {
        db.setSetting('ffprobe_path', args.ffprobe_path);
      }
      const bins = await mediaEngine.getBinaries();
      return { success: true, binaries: bins };
    }
  });

  return () => {
    for (const dispose of disposers) {
      try { dispose(); } catch {}
    }
  };
}
