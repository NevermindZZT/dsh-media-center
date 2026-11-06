import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const CELL_WIDTH = 320;
const CELL_HEIGHT = 180;
const TIMEOUT_MS = 120000;
const NO_FRAMES = 'No source frames exist within the shot interval';

// Showinfo is consumed incrementally: memory does not grow with frame count or
// duration. Input timestamps are interpreted identically to the render pass.
function findLastFrame({ ffmpeg, filePath, start, end, timeout }) {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn(ffmpeg, [
        '-hide_banner', '-nostdin', '-loglevel', 'info', '-i', filePath,
        '-vf', `trim=start=${start}:end=${end},showinfo@probe`,
        '-an', '-f', 'null', '-'
      ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (error) { reject(error); return; }
    let pending = '';
    let timeBase = null;
    let lastPts = null;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; proc.kill(); }, timeout);
    const consume = (line) => {
      if (!/\[showinfo@probe\s+@[^\]]*\]/i.test(line)) return;
      const base = line.match(/config in time_base:\s*(-?\d+)\/(\d+)/i);
      if (base) timeBase = [Number(base[1]), Number(base[2])];
      const frame = line.match(/\bn:\s*\d+\s+.*?\bpts:\s*(-?\d+)/i);
      if (frame) {
        const pts = Number(frame[1]);
        lastPts = lastPts === null ? pts : Math.max(lastPts, pts);
      }
    };
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', chunk => {
      pending += chunk;
      let newline;
      while ((newline = pending.indexOf('\n')) !== -1) {
        consume(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
      }
      // No valid showinfo line approaches this size; cap malformed input/logs.
      if (pending.length > 65536) pending = pending.slice(-65536);
    });
    proc.once('error', error => { clearTimeout(timer); reject(error); });
    proc.once('close', code => {
      clearTimeout(timer);
      consume(pending);
      if (timedOut || code !== 0) { reject(new Error('FFmpeg frame probe failed')); return; }
      if (lastPts === null) { reject(new Error(NO_FRAMES)); return; }
      if (!Number.isSafeInteger(lastPts) || !timeBase || !Number.isSafeInteger(timeBase[0]) ||
          !Number.isSafeInteger(timeBase[1]) || timeBase[1] <= 0) {
        reject(new Error('Invalid frame timestamps')); return;
      }
      const time = lastPts * timeBase[0] / timeBase[1];
      if (!Number.isFinite(time) || time < start || time >= end) {
        reject(new Error('Invalid frame timestamps')); return;
      }
      resolve({ pts: lastPts, time });
    });
  });
}

/**
 * Generate a timestamped contact sheet for an absolute, half-open video interval.
 *
 * `sample_times` contains the actual presentation timestamps reported by FFmpeg,
 * in left-to-right/top-to-bottom order, as seconds from the video start. Multiple
 * cells can contain the same source frame when the input frame rate is low.
 * `outputDir` must be the caller's plugin-owned generated-cache directory.
 * The source video is only opened by FFmpeg for reading; it is never modified.
 *
 * @param {{video: {file_path: string, duration: number}, shot: {start_time: number, end_time: number}, outputDir: string, ffmpeg: string}} options
 * @returns {Promise<{storyboard_path: string, sample_times: number[]}>}
 */
