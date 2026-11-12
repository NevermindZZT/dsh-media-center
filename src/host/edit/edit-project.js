/**
 * Independent, versioned edit-project data contract. This module is pure: it
 * never opens, modifies, copies, moves, or deletes source media. Paths and
 * metadata are user-supplied assertions, not verified filesystem facts.
 *
 * Times on project tracks are integer frame boundaries [start,end). Source
 * media offsets and beat positions are seconds relative to that source. Playback
 * speed is exactly 1; a mismatch larger than half a project frame is rejected.
 *
 * {
 *   schema_version: 1, title: string, fps: {num: integer, den: integer},
 *   canvas?: {width: integer, height: integer, aspect: '16:9'|'9:16'},
 *   duration_frames: integer, rationale: string, evidence?: JSON,
 *   tracks: { video: [clip], music: [clip] }
 * }
 * clip: {id, source:{id,duration_seconds,path?}, source_in_seconds,
 *   source_out_seconds, timeline_start_frame, timeline_end_frame,
 *   rationale?, evidence?}; music clip additionally has rights object and
 *   optional beats: [{source_seconds, ...}]. Unknown JSON fields are retained.
 */

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const EPSILON = 1e-9;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const natural = value => Number.isSafeInteger(value) && value >= 0;

function assertFps(fps) {
  if (!isObject(fps) || !Number.isSafeInteger(fps.num) || !Number.isSafeInteger(fps.den) ||
      fps.num <= 0 || fps.den <= 0 || fps.num / fps.den > 240 || fps.num / fps.den < 1) {
    throw new TypeError('fps requires positive safe integers num/den with rate between 1 and 240');
  }
}

/** Round seconds to the nearest timeline frame; never mutates a project. */
export function quantizeSecondsToFrame(seconds, fps) {
  assertFps(fps);
  if (!finite(seconds) || seconds < 0) throw new RangeError('seconds must be a finite nonnegative number');
  const frames = seconds * fps.num / fps.den;
  if (!Number.isFinite(frames) || frames > MAX_SAFE - 1) throw new RangeError('frame count exceeds safe integer range');
  return Math.round(frames);
}

/** Convert an integer frame boundary to seconds using the rational rate. */
export function frameToSeconds(frame, fps) {
  assertFps(fps);
  if (!natural(frame)) throw new RangeError('frame must be a nonnegative safe integer');
  return frame * fps.den / fps.num;
}

function cloneJson(value) {
  // structuredClone alone allows NaN, undefined, Date, Map and cycles; those do
  // not have an unambiguous persistent JSON representation.
  const stack = new Set();
  const visit = item => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (typeof item !== 'object' || (!Array.isArray(item) && !isObject(item))) throw new TypeError('project must contain JSON-compatible data only');
    if (stack.has(item)) throw new TypeError('project must not contain cycles');
    stack.add(item);
    let result;
    if (Array.isArray(item)) {
      for (let i=0; i<item.length; i++) if (!Object.hasOwn(item, i)) throw new TypeError('project must not contain sparse arrays');
      result = item.map(visit);
    }
    else {
      result = {};
      for (const [key, child] of Object.entries(item)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new TypeError('unsafe property name');
        result[key] = visit(child);
      }
    }
    stack.delete(item);
    return result;
  };
  return visit(value);
}

/**
 * Validate and normalize a project without modifying input. Errors/warnings are
 * structured {code,path,message}. No check asserts source existence or rights.
 * Gaps on video track and any overlaps on either track are errors; music gaps
 * are permitted and reported as warnings. Unknown rights remain unknown.
 */
