#!/usr/bin/env python3
"""Build a native Premiere Pro .prproj from a Media Center project manifest.

This optional bridge uses the MIT-licensed py-premiere package. It only writes
the requested project file; source media is read by Premiere, never modified.
"""
import json
import os
import pathlib
import sys

try:
    import py_premiere
    from py_premiere.models import project as pr_project
    from py_premiere.models import media_import
    from py_premiere.models.time import Time
except Exception as exc:  # pragma: no cover - runtime environment
    print(f"PYPROJ_DEPENDENCY_ERROR: {exc}", file=sys.stderr)
    sys.exit(3)


# pathlib.Path.resolve() expands a mapped network drive (Z:) to its UNC
# target on Windows. Premiere/剪映 need the mapped drive letter here, so keep
# already-absolute paths unchanged.
_ORIGINAL_RESOLVE = pathlib.Path.resolve


def _resolve_preserving_drive(self, strict=False):
    if self.is_absolute():
        return self
    return _ORIGINAL_RESOLVE(self, strict=strict)


pathlib.Path.resolve = _resolve_preserving_drive


def fail(message):
    print(f"PYPROJ_ERROR: {message}", file=sys.stderr)
    sys.exit(2)


def main():
    if len(sys.argv) != 2:
        fail("usage: prproj_builder.py <manifest.json>")
    manifest_path = sys.argv[1]
    with open(manifest_path, "r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    title = str(manifest.get("title") or "Media Center Project")[:200]
    fps = manifest.get("fps") or {"num": 25, "den": 1}
    num, den = int(fps["num"]), int(fps["den"])
    rate = num / den

    # py-premiere only ships timecode formats for a few rates. Add the exact
    # frame ticks for the project rate and common source rates; source clips
    # can be 59.94 even when the sequence is 29.97.
    for common_num, common_den in [(24000, 1001), (25, 1), (30000, 1001), (50, 1), (60000, 1001)]:
        try:
            frame_ticks = int(pr_project.TICKS_PER_SECOND * common_den / common_num)
            pr_project.TIMECODE_FORMATS.setdefault((frame_ticks, False), 101)
            pr_project.TIMECODE_FORMATS.setdefault((frame_ticks, True), 104)
        except Exception:
            pass

    # Projects and media can live on different drives/UNC shares. Premiere
    # accepts absolute paths in RelativePath, so do not compute a cross-drive
    # relative path here.
    media_import.os.path.relpath = lambda path, start: os.path.abspath(path)

    canvas = manifest.get("canvas") or {"width": 1920, "height": 1080}
    width, height = int(canvas.get("width") or 1920), int(canvas.get("height") or 1080)
    rate_name = {23.976: "23976", 25: "25", 29.97: "2997", 50: "50", 59.94: "5994"}.get(round(rate, 3))
    if rate_name is None:
        rate_name = "2997" if rate > 27 else "25"
    if width > height and width >= 3000:
        preset = f"2160p{rate_name}"
    elif width < height:
        preset = "portrait1080p30"
    else:
        preset = f"1080p{rate_name}"

    app = py_premiere.new()
    project = app.project
    sequence = project.add_sequence(title, preset)

    video_items = {}
    for clip in manifest.get("videos", []):
        source = clip["path"]
        if source not in video_items:
            imported = project.import_files([source])
            if not imported:
                fail(f"could not import video: {os.path.basename(source)}")
            video_items[source] = imported[0]
        item = video_items[source]
        start = Time.from_seconds(float(clip.get("timeline_start") or 0))
        source_in = Time.from_seconds(float(clip.get("source_in") or 0))
        source_out = Time.from_seconds(float(clip.get("source_out") or 0))
        trimmed_duration = Time.from_seconds(max(0.0, float(clip.get("source_out") or 0) - float(clip.get("source_in") or 0)))
        has_audio = bool(clip.get("has_audio")) and manifest.get("include_source_audio", True)
        if has_audio:
            video, audio = sequence.add_linked_clip(item, start, 0, 0)
            video.in_point = source_in
            video.out_point = source_out
            video.start = start
            video.end = Time.from_seconds(start.seconds + trimmed_duration.seconds)
            audio.in_point = source_in
            audio.out_point = source_out
            audio.start = start
            audio.end = Time.from_seconds(start.seconds + trimmed_duration.seconds)
        else:
            video = sequence.video_tracks[0].add_clip(item, start)
            video.in_point = source_in
            video.out_point = source_out
            video.start = start
            video.end = Time.from_seconds(start.seconds + trimmed_duration.seconds)

    for clip in manifest.get("music", []):
        imported = project.import_files([clip["path"]])
        if not imported:
            fail(f"could not import music: {os.path.basename(clip['path'])}")
        track = sequence.audio_tracks[1] if len(sequence.audio_tracks) > 1 else sequence.audio_tracks[0]
        start = Time.from_seconds(float(clip.get("timeline_start") or 0))
        source_in = Time.from_seconds(float(clip.get("source_in") or 0))
        source_out = Time.from_seconds(float(clip.get("source_out") or 0))
        trimmed_duration = Time.from_seconds(max(0.0, float(clip.get("source_out") or 0) - float(clip.get("source_in") or 0)))
        audio = track.add_clip(imported[0], start)
        audio.in_point = source_in
        audio.out_point = source_out
        audio.start = start
        audio.end = Time.from_seconds(start.seconds + trimmed_duration.seconds)

    out_path = manifest["output_path"]
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    project.save(out_path)
    print(json.dumps({
        "output_path": out_path,
        "sequence": title,
        "preset": preset,
        "video_clips": len(manifest.get("videos", [])),
        "music_clips": len(manifest.get("music", []))
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
