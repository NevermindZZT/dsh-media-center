import { SHOT_ANALYSIS_FIELDS } from '../db/shot-analysis-store.js';
import { MAX_MUSIC_ANALYSIS_SECONDS } from '../music/beat-analysis.js';

export function registerVideoManagerTools(ctx, { db, mediaEngine, projectExporter, shotSearchService, shotAnalysisService, editingWorkflow }) {
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

  // One shared editing workflow backs both tools and UI.
  const editingFailure = () => ({ success:false, error:'剪辑项目操作失败，请检查项目结构、素材状态和用户授权' });
  const editTool = (name, description, properties, required, execute) => addTool({
    name, description, parameters:{type:'object',properties,required,additionalProperties:false},
    async execute(args, context) {
      if (!editingWorkflow) return {success:false,error:'剪辑工作流不可用'};
      try { return await execute(args || {}, context); } catch { return editingFailure(); }
    }
  });
  const musicId = {type:'string',description:'本地音乐库记录 ID（mus_…）。'};
  const musicProfileSummary=profile=>profile?{analysis_id:profile.analysis_id,music_id:profile.music_id,analysis_version:profile.analysis_version,method:profile.method,status:profile.status,bpm:profile.bpm,confidence:profile.confidence,analysis_window:profile.analysis_window,tempo_candidates:profile.tempo_candidates,confirmed_beat_count:profile.user_confirmed_beats?.length||0,user_confirmed_beats:profile.user_confirmed_beats,style_tags:profile.style_tags,style_rationale:profile.style_rationale,style_provenance:profile.style_provenance}:null;
  const pageFields = {limit:{type:'integer',minimum:1,maximum:100,description:'最多返回数量，默认 25。'},offset:{type:'integer',minimum:0,maximum:1000000,description:'分页偏移，默认 0。'}};
  editTool('video_manager_edit_music_list','列出本地音乐资产，可按标题、作者、文件名和分析状态筛选；返回最新分析摘要，授权状态是用户声明而非版权验证。',
    {query:{type:'string',description:'按标题、艺术家或文件名搜索。'},license_status:{type:'string',enum:['unknown','personal_confirmed']},analysis_status:{type:'string',description:'按分析状态筛选，例如 not_analyzed、ok、low_confidence、stale。'},style_tag:{type:'string',description:'按用户已确认的 Agent 风格标签筛选。'},...pageFields}, [],
    args => ({success:true,...editingWorkflow.listMusicCatalog(args)}));
  editTool('video_manager_edit_music_import','导入本地音乐引用，不复制、修改或删除源文件。',
    {file_path:{type:'string',description:'用户明确指定的本地音频绝对路径。'},title:{type:'string'},artist:{type:'string'},source_name:{type:'string'},source_url:{type:'string'},license_note:{type:'string'}}, ['file_path'],
    async args => ({success:true,...await editingWorkflow.catalog.importFile({file_path:args.file_path,title:args.title,artist:args.artist,source_name:args.source_name,source_url:args.source_url,license_note:args.license_note,license_status:'unknown'})}));
  editTool('video_manager_edit_music_remove','从音乐库移出记录，不删除或更改源文件。', {music_id:musicId}, ['music_id'],
    args => ({success:true,removed:editingWorkflow.removeMusic(args.music_id)}));
  editTool('video_manager_edit_music_confirm_personal','记录用户对个人分享用途的许可声明，不验证版权。',
    {music_id:musicId,license_note:{type:'string',description:'用户提供的授权说明。'},confirmed:{type:'boolean',description:'仅在用户明确确认此音乐可用于个人分享时设为 true。'}}, ['music_id','confirmed'],
    args => args.confirmed !== true ? {success:false,error:'须先由用户明确确认个人分享使用权限'} :
      ({success:true,music:editingWorkflow.catalog.confirmPersonalUse(args.music_id,{confirmed:true,license_note:args.license_note})}));
  editTool('video_manager_edit_music_analyze','对本地音乐窗口进行只读DSP测量，返回BPM估计与拍点候选；原始瞬态时间列表不保存/不返回，候选仍需试听确认。',
    {music_id:musicId,start_seconds:{type:'number',minimum:0,description:'分析窗口的源音频起点（秒），默认 0。'},duration_seconds:{type:'number',minimum:0.1,maximum:MAX_MUSIC_ANALYSIS_SECONDS,description:'分析窗口时长（秒，最多10分钟/600秒）；省略时默认完整音频时长。'}}, ['music_id'],
    async args => {
      const analysis=await editingWorkflow.analyzeMusic(args.music_id,{startSeconds:args.start_seconds,durationSeconds:args.duration_seconds});
      const result={...analysis};delete result.onsets;delete result.transient_onsets;
      const candidates=Array.isArray(analysis.beat_candidates)?analysis.beat_candidates:[];result.beat_candidates=candidates.slice(0,200);result.beat_candidates_omitted=Math.max(0,candidates.length-200);
      return {success:true,analysis:result};
    });
  editTool('video_manager_edit_music_analysis_detail','读取版本化音乐分析档案；若已执行频谱图模型分析，也返回速度与近似节奏提示、场景/风格标签、用户编辑和确认记录。模型提示与DSP候选分开，不能当作精确节拍。',
    {music_id:musicId,limit:{type:'integer',minimum:1,maximum:500,description:'DSP拍点候选与用户确认点每类最多返回数量，默认100；原始瞬态列表不返回。'}}, ['music_id'],
    args=>{
      const analysis=editingWorkflow.getMusicAnalysis(args.music_id);
      if(!analysis)return {success:false,error:'该音乐尚未分析'};
      const limit=args.limit??100,result={...analysis};delete result.onsets;delete result.transient_onsets;
      for(const field of ['beat_candidates','user_confirmed_beats']){
        const values=Array.isArray(analysis[field])?analysis[field]:[];
        result[field]=values.slice(0,limit);result[`${field}_omitted`]=Math.max(0,values.length-limit);
      }
      return {success:true,analysis:result};
    });
  editTool('video_manager_edit_music_spectrogram_interpret','使用已配置图像模型解读指定音乐分析窗口的频谱图。返回带来源的近似速度/节奏点、场景与风格建议；模型提示不是DSP测量或精确拍点。',
    {music_id:musicId,analysis_id:{type:'string',description:'本地节奏分析返回的 analysis_id；模型解读使用该版本的源文件和窗口。'},confirmed:{type:'boolean',description:'仅当用户明确要求对该音频调用大模型解读时设为 true。'}}, ['music_id','analysis_id','confirmed'],
    async args=>args.confirmed!==true?{success:false,error:'须先获得用户对频谱模型解读的明确请求'}:{success:true,...await editingWorkflow.interpretMusicSpectrogram(args.music_id,{analysisId:args.analysis_id})});
  editTool('video_manager_edit_music_confirm_beats','仅在用户试听并明确确认一组拍点候选后保存；每个确认点必须对应实测音频中的节奏拍点候选。',
    {music_id:musicId,analysis_id:{type:'string',description:'video_manager_edit_music_analyze 返回的 analysis_id。'},beats:{type:'array',minItems:1,maxItems:2000,items:{type:'number',minimum:0},description:'用户听审后确认的源音频秒数，必须从 beat_candidates 中选择。'},confirmed:{type:'boolean',description:'仅当用户明确批准保存这些拍点时为 true。'}}, ['music_id','analysis_id','beats','confirmed'],
    args=>args.confirmed!==true?{success:false,error:'须先获得用户对拍点候选的明确确认'}:{success:true,analysis:musicProfileSummary(editingWorkflow.confirmMusicBeats(args.music_id,{analysisId:args.analysis_id,beats:args.beats,confirmed:true}))});
  editTool('video_manager_edit_music_set_styles','保存 DSH 会话 Agent 基于音乐测量与视频素材给出的风格建议；每项是主观建议而非声学测量，须用户明确确认。',
    {music_id:musicId,analysis_id:{type:'string',description:'对应音乐分析记录的 analysis_id。'},style_tags:{type:'array',minItems:1,maxItems:30,items:{type:'string',maxLength:100},description:'如山地风光慢剪、城市夜景、快速蒙太奇等建议标签。'},rationale:{type:'string',maxLength:2000,description:'建议依据和不确定性。'},confirmed:{type:'boolean',description:'仅当用户明确要求保存这些风格建议时为 true。'}}, ['music_id','analysis_id','style_tags','rationale','confirmed'],
    args=>args.confirmed!==true?{success:false,error:'须先获得用户对风格建议的明确确认'}:{success:true,analysis:editingWorkflow.saveMusicStyleSuggestions(args.music_id,{analysisId:args.analysis_id,styleTags:args.style_tags,rationale:args.rationale,confirmed:true})});
  editTool('video_manager_edit_jamendo_search','搜索 Jamendo 曲目元数据；结果不代表已获授权，不能直接导入。使用主机环境变量 JAMENDO_CLIENT_ID。',
    {query:{type:'string',description:'曲目、作者或风格关键词。'},limit:{type:'integer',minimum:1,maximum:20},offset:{type:'integer',minimum:0,maximum:1000}}, ['query'],
    async (args,context) => {
      const clientId=process.env.JAMENDO_CLIENT_ID;
      if (!clientId) return {success:false,error:'主机未设置 JAMENDO_CLIENT_ID；可在工作台单次提供'};
      const result=await editingWorkflow.searchJamendo({clientId,query:args.query,limit:args.limit,offset:args.offset,signal:context?.signal});
      const serialized=JSON.stringify(result);
      if (serialized.includes(clientId) || serialized.includes(JSON.stringify(clientId).slice(1,-1))) return editingFailure();
      return {success:true,...result};
    });
  const editSourceSchema={type:'object',properties:{id:{type:'string',minLength:1,maxLength:200,description:'素材库视频 ID（vid_…）或本地音乐库 ID（mus_…）；禁止 path 字段。'},duration_seconds:{type:'number',minimum:0.001}},required:['id','duration_seconds'],additionalProperties:false};
  const editClipSchema={type:'object',properties:{id:{type:'string',minLength:1,maxLength:200},source:editSourceSchema,source_in_seconds:{type:'number',minimum:0},source_out_seconds:{type:'number',exclusiveMinimum:0},timeline_start_frame:{type:'integer',minimum:0},timeline_end_frame:{type:'integer',minimum:1},rationale:{type:'string',maxLength:500},evidence:{type:'object',properties:{shot_id:{type:'string',minLength:1},purpose:{type:'string',maxLength:300},beat_relation:{type:'string',maxLength:300}},required:['shot_id'],additionalProperties:false},rights:{type:'object',properties:{status:{type:'string',enum:['confirmed','restricted','unknown']},scope:{type:'string',maxLength:100},note:{type:'string',maxLength:2000}},required:['status'],additionalProperties:false}},required:['id','source','source_in_seconds','source_out_seconds','timeline_start_frame','timeline_end_frame'],additionalProperties:false};
  const musicClipSchema={...editClipSchema,required:[...editClipSchema.required,'rights']};
  const editProjectSchema={type:'object',description:'版本化非线性剪辑时间线。由当前 DSH 会话 Agent 根据用户需求设计创意与时序；插件仅校验素材/范围、规范化并预览/保存，不调用另一个 AI 代替 Agent。来源仅引用素材库 ID，不传本地路径。tracks.music 恰有一条音乐片段，必须填写授权状态声明；用户声明不等于版权核验。',properties:{schema_version:{type:'integer',const:1},title:{type:'string',minLength:1,maxLength:300},rationale:{type:'string',minLength:1,maxLength:10000},fps:{type:'object',properties:{num:{type:'integer',minimum:1},den:{type:'integer',minimum:1}},required:['num','den'],additionalProperties:false},canvas:{type:'object',properties:{width:{type:'integer',minimum:1},height:{type:'integer',minimum:1},aspect:{type:'string',enum:['16:9','9:16']}},required:['width','height','aspect'],additionalProperties:false},duration_frames:{type:'integer',minimum:1},tracks:{type:'object',properties:{video:{type:'array',minItems:1,maxItems:40,items:editClipSchema},music:{type:'array',minItems:1,maxItems:1,items:musicClipSchema}},required:['video','music'],additionalProperties:false},evidence:{type:'object',properties:{story_arc:{type:'array',maxItems:20,items:{type:'object',properties:{label:{type:'string',maxLength:200},rationale:{type:'string',maxLength:1000}},required:['label','rationale'],additionalProperties:false}},uncertainties:{type:'array',maxItems:30,items:{type:'string',maxLength:1000}},notice:{type:'string',maxLength:2000},beat_evidence:{type:'string',maxLength:2000}},additionalProperties:false}},required:['schema_version','title','rationale','fps','duration_frames','tracks'],additionalProperties:false};
  editTool('video_manager_edit_preview_project','预览并校验当前 DSH 会话 Agent 自行编排的结构化剪辑项目。插件不调用模型、不解码/复制/修改媒体；会做只读文件属性检查，并核验素材库 ID、分镜范围、轨道、音视频时长和项目帧边界。输入只含素材库 ID，禁止客户端绝对路径。音乐分析仅返回 BPM 估计与瞬态候选，不提供已确认拍点；不要把瞬态写成 beats 或声称准确卡点。预览不落库；将完整规范化项目与警告展示给用户，依据反馈留在 DSH 会话中继续迭代。',
    {project:editProjectSchema}, ['project'],
    args => editingWorkflow.previewProject(args.project));
  editTool('video_manager_edit_save_project','仅在用户已看到完整规范化预览并明确授权后保存该预览；只提交服务端预览 ID，客户端不能替换方案内容。confirmed=true 必须对应本轮用户明确确认。',
    {preview_id:{type:'string',description:'尚未过期的服务端剪辑方案预览 ID。'},confirmed:{type:'boolean',description:'仅当用户已查看完整预览并明确授权保存时为 true。'}}, ['preview_id','confirmed'],
    args => {
       if(args.confirmed!==true)return {success:false,error:'须先获得用户对完整预览的明确授权'};
       const result=editingWorkflow.commitPreview({previewId:args.preview_id,confirmed:true});
       const record=result?.record;
       return result?.success?{success:true,project:record?{id:record.id,title:record.title,revision:record.revision,created_at:record.created_at,updated_at:record.updated_at}:undefined,warnings:result.warnings||[]}:result;
     });
  editTool('video_manager_edit_projects','列出已保存的剪辑项目摘要，或按 project_id 读取完整项目。',
    {project_id:{type:'string',description:'项目 ID；省略时列出摘要。'},...pageFields}, [],
    args => args.project_id ? (()=>{const project=editingWorkflow.projects.get(args.project_id);return project ? {success:true,project} : {success:false,error:'剪辑项目不存在'};})() :
      ({success:true,projects:editingWorkflow.projects.list({limit:args.limit ?? 25,offset:args.offset ?? 0})}));

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
    description: '扫描用户明确指定的目录并导入其中视频，按物理子目录镜像分类；可归入指定素材父分类。源媒体只读引用。',
    parameters: {
      type: 'object',
      properties: {
        directory_path: {type:'string',description:'用户明确指定、需要递归导入的文件夹绝对路径。'},
        folder_id: {type:'string',description:'可选的素材库父分类 ID；扫描目录会作为其子分类导入。'}
      },
      required: ['directory_path'],
      additionalProperties: false
    },
    async execute(args) {
      try {
        const result = await mediaEngine.scanAndImportDirectory(args.directory_path,args.folder_id||null);
        return { success: true, ...result };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  });

  // Import multiple checked child folders under one asset parent.
  addTool({
    name: 'video_manager_import_subfolders',
    description: '将用户明确选择的多个直接子文件夹作为指定素材分类的子分类导入，并递归导入其中视频；源视频只读引用，不复制、修改或删除。',
    parameters: {type:'object',properties:{
      parent_directory_path:{type:'string',description:'用户正在浏览的父文件夹绝对路径。'},
      directory_paths:{type:'array',items:{type:'string'},minItems:1,maxItems:50,description:'用户明确选择的直接子文件夹绝对路径列表。'},
      parent_folder_id:{type:'string',description:'可选的当前素材库父分类 ID。'}
    },required:['parent_directory_path','directory_paths'],additionalProperties:false},
    async execute(args){
      try{return {success:true,...await mediaEngine.scanAndImportDirectories(args.directory_paths,args.parent_directory_path,args.parent_folder_id||null)};}
      catch(e){return {success:false,error:e.message};}
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
    description: '获取视频源路径、基础参数及可选的分镜和音频信息。历史 BPM/节拍值来源未确认，不能视为实测。',
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
      return { success: true, video, ...(includeAudio ? { audio_tempo_notice: '历史 BPM 和节拍来源未确认，不应视为实测；自动 BPM 检测当前不可用。' } : {}) };
    }
  });

  // 5. video_manager_trigger_analysis
  addTool({
    name: 'video_manager_trigger_analysis',
    description: '提取视频故事板、初始分镜与静音区间。节拍和 BPM 检测目前不可用；旧值来源未确认，不应视为实测结果。',
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

        // Silence can be empty on success; failures remain distinct and do not write.
        let silenceResult;
        try { silenceResult = await mediaEngine.detectSilenceResult(video); }
        catch { silenceResult = { status: 'error', reason: 'silence_detection_failed', intervals: null }; }
        const tempoResult = { status: 'unavailable', reason: 'tempo_detector_not_integrated', bpm: null, beats: null };
        if (silenceResult?.status === 'ok' && Array.isArray(silenceResult.intervals)) {
          db.upsertVideoAudio(video.id, { silence_intervals: silenceResult.intervals });
        }

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
          silence_intervals_count: silenceResult?.status === 'ok' && Array.isArray(silenceResult.intervals) ? silenceResult.intervals.length : null,
          estimated_bpm: null,
          audio_analysis: { silence: silenceResult, tempo: tempoResult },
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
    description: '生成实验性剪辑工程文件（jianying、fcpxml、edl）；剪映仅包含视频轨道、不含音乐，也未经 11.7.3 打开验证，不会自动安装草稿。',
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
        message: `已生成实验性工程文件（兼容性未验证；剪映格式不含音乐）：${result.file_path || result.draft_folder}`,
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