export function validateEditProject(input) {
  const errors = [], warnings = [];
  const error = (code, path, message) => errors.push({ code, path, message });
  const warn = (code, path, message) => warnings.push({ code, path, message });
  let project;
  try { project = cloneJson(input); }
  catch (e) { return { valid:false, errors:[{code:'INVALID_JSON',path:'$',message:e.message}], warnings, project:null }; }
  if (!isObject(project)) return { valid:false, errors:[{code:'INVALID_PROJECT',path:'$',message:'project must be an object'}], warnings, project:null };
  if (project.schema_version !== 1) error('SCHEMA_VERSION','$.schema_version','schema_version must be 1');
  if (!nonempty(project.title)) error('TITLE','$.title','title must be nonempty');
  if (!nonempty(project.rationale)) error('RATIONALE','$.rationale','overall design rationale is required');
  let fpsValid = true;
  try { assertFps(project.fps); } catch (e) { fpsValid = false; error('FPS','$.fps',e.message); }
  if (!Number.isSafeInteger(project.duration_frames) || project.duration_frames <= 0) error('DURATION','$.duration_frames','duration_frames must be a positive safe integer');
  if (project.canvas === undefined) project.canvas = {width:1920,height:1080,aspect:'16:9'};
  const canvas = project.canvas;
  if (!isObject(canvas) || !Number.isSafeInteger(canvas.width) || !Number.isSafeInteger(canvas.height) ||
      canvas.width <= 0 || canvas.height <= 0 || !['16:9','9:16'].includes(canvas.aspect) ||
      (canvas.aspect === '16:9' && canvas.width * 9 !== canvas.height * 16) ||
      (canvas.aspect === '9:16' && canvas.width * 16 !== canvas.height * 9)) {
    error('CANVAS','$.canvas','canvas dimensions must match 16:9 or 9:16');
  }
  if (!isObject(project.tracks)) {
    error('TRACKS','$.tracks','tracks must contain video and music arrays');
    return {valid:false,errors,warnings,project:null};
  }
  warn('SOURCES_UNVERIFIED','$.tracks','source paths, durations and accessibility are supplied metadata and were not checked');
  const ids = new Set();
  for (const trackName of ['video','music']) {
    const clips = project.tracks[trackName], trackPath = `$.tracks.${trackName}`;
    if (!Array.isArray(clips)) { error('TRACK',trackPath,'track must be an array'); continue; }
    if (trackName === 'video' && !clips.length) error('VIDEO_EMPTY',trackPath,'at least one video segment is required');
    if (trackName === 'music' && !clips.length) warn('MUSIC_MISSING',trackPath,'project has no music; no rhythm alignment is asserted');
    const spans = [];
    for (let i=0; i<clips.length; i++) {
      const clip = clips[i], p = `${trackPath}[${i}]`;
      if (!isObject(clip)) { error('CLIP',p,'clip must be an object'); continue; }
      if (!nonempty(clip.id)) error('CLIP_ID',`${p}.id`,'clip id is required');
      else if (ids.has(clip.id)) error('DUPLICATE_CLIP_ID',`${p}.id`,'clip id must be unique across tracks');
      else ids.add(clip.id);
      if (!isObject(clip.source) || !nonempty(clip.source.id)) error('SOURCE',`${p}.source`,'source with nonempty id is required');
      const duration = clip.source?.duration_seconds;
      if (!finite(duration) || duration <= 0) error('SOURCE_DURATION',`${p}.source.duration_seconds`,'declared source duration must be finite and positive');
      if (clip.source?.path !== undefined && !nonempty(clip.source.path)) error('SOURCE_PATH',`${p}.source.path`,'source path must be a nonempty string when supplied');
      if (clip.speed !== undefined && clip.speed !== 1) error('SPEED',`${p}.speed`,'only speed 1 is supported');
      const a=clip.source_in_seconds, b=clip.source_out_seconds;
      const sourceValid=finite(a) && finite(b) && a >= 0 && b > a && finite(duration) && duration > 0 && b <= duration;
      if (!sourceValid) error('SOURCE_RANGE',p,'source range must satisfy 0 <= in < out <= source duration');
      const x=clip.timeline_start_frame, y=clip.timeline_end_frame;
      const timeValid=natural(x) && natural(y) && y > x && Number.isSafeInteger(project.duration_frames) && y <= project.duration_frames;
      if (!timeValid) error('TIMELINE_RANGE',p,'timeline range must be positive integer frame boundaries within project duration');
      else spans.push({start:x,end:y,index:i});
      if (sourceValid && timeValid && fpsValid) {
        const tolerance = fpsValid ? project.fps.den / project.fps.num / 2 + EPSILON : 0;
        if (Math.abs((b-a) - frameToSeconds(y-x,project.fps)) > tolerance) error('DURATION_MISMATCH',p,'source and timeline durations differ by more than half a frame at speed 1');
      }
      if (trackName === 'music') {
        if (!isObject(clip.rights) || !['confirmed','restricted','unknown'].includes(clip.rights.status)) {
          error('MUSIC_RIGHTS',`${p}.rights`,'rights.status must be confirmed, restricted, or unknown');
        } else if (clip.rights.status !== 'confirmed') warn('RIGHTS_UNCONFIRMED',`${p}.rights`,'verify music rights for the intended use before export or publication');
        else warn('RIGHTS_NOT_VERIFIED',`${p}.rights`,'the declared authorization was not independently verified');
        if (clip.beats !== undefined) {
          if (!Array.isArray(clip.beats)) error('BEATS',`${p}.beats`,'beats must be an array of source timestamps');
          else {
            let prior = -Infinity;
            clip.beats.forEach((beat,j) => {
              const t=beat?.source_seconds;
              if (!isObject(beat) || !finite(t) || t < 0 || (finite(duration) && t > duration) || t <= prior) error('BEAT',`${p}.beats[${j}]`,'beats must be strictly increasing and within source duration');
              if (finite(t)) prior=t;
            });
          }
        }
      }
    }
    spans.sort((a,b)=>a.start-b.start || a.end-b.end);
    let cursor=0;
    for (const span of spans) {
      const p=`${trackPath}[${span.index}]`;
      if (span.start < cursor) error('TRACK_OVERLAP',p,'overlap is not supported on one track');
      if (span.start > cursor) (trackName === 'video' ? error : warn)('TRACK_GAP',p,`${trackName} track has a gap before this clip`);
      cursor=Math.max(cursor,span.end);
    }
    if (natural(project.duration_frames) && spans.length && cursor < project.duration_frames) (trackName === 'video' ? error : warn)('TRACK_GAP',trackPath,`${trackName} track ends before project duration`);
  }
  return {valid:errors.length===0,errors,warnings,project:errors.length ? null : project};
}

