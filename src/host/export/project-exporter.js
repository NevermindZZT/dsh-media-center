import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class ProjectExporter {
  constructor(db) {
    this.db = db;
    this.exportsDir = db.exportsDir;
  }

  // Convert seconds to Timecode HH:MM:SS:FF
  formatTimecode(seconds, fps = 30) {
    const totalFrames = Math.floor(seconds * fps);
    const ff = totalFrames % fps;
    const totalSeconds = Math.floor(seconds);
    const ss = totalSeconds % 60;
    const mm = Math.floor(totalSeconds / 60) % 60;
    const hh = Math.floor(totalSeconds / 3600);

    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
  }

  // Export to CMX 3600 EDL format
  exportEDL(sequenceName, clips, options = {}) {
    const fps = options.fps || 30;
    const lines = [
      `TITLE: ${sequenceName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`,
      'FCM: NON-DROP FRAME',
      ''
    ];

    let recordIn = 0;
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const sourceIn = Number(clip.in_point) || 0;
      const sourceOut = Number(clip.out_point) || (sourceIn + 5);
      const clipDuration = sourceOut - sourceIn;
      const recordOut = recordIn + clipDuration;

      const editNum = String(i + 1).padStart(3, '0');
      const srcInTc = this.formatTimecode(sourceIn, fps);
      const srcOutTc = this.formatTimecode(sourceOut, fps);
      const recInTc = this.formatTimecode(recordIn, fps);
      const recOutTc = this.formatTimecode(recordOut, fps);

      lines.push(`${editNum}  AX       V     C        ${srcInTc} ${srcOutTc} ${recInTc} ${recOutTc}`);
      lines.push(`* FROM CLIP NAME: ${clip.file_name || clip.video_id}`);
      if (clip.description) {
        lines.push(`* COMMENT: ${clip.description}`);
      }
      lines.push('');

      recordIn = recordOut;
    }

    const outFileName = `${sequenceName}_${Date.now()}.edl`;
    const outPath = path.join(this.exportsDir, outFileName);
    fs.writeFileSync(outPath, lines.join('\r\n'), 'utf8');

    return {
      format: 'edl',
      file_path: outPath,
      file_name: outFileName,
      clip_count: clips.length,
      total_duration: Math.round(recordIn * 100) / 100
    };
  }

  // Export to Final Cut Pro XML (FCPXML v1.9)
  exportFCPXML(sequenceName, clips, options = {}) {
    const fps = options.fps || 30;
    const frameRateStr = `${fps}s`;
    let recordIn = 0;

    // Collect resources
    const resourceMap = new Map();
    let resIndex = 1;

    for (const c of clips) {
      if (!resourceMap.has(c.file_path)) {
        resourceMap.set(c.file_path, {
          id: `r${resIndex++}`,
          name: c.file_name || path.basename(c.file_path),
          path: c.file_path,
          duration: c.file_duration || 3600
        });
      }
    }

    let resourcesXml = `    <format id="r0" name="FFVideoFormat1080p${fps}" frameDuration="1/${fps}s" width="1920" height="1080"/>\n`;
    for (const res of resourceMap.values()) {
      const fileUrl = 'file:///' + res.path.replace(/\\/g, '/');
      resourcesXml += `    <asset id="${res.id}" name="${this.escapeXml(res.name)}" src="${this.escapeXml(fileUrl)}" duration="${Math.floor(res.duration * fps)}/${fps}s" hasVideo="1" hasAudio="1"/>\n`;
    }

    let spineClipsXml = '';
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const res = resourceMap.get(clip.file_path);
      const sourceIn = Number(clip.in_point) || 0;
      const sourceOut = Number(clip.out_point) || (sourceIn + 5);
      const duration = sourceOut - sourceIn;

      const offsetFrames = Math.floor(recordIn * fps);
      const durationFrames = Math.floor(duration * fps);
      const startFrames = Math.floor(sourceIn * fps);

      spineClipsXml += `            <clip name="${this.escapeXml(clip.file_name || 'Clip')}" offset="${offsetFrames}/${fps}s" duration="${durationFrames}/${fps}s" start="${startFrames}/${fps}s">\n`;
      spineClipsXml += `                <video ref="${res.id}" offset="${startFrames}/${fps}s" duration="${durationFrames}/${fps}s"/>\n`;
      spineClipsXml += `            </clip>\n`;

      recordIn += duration;
    }

    const totalDurationFrames = Math.floor(recordIn * fps);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
