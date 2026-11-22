import fs from 'node:fs';
import path from 'node:path';

/**
 * Export a validated EditProject (v1) as an NLE interchange document.
 * Source paths are resolved from catalog IDs; project JSON paths are never trusted.
 * Exporting is read-only for media: only the generated document is written.
 */
export class ProjectExporter {
  constructor(db) {
    this.db = db;
    this.exportsDir = db.exportsDir;
  }

  resolveProject(project) {
    const videos = new Map();
    const musics = new Map();
    for (const clip of project.tracks.video) {
      const id = clip.source?.id;
      if (!id || videos.has(id)) continue;
      const video = this.db.getVideoById(id);
      if (!video || typeof video.file_path !== 'string' || !fs.existsSync(video.file_path)) {
        throw new Error(`视频素材不可用：${clip.source?.id || '未知'}`);
      }
      videos.set(id, {
        id, file_path: video.file_path, file_name: video.file_name,
        duration_seconds: Number(clip.source?.duration_seconds) || Number(video.duration) || 0,
        width: Number(video.width) || project.canvas?.width || 1920,
        height: Number(video.height) || project.canvas?.height || 1080,
        audio_channels: Number(video.audio_channels) || 0
      });
    }
    for (const clip of project.tracks.music) {
      const id = clip.source?.id;
      if (!id || musics.has(id)) continue;
      const music = this.db.db.prepare('SELECT id,file_path,duration,title FROM local_music_catalog WHERE id = ?').get(id);
      if (!music || !music.file_path || !fs.existsSync(music.file_path)) throw new Error(`音乐素材不可用：${id}`);
      musics.set(id, {
        id, file_path: music.file_path,
        file_name: path.basename(music.file_path), title: music.title || path.basename(music.file_path),
        duration_seconds: Number(clip.source?.duration_seconds) || Number(music.duration) || 0
      });
    }
    return { videos, musics };
  }

