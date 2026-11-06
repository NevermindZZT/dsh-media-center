// Recording metadata only: file birth/modify/import times are not capture times.
export function extractCaptureTime(meta = {}) {
  const video = (meta.streams || []).find(stream => stream.codec_type === 'video');
  const scopes = [['format', meta.format?.tags], ['video', video?.tags]];
  const tagNames = ['com.apple.quicktime.creationdate', 'creation_time', 'date'];
  for (const tag of tagNames) {
    for (const [scope, tags] of scopes) {
      const value = tags?.[tag];
      if (typeof value !== 'string') continue;
      const raw = value.trim();
      // Require a complete date and clock time. Reject ffprobe zero/sentinel dates.
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i);
      if (!match) continue;
      const [, year, month, day, hour, minute, second, fraction = '', zone = ''] = match;
      const y = Number(year), m = Number(month), d = Number(day);
      if (y < 1970 || m < 1 || m > 12 || d < 1 ||
          d > new Date(Date.UTC(y, m, 0)).getUTCDate() ||
          Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) continue;
      const normalized = `${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${zone}`;
      // Preserve zone-less camera wall times rather than inventing a timezone.
      let capturedAt = normalized;
      if (zone) {
        const millis = Date.parse(normalized);
        if (!Number.isFinite(millis)) continue;
        capturedAt = new Date(millis).toISOString();
      }
      return { captured_at: capturedAt, captured_at_source: `metadata:${scope}.${tag}` };
    }
  }
  return { captured_at: null, captured_at_source: 'unknown' };
}