${resourcesXml}  </resources>
  <library>
    <event name="AI Edit Event">
      <project name="${this.escapeXml(sequenceName)}">
        <sequence format="r0" duration="${totalDurationFrames}/${fps}s">
          <spine>
${spineClipsXml}          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;

    const outFileName = `${sequenceName}_${Date.now()}.fcpxml`;
    const outPath = path.join(this.exportsDir, outFileName);
    fs.writeFileSync(outPath, xml, 'utf8');

    return {
      format: 'fcpxml',
      file_path: outPath,
      file_name: outFileName,
      clip_count: clips.length,
      total_duration: Math.round(recordIn * 100) / 100
    };
  }

  // Export to JianYing / CapCut Draft Folder
  exportJianYingDraft(sequenceName, clips, options = {}) {
    const fps = options.fps || 30;
    const safeName = sequenceName.replace(/[/\\:*?"<>|]/g, '_');
    const draftFolder = path.join(this.exportsDir, `jianying_${safeName}_${Date.now()}`);
    fs.mkdirSync(draftFolder, { recursive: true });

    let recordInUs = 0; // JianYing uses microseconds (1s = 1,000,000 us)
    const materialsVideos = [];
    const videoSegments = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const matId = 'mat_vid_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const segId = 'seg_vid_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

      const sourceInSec = Number(clip.in_point) || 0;
      const sourceOutSec = Number(clip.out_point) || (sourceInSec + 5);
      const durationSec = sourceOutSec - sourceInSec;

      const sourceInUs = Math.floor(sourceInSec * 1000000);
      const durationUs = Math.floor(durationSec * 1000000);

      materialsVideos.push({
        id: matId,
        path: clip.file_path,
        type: 'video',
        duration: Math.floor((clip.file_duration || 3600) * 1000000),
        width: clip.width || 1920,
        height: clip.height || 1080
      });

      videoSegments.push({
        id: segId,
        material_id: matId,
        source_timerange: {
          start: sourceInUs,
          duration: durationUs
        },
        target_timerange: {
          start: recordInUs,
          duration: durationUs
        },
        volume: 1.0,
        speed: 1.0
      });

      recordInUs += durationUs;
    }

    const draftContent = {
      canvas_config: { width: 1920, height: 1080, ratio: '16:9' },
      duration: recordInUs,
      fps: fps,
      materials: {
        videos: materialsVideos,
        audios: [],
        texts: []
      },
      tracks: [
        {
          id: 'track_video_main',
          type: 'video',
          segments: videoSegments
        }
      ]
    };

    const draftMeta = {
      draft_id: crypto.randomUUID(),
      draft_name: sequenceName,
      draft_timeline_materials_size: clips.length,
      tm_draft_create: Date.now(),
      tm_draft_modified: Date.now(),
      draft_root_path: draftFolder
    };

    fs.writeFileSync(path.join(draftFolder, 'draft_content.json'), JSON.stringify(draftContent, null, 2), 'utf8');
    fs.writeFileSync(path.join(draftFolder, 'draft_meta_info.json'), JSON.stringify(draftMeta, null, 2), 'utf8');

    return {
      format: 'jianying',
      draft_folder: draftFolder,
      file_path: path.join(draftFolder, 'draft_content.json'),
      clip_count: clips.length,
      total_duration: Math.round((recordInUs / 1000000) * 100) / 100
    };
  }

  escapeXml(unsafe) {
    return String(unsafe || '').replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }
}