export async function generateShotStoryboard({ video, shot, outputDir, ffmpeg } = {}) {
  const start = shot?.start_time;
  const end = shot?.end_time;
  const duration = video?.duration;
  if (!video || typeof video.file_path !== 'string' || !video.file_path.trim() ||
      typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 ||
      typeof start !== 'number' || !Number.isFinite(start) ||
      typeof end !== 'number' || !Number.isFinite(end) ||
      start < 0 || end <= start || end > duration ||
      typeof outputDir !== 'string' || !outputDir.trim() ||
      typeof ffmpeg !== 'string' || !ffmpeg.trim()) {
    throw new Error('Invalid storyboard input: expected a video, positive duration, valid half-open shot interval, cache directory and ffmpeg executable');
  }

  // Equally spaced cell midpoints avoid targeting the exclusive endpoint.
  const length = end - start;
  const count = length < 2 ? 4 : length < 8 ? 9 : 16;
  const columns = Math.sqrt(count);
  const targets = Array.from({ length: count }, (_, i) => start + length * (i + 0.5) / count);
  if (targets.some(t => !Number.isFinite(t) || t < start || t >= end)) {
    throw new Error('Invalid storyboard input: shot interval is too small to sample');
  }

  // A freshly-created private subdirectory prevents name collisions, including
  // concurrent calls. -n refuses to overwrite even inside the new directory.
  let ownedDir;
  try {
    await fs.mkdir(outputDir, { recursive: true });
    const cacheRoot = await fs.realpath(outputDir);
    ownedDir = await fs.mkdtemp(path.join(cacheRoot, 'shot-storyboard-'));
    const storyboardPath = path.join(ownedDir, 'storyboard.jpg');
    const fontCandidates = process.platform === 'win32'
      ? [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf')]
      : process.platform === 'darwin'
        ? ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']
        : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'];
    let fontFile = null;
    for (const candidate of fontCandidates) {
      try { await fs.access(candidate); fontFile = candidate; break; } catch {}
    }
    const fontOption = fontFile ? `fontfile='${fontFile.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\\\''")}':` : '';

    const deadline = Date.now() + TIMEOUT_MS;
    const lastFrame = await findLastFrame({ ffmpeg, filePath: video.file_path, start, end, timeout: TIMEOUT_MS });
    const branches = targets.map((target, i) => {
      // A target beyond the last frame reuses that exact frame by its integer PTS.
      // This handles low frame rates and half-open intervals without inventing PTS.
      const select = target >= lastFrame.time - 1e-9
        ? `gte(pts\\,${lastFrame.pts})` : `gte(t\\,${target})`;
      // Restrict before selection, capture exactly one real frame per cell, then
      // reset each branch's clock for xstack. drawtext runs before setpts so its
      // burned-in timestamp and showinfo both describe the same source frame.
      return `[in${i}]trim=start=${start}:end=${end},select=${select},trim=end_frame=1,showinfo@cell${i},scale=${CELL_WIDTH}:${CELL_HEIGHT}:force_original_aspect_ratio=decrease,pad=${CELL_WIDTH}:${CELL_HEIGHT}:(ow-iw)/2:(oh-ih)/2,drawtext=${fontOption}text='%{pts\\:hms}':x=6:y=h-th-6:fontsize=15:fontcolor=white:box=1:boxcolor=black@0.8:boxborderw=4,setpts=PTS-STARTPTS[out${i}]`;
    });
    const layout = Array.from({ length: count }, (_, i) => `${(i % columns) * CELL_WIDTH}_${Math.floor(i / columns) * CELL_HEIGHT}`).join('|');
    const filter = `[0:v:0]split=${count}${targets.map((_, i) => `[in${i}]`).join('')};${branches.join(';')};${targets.map((_, i) => `[out${i}]`).join('')}xstack=inputs=${count}:layout=${layout}[sheet]`;
    const args = ['-hide_banner', '-nostdin', '-loglevel', 'info', '-i', video.file_path,
      '-filter_complex', filter, '-map', '[sheet]', '-frames:v', '1', '-an', '-n', storyboardPath];
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('FFmpeg storyboard timeout');
    const { stderr } = await execFileAsync(ffmpeg, args, { maxBuffer: 8 * 1024 * 1024, timeout: remaining, windowsHide: true });

    const samplePts = Array(count).fill(null);
    const timeBases = Array(count).fill(null);
    for (const line of stderr.split(/\r?\n/)) {
      const named = line.match(/\[showinfo@cell(\d+)\s+@[^\]]*\]/i);
      if (!named) continue;
      const index = Number(named[1]);
      if (index < 0 || index >= count) continue;
      const timeBase = line.match(/config in time_base:\s*(-?\d+)\/(\d+)/i);
      if (timeBase) timeBases[index] = [Number(timeBase[1]), Number(timeBase[2])];
      const frame = line.match(/\bn:\s*0\s+.*?\bpts:\s*(-?\d+)/i);
      if (frame && samplePts[index] === null) samplePts[index] = Number(frame[1]);
    }
    const sampleTimes = samplePts.map((pts, i) => {
      const base = timeBases[i];
      return Number.isSafeInteger(pts) && base && Number.isSafeInteger(base[0]) &&
        Number.isSafeInteger(base[1]) && base[1] > 0 ? pts * base[0] / base[1] : null;
    });
    if (sampleTimes.some(t => t === null || !Number.isFinite(t) || t < start || t >= end)) {
      throw new Error('Unable to extract all requested frames within the shot interval');
    }
    const stat = await fs.stat(storyboardPath);
    if (!stat.isFile() || !stat.size) throw new Error('Storyboard image was not created');
    return { storyboard_path: storyboardPath, sample_times: sampleTimes };
  } catch (error) {
    // Only the fresh private output directory belongs to this invocation. Never
    // use a database path or a user-supplied source path as a deletion target.
    if (ownedDir) {
      try { await fs.rm(ownedDir, { recursive: true, force: true }); }
      catch { throw new Error('Failed to generate shot storyboard and remove temporary output'); }
    }
    // FFmpeg stderr and paths can contain private metadata; do not expose them.
    if (error?.message === NO_FRAMES || error?.message === 'Unable to extract all requested frames within the shot interval') throw error;
    throw new Error('Failed to generate shot storyboard; check the video, cache directory, FFmpeg and drawtext support');
  }
}