  exportProject(project, { format = 'fcpxml', includeSourceAudio = true } = {}) {
    if (!project || !Array.isArray(project.tracks?.video)) throw new Error('项目时间线无效');
    if (!['fcpxml', 'premiere_xml'].includes(format)) throw new Error('不支持的导出格式');
    const assets = this.resolveProject(project);
    const warnings = [];
    if (includeSourceAudio && [...assets.videos.values()].some(v => !v.audio_channels)) {
      warnings.push('部分视频未记录音轨信息；导出仍会声明音频，实际是否有声由源文件决定。');
    }
    const content = format === 'fcpxml'
      ? this.buildFCPXML(project, assets, { includeSourceAudio })
      : this.buildPremiereXML(project, assets, { includeSourceAudio });
    const safeName = String(project.title || 'project').replace(/[/\\:*?"<>|]/g, '_').slice(0, 100) || 'project';
    const outFileName = `${safeName}_${Date.now()}.${format === 'fcpxml' ? 'fcpxml' : 'xml'}`;
    const outPath = path.join(this.exportsDir, outFileName);
    fs.writeFileSync(outPath, content, 'utf8');
    const totalSeconds = project.duration_frames * project.fps.den / project.fps.num;
    return {
      format, file_path: outPath, file_name: outFileName,
      clip_count: project.tracks.video.length,
      total_duration: Math.round(totalSeconds * 100) / 100,
      warnings
    };
  }

  secondsToFrame(seconds, fps) {
    return Math.max(0, Math.round(Number(seconds) * fps.num / fps.den));
  }

  frameTime(frames, fps) {
    return `${frames * fps.den}/${fps.num}s`;
  }

  secondsTime(seconds, fps) {
    return this.frameTime(this.secondsToFrame(seconds, fps), fps);
  }

  fileUrl(filePath, localhost = false) {
    const normalized = String(filePath).replace(/\\/g, '/');
    return `${localhost ? 'file://localhost/' : 'file:///'}${normalized.replace(/^\/+/, '')}`;
  }

  formatName(fps, width, height) {
    const rate = Math.round(fps.num / fps.den * 100) / 100;
    const rateName = String(rate).replace('.', '');
    return `FFVideoFormat${height}p${rateName}`;
  }

  buildFCPXML(project, assets, { includeSourceAudio }) {
    const fps = project.fps;
    const width = project.canvas?.width || 1920;
    const height = project.canvas?.height || 1080;
    const resources = [];
    const assetsXml = [];
    let index = 2;
    const formatId = 'r1';
    resources.push(`    <format id="${formatId}" name="${this.escapeXml(this.formatName(fps, width, height))}" frameDuration="${fps.den}/${fps.num}s" width="${width}" height="${height}"/>`);

    const videoResource = new Map();
    for (const asset of assets.videos.values()) {
      const id = `r${index++}`;
      videoResource.set(asset.id, id);
      const duration = this.secondsTime(asset.duration_seconds, fps);
      const audio = includeSourceAudio && asset.audio_channels > 0
        ? ` audioSources="1" audioChannels="${Math.min(8, asset.audio_channels)}"` : '';
      assetsXml.push(`    <asset id="${id}" name="${this.escapeXml(asset.file_name)}" start="0s" duration="${duration}" format="${formatId}" hasVideo="1"${audio}>
      <media-rep kind="original-media" src="${this.escapeXml(this.fileUrl(asset.file_path))}"/>
    </asset>`);
    }
    const musicResource = new Map();
    for (const asset of assets.musics.values()) {
      const id = `r${index++}`;
      musicResource.set(asset.id, id);
      assetsXml.push(`    <asset id="${id}" name="${this.escapeXml(asset.title)}" start="0s" duration="${this.secondsTime(asset.duration_seconds, fps)}" hasAudio="1" audioSources="1" audioChannels="2">
      <media-rep kind="original-media" src="${this.escapeXml(this.fileUrl(asset.file_path))}"/>
    </asset>`);
    }

    const clips = [];
    for (const clip of project.tracks.video) {
      const ref = videoResource.get(clip.source.id);
      if (!ref) continue;
      const offset = this.frameTime(clip.timeline_start_frame, fps);
      const duration = this.frameTime(clip.timeline_end_frame - clip.timeline_start_frame, fps);
      const start = this.secondsTime(clip.source_in_seconds, fps);
      const audio = includeSourceAudio && assets.videos.get(clip.source.id)?.audio_channels > 0
        ? `\n        <audio ref="${ref}" offset="${start}" duration="${duration}" role="dialogue"/>` : '';
      clips.push(`      <clip name="${this.escapeXml(clip.id)}" offset="${offset}" duration="${duration}" start="${start}" tcFormat="NDF">
        <video ref="${ref}" offset="${start}" duration="${duration}"/>${audio}
      </clip>`);
    }
    for (const clip of project.tracks.music) {
      const ref = musicResource.get(clip.source.id);
      if (!ref) continue;
      const offset = this.frameTime(clip.timeline_start_frame, fps);
      const duration = this.frameTime(clip.timeline_end_frame - clip.timeline_start_frame, fps);
      const start = this.secondsTime(clip.source_in_seconds, fps);
      clips.push(`      <clip name="${this.escapeXml(clip.id)}" lane="1" offset="${offset}" duration="${duration}" start="${start}" tcFormat="NDF">
        <audio ref="${ref}" offset="${start}" duration="${duration}" role="music"/>
      </clip>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
${resources.join('\n')}
${assetsXml.join('\n')}
  </resources>
  <library>
    <event name="Media Center">
      <project name="${this.escapeXml(project.title)}">
        <sequence format="${formatId}" duration="${this.frameTime(project.duration_frames, fps)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${clips.join('\n')}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
  }

  buildPremiereXML(project, assets, { includeSourceAudio }) {
    const fps = project.fps;
    const timebase = Math.round(fps.num / fps.den);
    const ntsc = Math.abs(fps.num / fps.den - timebase) > 1e-6 ? 'TRUE' : 'FALSE';
    const width = project.canvas?.width || 1920;
    const height = project.canvas?.height || 1080;
    const rate = `<rate><timebase>${timebase}</timebase><ntsc>${ntsc}</ntsc></rate>`;
    const fileIds = new Map();
    let fileIndex = 1;
    const fileXml = (asset, hasVideo) => {
      const key = `${hasVideo ? 'v' : 'a'}:${asset.id}`;
      if (!fileIds.has(key)) fileIds.set(key, `file-${fileIndex++}`);
      return `          <file id="${fileIds.get(key)}">
            <name>${this.escapeXml(asset.file_name || asset.title)}</name>
            <pathurl>${this.escapeXml(this.fileUrl(asset.file_path, true))}</pathurl>
            ${rate}
            <duration>${Math.round(asset.duration_seconds * fps.num / fps.den)}</duration>
            <media>
              ${hasVideo ? `<video><samplecharacteristics>${rate}<width>${asset.width || width}</width><height>${asset.height || height}</height><anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio></samplecharacteristics></video>` : ''}
              <audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics><channelcount>${Math.max(1, Number(asset.audio_channels) || 2)}</channelcount></audio>
            </media>
          </file>`;
    };
    const videoItems = [];
    for (const clip of project.tracks.video) {
      const asset = assets.videos.get(clip.source.id);
      if (!asset) continue;
      const start = clip.timeline_start_frame;
      const end = clip.timeline_end_frame;
      const inFrame = Math.round(clip.source_in_seconds * fps.num / fps.den);
      const outFrame = Math.round(clip.source_out_seconds * fps.num / fps.den);
      videoItems.push(`        <clipitem id="clipitem-v-${clip.id}">
          <name>${this.escapeXml(asset.file_name)}</name>
          <duration>${Math.round(asset.duration_seconds * fps.num / fps.den)}</duration>
          ${rate}
          <start>${start}</start><end>${end}</end><in>${inFrame}</in><out>${outFrame}</out>
${fileXml(asset, true)}
        </clipitem>`);
    }
    const audioTracks = [];
    if (includeSourceAudio) {
      const items = [];
      for (const clip of project.tracks.video) {
        const asset = assets.videos.get(clip.source.id);
        if (!asset || !asset.audio_channels) continue;
        items.push(`        <clipitem id="clipitem-va-${clip.id}">
          <name>${this.escapeXml(asset.file_name)}</name>
          <duration>${Math.round(asset.duration_seconds * fps.num / fps.den)}</duration>
          ${rate}
          <start>${clip.timeline_start_frame}</start><end>${clip.timeline_end_frame}</end><in>${Math.round(clip.source_in_seconds * fps.num / fps.den)}</in><out>${Math.round(clip.source_out_seconds * fps.num / fps.den)}</out>
          <sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>
${fileXml(asset, false)}
        </clipitem>`);
      }
      if (items.length) audioTracks.push(`      <track>${items.join('\n')}</track>`);
    }
    for (const clip of project.tracks.music) {
      const asset = assets.musics.get(clip.source.id);
      if (!asset) continue;
      audioTracks.push(`      <track>
        <clipitem id="clipitem-a-${clip.id}">
          <name>${this.escapeXml(asset.title)}</name>
          <duration>${Math.round(asset.duration_seconds * fps.num / fps.den)}</duration>
          ${rate}
          <start>${clip.timeline_start_frame}</start><end>${clip.timeline_end_frame}</end><in>${Math.round(clip.source_in_seconds * fps.num / fps.den)}</in><out>${Math.round(clip.source_out_seconds * fps.num / fps.den)}</out>
          <sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>
${fileXml(asset, false)}
        </clipitem>
      </track>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${this.escapeXml(project.title)}</name>
    <duration>${project.duration_frames}</duration>
    ${rate}
    <media>
      <video>
        <format><samplecharacteristics>${rate}<width>${width}</width><height>${height}</height><anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio></samplecharacteristics></format>
        <track>
${videoItems.join('\n')}
        </track>
      </video>
      <audio>
${audioTracks.join('\n')}
      </audio>
    </media>
  </sequence>
</xmeml>
`;
  }

  escapeXml(unsafe) {
    return String(unsafe ?? '').replace(/[<>&'"]/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    })[c]);
  }
}