/**
 * Map a measured/manual beat in source music time to project time. The beat
 * must lie in the clip's half-open source range; returns null otherwise.
 * Result carries both exact time and nearest frame; if rounding lands outside
 * the clip, frame is null instead of silently snapping to a different boundary.
 * Does not create, infer, or label beat values as verified.
 */
export function mapMusicBeatToTimeline(project, musicClipId, sourceSeconds) {
  const result = validateEditProject(project);
  if (!result.valid) throw new TypeError('invalid edit project');
  if (!nonempty(musicClipId) || !finite(sourceSeconds)) throw new TypeError('music clip id and finite source beat are required');
  const clip=result.project.tracks.music.find(c=>c.id===musicClipId);
  if (!clip) throw new RangeError('music clip not found');
  if (sourceSeconds < clip.source_in_seconds || sourceSeconds >= clip.source_out_seconds) return null;
  const exactSeconds=frameToSeconds(clip.timeline_start_frame,result.project.fps)+(sourceSeconds-clip.source_in_seconds);
  const nearestFrame=quantizeSecondsToFrame(exactSeconds,result.project.fps);
  const inBounds=nearestFrame >= clip.timeline_start_frame && nearestFrame < clip.timeline_end_frame;
  return {
    clip_id:clip.id, source_seconds:sourceSeconds, timeline_seconds:exactSeconds,
    timeline_frame:inBounds ? nearestFrame : null,
    quantization_error_seconds:inBounds ? frameToSeconds(nearestFrame,result.project.fps)-exactSeconds : null
  };
}
