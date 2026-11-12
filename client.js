window.__ModuleLoader__.load({
  id: '@local/dsh-video-manager',
  factory(require) {
    const React = require('react');
    const { useState, useEffect, useRef, useMemo, createElement: h } = React;

    // --- Responsive Hook for Mobile Screen Detection ---
    function useIsMobile(breakpoint = 840) {
      const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
      );
      useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      }, [breakpoint]);
      return isMobile;
    }

    // --- Official Vector SVG Icons (No Emojis) ---
    const Icon = {
      clapperboard: (props) => h('svg', {
        width: props?.size || 16, height: props?.size || 16, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }),
        h('line', { x1: 2, y1: 8, x2: 22, y2: 8 }),
        h('line', { x1: 2, y1: 16, x2: 22, y2: 16 }),
        h('line', { x1: 6, y1: 4, x2: 6, y2: 8 }),
        h('line', { x1: 10, y1: 4, x2: 10, y2: 8 }),
        h('line', { x1: 14, y1: 4, x2: 14, y2: 8 }),
        h('line', { x1: 18, y1: 4, x2: 18, y2: 8 }),
        h('polygon', { points: '10 10 15 12 10 14', fill: props?.color || 'currentColor', stroke: 'none' })
      ),
      folder: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' })
      ),
      folderPlus: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' }),
        h('line', { x1: 12, y1: 11, x2: 12, y2: 17 }),
        h('line', { x1: 9, y1: 14, x2: 15, y2: 14 })
      ),
      film: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('rect', { x: 2, y: 2, width: 20, height: 20, rx: 2.18 }),
        h('line', { x1: 7, y1: 2, x2: 7, y2: 22 }),
        h('line', { x1: 17, y1: 2, x2: 17, y2: 22 }),
        h('line', { x1: 2, y1: 12, x2: 22, y2: 12 }),
        h('line', { x1: 2, y1: 7, x2: 7, y2: 7 }),
        h('line', { x1: 2, y1: 17, x2: 7, y2: 17 }),
        h('line', { x1: 17, y1: 17, x2: 22, y2: 17 }),
        h('line', { x1: 17, y1: 7, x2: 22, y2: 7 })
      ),
      play: (props) => h('svg', {
        width: props?.size || 12, height: props?.size || 12, viewBox: '0 0 24 24',
        fill: props?.fill || 'currentColor', stroke: props?.color || 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('polygon', { points: '5 3 19 12 5 21 5 3' })
      ),
      settings: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('circle', { cx: 12, cy: 12, r: 3 }),
        h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' })
      ),
      scissors: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('circle', { cx: 6, cy: 6, r: 3 }),
        h('circle', { cx: 6, cy: 18, r: 3 }),
        h('line', { x1: 20, y1: 4, x2: 8.12, y2: 15.88 }),
        h('line', { x1: 14.47, y1: 14.48, x2: 20, y2: 20 }),
        h('line', { x1: 8.12, y1: 8.12, x2: 12, y2: 12 })
      ),
      sparkles: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('path', { d: 'm12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z' }),
        h('path', { d: 'M5 3v4' }),
        h('path', { d: 'M19 17v4' }),
        h('path', { d: 'M3 5h4' }),
        h('path', { d: 'M17 19h4' })
      ),
      plus: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
        h('line', { x1: 5, y1: 12, x2: 19, y2: 12 })
      ),
      upload: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
        h('polyline', { points: '17 8 12 3 7 8' }),
        h('line', { x1: 12, y1: 3, x2: 12, y2: 15 })
      ),
      trash: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('polyline', { points: '3 6 5 6 21 6' }),
        h('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
        h('line', { x1: 10, y1: 11, x2: 10, y2: 17 }),
        h('line', { x1: 14, y1: 11, x2: 14, y2: 17 })
      ),
      move: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('path', { d: 'm5 9-3 3 3 3' }),
        h('path', { d: 'm9 5 3-3 3 3' }),
        h('path', { d: 'm15 19 3 3 3-3' }),
        h('path', { d: 'm19 9 3 3-3 3' }),
        h('line', { x1: 2, y1: 12, x2: 22, y2: 12 }),
        h('line', { x1: 12, y1: 2, x2: 12, y2: 22 })
      ),
      arrowUpDown: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('path', { d: 'm7 15 5 5 5-5' }),
        h('path', { d: 'm7 9 5-5 5 5' })
      ),
      clock: (props) => h('svg', {
        width: props?.size || 12, height: props?.size || 12, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('circle', { cx: 12, cy: 12, r: 10 }),
        h('polyline', { points: '12 6 12 12 16 14' })
      ),
      check: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('polyline', { points: '20 6 9 17 4 12' })
      ),
      arrowLeft: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('line', { x1: 19, y1: 12, x2: 5, y2: 12 }),
        h('polyline', { points: '12 19 5 12 12 5' })
      ),
      moreVertical: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('circle', { cx: 12, cy: 12, r: 1.5, fill: 'currentColor' }),
        h('circle', { cx: 12, cy: 5, r: 1.5, fill: 'currentColor' }),
        h('circle', { cx: 12, cy: 19, r: 1.5, fill: 'currentColor' })
      ),
      moreHorizontal: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('circle', { cx: 12, cy: 12, r: 1.5, fill: 'currentColor' }),
        h('circle', { cx: 5, cy: 12, r: 1.5, fill: 'currentColor' }),
        h('circle', { cx: 19, cy: 12, r: 1.5, fill: 'currentColor' })
      ),
      chevronDown: (props) => h('svg', {
        width: props?.size || 13, height: props?.size || 13, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('polyline', { points: '6 9 12 15 18 9' })
      ),
      chevronRight: (props) => h('svg', {
        width: props?.size || 13, height: props?.size || 13, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('polyline', { points: '9 18 15 12 9 6' })
      ),
      music: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('path', { d: 'M9 18V5l12-2v13' }),
        h('circle', { cx: 6, cy: 18, r: 3 }),
        h('circle', { cx: 18, cy: 16, r: 3 })
      ),
      volumeX: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }),
        h('line', { x1: 23, y1: 9, x2: 17, y2: 15 }),
        h('line', { x1: 17, y1: 9, x2: 23, y2: 15 })
      ),
      messageSquare: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
      ),
      hardDrive: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('line', { x1: 22, y1: 12, x2: 2, y2: 12 }),
        h('path', { d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }),
        h('line', { x1: 6, y1: 16, x2: 6.01, y2: 16 }),
        h('line', { x1: 10, y1: 16, x2: 10.01, y2: 16 })
      ),
      arrowUp: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('line', { x1: 12, y1: 19, x2: 12, y2: 5 }),
        h('polyline', { points: '5 12 12 5 19 12' })
      ),
      compass: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('circle', { cx: 12, cy: 12, r: 10 }),
        h('polygon', { points: '16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76' })
      ),
      edit: (props) => h('svg', {
        width: props?.size || 13, height: props?.size || 13, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
        h('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
      ),
      grid: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('rect', { x: 3, y: 3, width: 7, height: 7 }),
        h('rect', { x: 14, y: 3, width: 7, height: 7 }),
        h('rect', { x: 14, y: 14, width: 7, height: 7 }),
        h('rect', { x: 3, y: 14, width: 7, height: 7 })
      ),
      zap: (props) => h('svg', {
        width: props?.size || 12, height: props?.size || 12, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        h('polygon', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' })
      ),
      loader: (props) => h('svg', {
        width: props?.size || 14, height: props?.size || 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: props?.color || 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: {
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          animation: 'spin 1s linear infinite'
        }
      },
        h('style', null, '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'),
        h('path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' })
      )
    };

    // --- Format helpers ---
    function formatDuration(sec) {
      if (!sec) return '00:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function formatFileSize(bytes) {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    function formatDateTime(str, withSeconds = true) {
      if (!str) return '';
      const value = String(str).trim();
      // Zone-stamped metadata is an instant: render it in the viewer's local zone.
      if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '';
        const pad = (part) => String(part).padStart(2, '0');
        const local = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        return withSeconds ? `${local}:${pad(date.getSeconds())}` : local;
      }
      // A recording timestamp without a zone is camera wall time, not UTC.
      const wallTime = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
      if (!wallTime) return '';
      return `${wallTime[1]} ${wallTime[2]}${withSeconds ? `:${wallTime[3] || '00'}` : ''}`;
    }

    function captureTimePresentation(video, withSeconds = true) {
      const source = video?.captured_at_source;
      const time = /^(?:metadata:format\.|metadata:video\.)/.test(source || '')
        ? formatDateTime(video.captured_at, withSeconds)
        : '';
      if (time) {
        return { text: time, title: `拍摄时间: ${time}\n来源: ${source}` };
      }
      const text = source == null
        ? '拍摄时间待读取'
        : source === 'unavailable' ? '拍摄时间不可用' : '拍摄时间未知';
      return { text, title: text };
    }

    const SORT_STORAGE_KEY = 'dsh-video-manager.sortRule';
    const DEFAULT_SORT_RULE = 'captured_at_desc';
    const SORT_RULES = new Set([
      'captured_at_desc', 'captured_at_asc', 'created_at_desc', 'created_at_asc',
      'file_name_asc', 'file_name_desc', 'duration_desc', 'duration_asc'
    ]);
    const validateSortRule = (rule) => SORT_RULES.has(rule) ? rule : DEFAULT_SORT_RULE;

    const SHOT_ANALYSIS_FIELDS = [
      ['subject', '主体'], ['visual_description', '画面描述'], ['composition', '构图与光影'],
      ['shot_type', '景别'], ['camera_movement', '运镜'], ['quality_score', '评分'], ['tags', '标签']
    ];
    function shotAnalysisValue(value) {
      if (value === null || value === undefined || value === '') return '未提供';
      if (Array.isArray(value)) return value.length ? value.join('、') : '（空）';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }
    function shotRunBoundaryMatches(run, shot) {
      if (run?.start_time === null || run?.start_time === undefined || run?.end_time === null || run?.end_time === undefined) return false;
      const start = Number(run.start_time), end = Number(run.end_time);
      return Number.isFinite(start) && Number.isFinite(end) && start === Number(shot.start_time) && end === Number(shot.end_time);
    }

    // Local music and saved edit-project management only; AI planning happens in DSH chat.
    function EditingWorkbench({ onClose, isMobile, styles }) {
      const [items, setItems] = useState([]);
      const [musicId, setMusicId] = useState('');
      const [filePath, setFilePath] = useState('');
      const [musicBrowser, setMusicBrowser] = useState(null);
      const [showMusicBrowser, setShowMusicBrowser] = useState(false);
      const [title, setTitle] = useState('');
      const [sourceName, setSourceName] = useState('');
      const [licenseNote, setLicenseNote] = useState('');
      const [busy, setBusy] = useState('');
      const lockRef = useRef(false);
      const [error, setError] = useState('');
      const [notice, setNotice] = useState('');
      const [analysis, setAnalysis] = useState(null);
      const [musicWindowStart, setMusicWindowStart] = useState('0');
      const [musicWindowLength, setMusicWindowLength] = useState('60');
      const [projects, setProjects] = useState([]);
      const [projectDetail, setProjectDetail] = useState(null);
      const [jamendoQuery, setJamendoQuery] = useState('');
      const [jamendoKey, setJamendoKey] = useState('');
      const [jamendoItems, setJamendoItems] = useState([]);
      const endpoint = '/api/video-manager/editing';
      const request = async (suffix, body) => {
        const response = await fetch(endpoint + suffix, body === undefined ? {} : {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        let data;
        try { data = await response.json(); } catch { throw new Error('服务返回了无法读取的响应，请检查插件版本。'); }
        if (!response.ok || data?.success === false) throw new Error(data?.error || `请求失败 (${response.status})`);
        return data;
      };
      const action = async (name, fn) => {
        if (lockRef.current) return;
        lockRef.current = true; setBusy(name); setError(''); setNotice('');
        try { await fn(); } catch (e) { setError(e?.message || '操作失败，请重试'); }
        finally { lockRef.current = false; setBusy(''); }
      };
      const loadMusicBrowser = async dir => {
        const response=await fetch(`/api/video-manager/fs/browse${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`);
        const data=await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.folders) || !Array.isArray(data.audio_files)) throw new Error('无法浏览音乐目录，请确认插件版本。');
        setMusicBrowser(data); setShowMusicBrowser(true);
      };
      const refreshMusic = async () => {
        const data = await request('/music?limit=100');
        const list = data.items ?? data.music?.items ?? data.music ?? data.result?.items;
        if (!Array.isArray(list)) throw new Error('音乐列表格式不兼容，请检查插件版本。');
        setItems(list);
      };
      const refreshProjects = async () => {
        const data = await request('/projects');
        const list = data.items ?? data.projects?.items ?? data.projects ?? data.result?.items;
        if (!Array.isArray(list)) throw new Error('项目列表格式不兼容，请检查插件版本。');
        setProjects(list);
      };
      useEffect(() => { action('load', async () => { await Promise.all([refreshMusic(), refreshProjects()]); }); }, []);
      const chosen = items.find(item => item.id === musicId);
      const card = { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0, overflowWrap: 'anywhere' };
      const row = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' };
      const label = { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 };
      const input = { ...styles.input, width: '100%', boxSizing: 'border-box' };
      const button = { ...styles.secondary, minHeight: '34px', whiteSpace: 'normal' };
      const pre = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '100%', margin: 0, font: 'inherit' };
      const show = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      const postImport = () => action('import', async () => {
        if (!filePath.trim()) throw new Error('请填写本地音乐文件绝对路径。');
        const data = await request('/music', { file_path: filePath.trim(), title: title.trim(), source_name: sourceName.trim(), license_status: 'unknown', license_note: licenseNote.trim() });
        await refreshMusic(); setFilePath(''); setTitle('');
        if (data.music?.id) setMusicId(data.music.id);
        setNotice(data.created === false ? '音乐已存在；保留原有记录。' : '音乐已添加，授权状态待确认。源文件保持不变。');
      });
      const confirmMusic = () => action('confirm', async () => {
        if (!musicId || !window.confirm('请确认你有权将该音乐用于本次个人分享。此操作仅记录你的声明，并不代表平台或插件已核验版权。继续？')) return;
        await request(`/music/${encodeURIComponent(musicId)}/confirm-personal`, { confirmed: true, license_note: licenseNote.trim() });
        await refreshMusic(); setNotice('已记录个人用途的用户声明；发布前仍需核对授权。');
      });
      const analyzeMusic = () => action('analyze', async () => {
        if (!musicId) throw new Error('请先选择音乐。');
        const startSeconds=Number(musicWindowStart), durationSeconds=Number(musicWindowLength);
        if (!Number.isFinite(startSeconds) || startSeconds < 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 180) throw new Error('音乐分析起点须非负，时长须为 0–180 秒。');
        const data = await request(`/music/${encodeURIComponent(musicId)}/analyze`, {startSeconds,durationSeconds});
        setAnalysis(data.analysis ?? data.result ?? data);
      });
      const search = () => action('jamendo', async () => {
        const key = jamendoKey.trim(); setJamendoKey(''); setJamendoItems([]);
        if (!key || !jamendoQuery.trim()) throw new Error('请输入 Jamendo Client ID 和搜索词。');
        let data;
        try { data = await request('/jamendo/search', { clientId: key, query: jamendoQuery.trim() }); }
        catch { throw new Error('Jamendo 搜索失败，请检查 Client ID 和网络。'); }
        const list = data.items ?? data.results ?? data.result?.items;
        if (!Array.isArray(list)) throw new Error('音乐搜索响应格式不兼容，请检查插件版本。');
        setJamendoItems(list);
      });
      return h('div', { style: styles.overlay, role: 'dialog', 'aria-modal': true, 'aria-label': '剪辑项目工作台' },
        h('div', { style: { ...styles.modal, width: isMobile ? '95vw' : '900px', maxHeight: '90vh' } },
          h('div', { style: { ...row, justifyContent: 'space-between' } },
            h('strong', null, '剪辑项目工作台'),
            h('button', { type: 'button', style: button, onClick: onClose, disabled: !!busy }, '关闭')
          ),
          h('div', { style: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, paddingRight: '3px' } },
            h('div', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px' } }, '本工作台用于本地音乐素材、试听与分析，以及查看 Agent 已保存的剪辑项目。创意构思、选曲和时间线迭代请在 DSH 对话中交给 Agent。此处不会生成方案或导出、修改媒体。'),
            error && h('div', { role: 'alert' }, error), notice && h('div', { role: 'status' }, notice), busy && h('div', { role: 'status' }, '正在处理，请稍候…'),
            h('section', { style: card }, h('strong', null, '1. 本地音乐'),
              h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, '导入仅建立只读引用，不复制、修改或删除源音频。授权未知的音乐不代表可发布或商用。'),
              h('div', { style: row },
                h('label', { style: { ...label, flex:'1 1 220px' } }, '音乐文件绝对路径', h('input', { 'aria-label': '音乐文件绝对路径', value: filePath, onChange: e => setFilePath(e.target.value), style: input })),
                h('button', { type:'button', style:button, disabled:!!busy, onClick:() => action('browse-music', () => loadMusicBrowser()) }, '浏览音乐文件')
              ),
              showMusicBrowser && musicBrowser && h('div', { style:{...card,maxHeight:'260px',overflowY:'auto'} },
                h('div', { style:{...row,justifyContent:'space-between'} }, h('strong',null,'选择本地音乐'), h('button',{type:'button',style:button,onClick:()=>setShowMusicBrowser(false)},'关闭浏览器')),
                h('div',{style:{...pre,fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},musicBrowser.current_path),
                h('div',{style:row}, musicBrowser.parent_path && h('button',{type:'button',style:button,onClick:()=>action('browse-music',()=>loadMusicBrowser(musicBrowser.parent_path))},'上一级'),
                  (musicBrowser.drive_roots || []).map(place=>h('button',{key:place.path,type:'button',style:button,onClick:()=>action('browse-music',()=>loadMusicBrowser(place.path))},place.name))),
                ...(musicBrowser.folders || []).map(folder=>h('button',{key:folder.path,type:'button',style:{...button,textAlign:'left'},onClick:()=>action('browse-music',()=>loadMusicBrowser(folder.path))},`目录：${folder.name}`)),
                ...(musicBrowser.audio_files || []).map(file=>h('button',{key:file.path,type:'button',style:{...button,textAlign:'left'},onClick:()=>{setFilePath(file.path);setShowMusicBrowser(false);}},`选择：${file.name}`)),
                !(musicBrowser.audio_files || []).length && h('div',{style:{fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},'当前目录没有可识别的音频文件。')
              ),
              h('div', { style: row }, h('label', { style: { ...label, flex: '1 1 180px' } }, '标题（可选）', h('input', { 'aria-label': '音乐标题', value: title, onChange: e => setTitle(e.target.value), style: input })), h('label', { style: { ...label, flex: '1 1 180px' } }, '来源（可选）', h('input', { 'aria-label': '音乐来源', value: sourceName, onChange: e => setSourceName(e.target.value), style: input }))),
              h('label', { style: label }, '授权备注（可选）', h('input', { 'aria-label': '授权备注', value: licenseNote, onChange: e => setLicenseNote(e.target.value), style: input })),
              h('div', { style: row }, h('button', { type: 'button', style: button, disabled: !!busy, onClick: postImport }, '导入本地音乐'), h('button', { type: 'button', style: button, disabled: !!busy, onClick: () => action('load', refreshMusic) }, '刷新音乐')),
              h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, '音乐选曲与创意编排请在 DSH 对话中交由 Agent 完成；本工作台仅管理音乐素材、试听和音频检测。授权状态为用户声明，需自行核验。'),
              h('label', { style: label }, '选择音乐', h('select', { 'aria-label': '选择音乐', value: musicId, style: input, onChange: e => { setMusicId(e.target.value); setAnalysis(null); } }, h('option', { value: '' }, '请选择音乐'), items.map(item => h('option', { key: item.id, value: item.id }, `${item.title || item.file_name || item.id} · ${item.license_status === 'personal_confirmed' ? '用户已声明个人用途' : '授权未知'}`)))),
              chosen && h('audio', { controls:true, preload:'none', src:`${endpoint}/music/${encodeURIComponent(chosen.id)}/stream`, style:{width:'100%','maxWidth':'100%'} }),
              chosen && h('div', { style: pre }, `文件：${chosen.file_name || '未知'}\n标题：${chosen.title || '未知'}\n来源：${chosen.source_name || '未提供'}\n授权：${chosen.license_status === 'personal_confirmed' ? '用户已声明个人用途（未独立核验）' : '未知，须确认'}`),
              h('div', { style: row },
                h('label', { style: { ...label, flex: '1 1 180px' } }, '音乐分析起点（源音频秒数）', h('input', { 'aria-label': '音乐分析起点', type:'number', min:0, step:0.1, value:musicWindowStart, onChange:e=>{setMusicWindowStart(e.target.value);setAnalysis(null);}, style:input })),
                h('label', { style: { ...label, flex: '1 1 180px' } }, '分析窗口长度（秒，最多 180）', h('input', { 'aria-label': '音乐分析窗口长度', type:'number', min:1, max:180, value:musicWindowLength, onChange:e=>{setMusicWindowLength(e.target.value);setAnalysis(null);}, style:input }))
              ),
              h('div', { style: row }, h('button', { type: 'button', style: button, disabled: !!busy || !musicId, onClick: confirmMusic }, '确认个人使用权限'), h('button', { type: 'button', style: button, disabled: !!busy || !musicId, onClick: analyzeMusic }, '分析音乐')),
              analysis && h('div', { style: pre }, `音乐分析：${analysis.status || '未知'}\nBPM：${analysis.bpm ?? '未检测到'}\n置信度：${analysis.confidence ?? '未提供'}（低置信度时请人工试听）\n实测节拍（秒）：${Array.isArray(analysis.beats) && analysis.beats.length ? analysis.beats.join('、') : '未提供'}\n检测瞬态候选（秒）：${Array.isArray(analysis.onsets) && analysis.onsets.length ? analysis.onsets.join('、') : '未提供'}\n瞬态不一定是节拍或强拍，请试听确认。\n${analysis.notice || ''}`)
            ),
            h('details', { style: card }, h('summary', null, 'Jamendo 搜索（可选）'), h('div', null, '仅搜索预览，不代表已获授权，也不自动下载；请在原来源核对用途和许可。'),
              h('label', { style: label }, 'Client ID（仅本次请求）', h('input', { 'aria-label': 'Jamendo Client ID', type: 'password', autoComplete: 'off', value: jamendoKey, onChange: e => setJamendoKey(e.target.value), style: input })),
              h('label', { style: label }, '搜索词', h('input', { 'aria-label': 'Jamendo 搜索词', value: jamendoQuery, onChange: e => setJamendoQuery(e.target.value), style: input })),
              h('button', { type: 'button', style: button, disabled: !!busy, onClick: search }, '搜索预览'),
              jamendoItems.map((item, i) => h('div', { key: item.id || i, style: card }, h('strong', null, item.title || item.name || '未命名'), h('div', null, `作者：${item.artist || item.artist_name || '未知'} · 授权需核验`), (item.source_url || item.url) && /^https?:\/\//i.test(item.source_url || item.url) && h('a', { href: item.source_url || item.url, target: '_blank', rel: 'noopener noreferrer' }, '前往来源核验')))
            ),
            h('section', { style:card }, h('strong', null, '2. 已保存剪辑项目'), h('button', { type:'button', style:button, disabled:!!busy, onClick:() => action('projects',refreshProjects) }, '刷新项目'),
              projects.length === 0 && h('div', null, '暂无项目'),
              projects.map((project,i) => h('button', { key:project.id || i, type:'button', style:button, disabled:!!busy || !project.id, onClick:() => action('project',async()=>{const data=await request(`/projects/${encodeURIComponent(project.id)}`);setProjectDetail(data.project ?? data.record ?? data.result ?? data);}) }, project.title || project.id || '未命名项目')),
              projectDetail && h('pre', { style:pre }, show(projectDetail))
            )
          )
        )
      );
    }

    // --- Main Workbench View Component with Mobile Responsive Layout ---
    function VideoManagerWorkbench() {
      // Responsive state (mobile: < 840px)
      const isMobile = useIsMobile(840);
      const [mobileTab, setMobileTab] = useState('videos'); // 'folders' | 'videos' | 'detail'

      // Left sidebar resizable width (desktop)
      const [sidebarWidth, setSidebarWidth] = useState(260);
      const isDraggingRef = useRef(false);

      // Folder collapse state
      const [collapsedFolderIds, setCollapsedFolderIds] = useState(new Set());

      // Data state
      const [status, setStatus] = useState(null);
      const [folders, setFolders] = useState([]);
      const [videos, setVideos] = useState([]);
      const [selectedFolderId, setSelectedFolderId] = useState(null);
      const [selectedVideo, setSelectedVideo] = useState(null);
      const [loading, setLoading] = useState(false);
      const [searchQuery, setSearchQuery] = useState('');
      const [statusFilter, setStatusFilter] = useState('');
      const viewRef = useRef({ folderId: null, query: '', status: '', videoId: null });
      const requestVersions = useRef({ folders: 0, videos: 0, detail: 0 });
      const editingRef = useRef(false);
      const [sortRule, setSortRule] = useState(() => {
        try {
          return validateSortRule(window.localStorage.getItem(SORT_STORAGE_KEY));
        } catch {
          return DEFAULT_SORT_RULE;
        }
      });
      const sortRuleRef = useRef(sortRule);
      sortRuleRef.current = sortRule;

      const parseSortRule = (rule) => {
        const validatedRule = validateSortRule(rule);
        const lastUnderscore = validatedRule.lastIndexOf('_');
        const field = validatedRule.slice(0, lastUnderscore);
        const dir = validatedRule.slice(lastUnderscore + 1);
        return { sortBy: field, sortDir: dir };
      };

      // Batch selection state
      const [selectedVideoIds, setSelectedVideoIds] = useState(new Set());
      const [showBatchMoveModal, setShowBatchMoveModal] = useState(false);
      const [batchTargetFolderId, setBatchTargetFolderId] = useState('');

      // UI state
      const [activeTab, setActiveTab] = useState('shots'); // 'shots' | 'audio' | 'meta'
      const [showSettingsModal, setShowSettingsModal] = useState(false);
      const [showScanModal, setShowScanModal] = useState(false);
      const [showNewFolderModal, setShowNewFolderModal] = useState(false);
      const [showExportModal, setShowExportModal] = useState(false);
      const [showEditingWorkbench, setShowEditingWorkbench] = useState(false);

      // Folder Action Popup state
      const [activeFolderMenuId, setActiveFolderMenuId] = useState(null);
      const [renamingFolder, setRenamingFolder] = useState(null); // { id, name }
      const [newSubFolderParentId, setNewSubFolderParentId] = useState(null);

      // Video Card Action Popup state
      const [activeVideoMenuId, setActiveVideoMenuId] = useState(null);
      const [singleMoveVideoId, setSingleMoveVideoId] = useState(null);

      // Import Loading state (Prevents repeated submission and gives immediate feedback)
      const [isImporting, setIsImporting] = useState(false);
      const importLockRef = useRef(false);
      const [importNotice, setImportNotice] = useState('');

      // AI Analysis Running States
      const [aiAnalyzingId, setAiAnalyzingId] = useState(null);
      const [isBatchAiAnalyzing, setIsBatchAiAnalyzing] = useState(false);

      // Editing states for Right Panel
      const [isEditingShots, setIsEditingShots] = useState(false);
      const [isEditingAudio, setIsEditingAudio] = useState(false);
      const [isEditingMeta, setIsEditingMeta] = useState(false);
      editingRef.current = isEditingShots || isEditingAudio || isEditingMeta;

      const [editingMeta, setEditingMeta] = useState(null);
      const [editingShots, setEditingShots] = useState([]);
      const [editingAudio, setEditingAudio] = useState(null);
      const [newTagInput, setNewTagInput] = useState('');

      // Per-shot deep-analysis drafts are kept separate from editable shot data.
      const [shotRuns, setShotRuns] = useState({});
      const [openShotRun, setOpenShotRun] = useState({});
      const [shotRunLoading, setShotRunLoading] = useState({});
      const [shotRunError, setShotRunError] = useState({});
      const [shotSelectedFields, setShotSelectedFields] = useState({});
      const [applyingShotRun, setApplyingShotRun] = useState(null);
      const shotLocksRef = useRef(new Set());
      const shotRunVersionsRef = useRef({});
      const applyingShotRunRef = useRef(null);
      const [shotPrompt, setShotPrompt] = useState('');
      const [shotDefaultPrompt, setShotDefaultPrompt] = useState('');
      const [shotPromptError, setShotPromptError] = useState('');
      const [shotPromptLoaded, setShotPromptLoaded] = useState(false);
      const shotPromptInitialRef = useRef('');
      const shotPromptVersionRef = useRef(0);

      // Form & Browser states
      const [ffmpegInput, setFfmpegInput] = useState('');
      const [ffprobeInput, setFfprobeInput] = useState('');
      const [scanDirPath, setScanDirPath] = useState('');
      const [newFolderName, setNewFolderName] = useState('');
      const [newFolderParentId, setNewFolderParentId] = useState('');
      const [exportFormat, setExportFormat] = useState('jianying');
      const [exportName, setExportName] = useState('初剪序列_01');

      // AI Settings form states
      const [aiBaseUrlInput, setAiBaseUrlInput] = useState('');
      const [aiApiKeyInput, setAiApiKeyInput] = useState('');
      const [aiModelInput, setAiModelInput] = useState('');
      const [aiReasoningInput, setAiReasoningInput] = useState('');
      const [aiMode, setAiMode] = useState('dsh');
      const [aiProviderInput, setAiProviderInput] = useState('');
      const [aiProviders, setAiProviders] = useState([]);
      const [aiCatalogWarning, setAiCatalogWarning] = useState('');
      const [aiPromptTemplate, setAiPromptTemplate] = useState('');
      const [defaultPromptText, setDefaultPromptText] = useState('');

      // Visual Filesystem Browser state (supports multi-selection)
      const [importTab, setImportTab] = useState('browse'); // 'browse' | 'manual'
      const [browserData, setBrowserData] = useState(null);
      const [browserLoading, setBrowserLoading] = useState(false);
      const [selectedBrowserFiles, setSelectedBrowserFiles] = useState(new Set()); // Set of selected filePaths

      // Workbench root & Video Player refs
      const workbenchRef = useRef(null);
      const videoRef = useRef(null);

      // Close open context menus on global click
      useEffect(() => {
        const handleClickOutside = () => {
          setActiveFolderMenuId(null);
          setActiveVideoMenuId(null);
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
      }, []);

      // Sidebar drag-to-resize listener with accurate relative clientX calculation
      useEffect(() => {
        const handleMouseMove = (e) => {
          if (!isDraggingRef.current || !workbenchRef.current) return;
          const rect = workbenchRef.current.getBoundingClientRect();
          // Accurately calculate relative position from workbench left edge!
          const relativeX = e.clientX - rect.left;
          const newW = Math.max(180, Math.min(600, relativeX));
          setSidebarWidth(newW);
        };
        const handleMouseUp = () => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
            document.body.style.userSelect = '';
          }
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
        };
      }, []);

      // Flatten folder list for dropdowns
      const flatFolderList = useMemo(() => {
        const list = [];
        const traverse = (items, prefix = '') => {
          for (const item of items) {
            const label = prefix ? `${prefix} / ${item.name}` : item.name;
            list.push({ id: item.id, name: label });
            if (item.children && item.children.length > 0) {
              traverse(item.children, label);
            }
          }
        };
        traverse(folders);
        return list;
      }, [folders]);

      // Currently selected folder object
      const currentSelectedFolder = useMemo(() => {
        if (!selectedFolderId) return null;
        const findNode = (items) => {
          for (const item of items) {
            if (item.id === selectedFolderId) return item;
            if (item.children && item.children.length > 0) {
              const res = findNode(item.children);
              if (res) return res;
            }
          }
          return null;
        };
        return findNode(folders);
      }, [folders, selectedFolderId]);

      // 1. Load System Status
      const loadStatus = async () => {
        try {
          const res = await fetch('/api/video-manager/status');
          const data = await res.json();
          if (data.success) {
            setStatus(data);
            if (data.settings) {
              setFfmpegInput(data.settings.ffmpeg_path || '');
              setFfprobeInput(data.settings.ffprobe_path || '');
            }
          }
        } catch (e) {
          console.error('Failed to load status', e);
        }
      };

      // 2. Load Folder Tree
      const loadFolders = async () => {
        const version = ++requestVersions.current.folders;
        try {
          const res = await fetch('/api/video-manager/folders');
          const data = await res.json();
          if (data.success && version === requestVersions.current.folders) {
            setFolders(data.folders || []);
          }
        } catch (e) {
          console.error('Failed to load folders', e);
        }
      };

      // 3. Load Videos
      const loadVideos = async (folderId, query, status, sBy = null, sDir = null) => {
        viewRef.current = { ...viewRef.current, folderId, query, status };
        const version = ++requestVersions.current.videos;
        const detailVersion = requestVersions.current.detail;
        setLoading(true);
        try {
          const parsedSort = parseSortRule(sortRuleRef.current);
          const finalSortBy = sBy !== null ? sBy : parsedSort.sortBy;
          const finalSortDir = sDir !== null ? sDir : parsedSort.sortDir;

          let url = '/api/video-manager/videos?limit=200';
          if (folderId) url += `&folder_id=${encodeURIComponent(folderId)}`;
          if (query) url += `&query=${encodeURIComponent(query)}`;
          if (status) url += `&status=${encodeURIComponent(status)}`;
          if (finalSortBy) url += `&sort_by=${encodeURIComponent(finalSortBy)}`;
          if (finalSortDir) url += `&sort_dir=${encodeURIComponent(finalSortDir)}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.success && version === requestVersions.current.videos) {
            setVideos(data.videos || []);
            const currentId = viewRef.current.videoId;
            const missing = !currentId || !data.videos.some(v => v.id === currentId);
            if (missing && !editingRef.current && detailVersion === requestVersions.current.detail) {
              if (data.videos.length && !isMobile) {
                loadVideoDetail(data.videos[0].id);
              } else if (!data.videos.length) {
                viewRef.current.videoId = null;
                ++requestVersions.current.detail;
                setSelectedVideo(null);
              }
            }
          }
        } catch (e) {
          console.error('Failed to load videos', e);
        } finally {
          if (version === requestVersions.current.videos) setLoading(false);
        }
      };

      // 4. Load Single Video Detail and sync editing form
      const loadVideoDetail = async (videoId, silent = false) => {
        if (silent && (editingRef.current || viewRef.current.videoId !== videoId)) return;
        if (!silent) viewRef.current.videoId = videoId;
        const version = ++requestVersions.current.detail;
        try {
          const res = await fetch(`/api/video-manager/videos/${videoId}`);
          const data = await res.json();
          if (data.success && data.video && version === requestVersions.current.detail &&
              viewRef.current.videoId === videoId && (!silent || !editingRef.current)) {
            setSelectedVideo(data.video);
            setEditingMeta({
              file_name: data.video.file_name,
              folder_id: data.video.folder_id || '',
              summary: data.video.summary || '',
              user_notes: data.video.user_notes || '',
              tags: Array.isArray(data.video.tags) ? [...data.video.tags] : []
            });
            setEditingShots(Array.isArray(data.video.shots) ? JSON.parse(JSON.stringify(data.video.shots)) : []);
            setEditingAudio(data.video.audio ? JSON.parse(JSON.stringify(data.video.audio)) : {
              bpm: null, bgm_type: '无', bgm_mood: '自然', transcripts: []
            });
            setIsEditingShots(false);
            setIsEditingAudio(false);
            setIsEditingMeta(false);
            if (isMobile && !silent) {
              setMobileTab('detail');
            }
          }
        } catch (e) {
          console.error('Failed to load video detail', e);
        }
      };

      const refreshCurrentView = async () => {
        const current = viewRef.current;
        await Promise.all([
          loadFolders(),
          loadVideos(current.folderId, current.query, current.status),
          current.videoId ? loadVideoDetail(current.videoId, true) : Promise.resolve()
        ]);
      };
      const refreshCurrentViewRef = useRef(refreshCurrentView);
      refreshCurrentViewRef.current = refreshCurrentView;

      // 5. Load AI Settings
      const loadAiCatalog = async () => {
        try {
          const response = await fetch('/api/video-manager/ai-models');
          const catalog = await response.json();
          if (!response.ok || !catalog.success) throw new Error('无法加载 DSH 模型列表');
          setAiProviders(catalog.providers || []);
          setAiCatalogWarning(catalog.errors?.length ? '部分服务商的模型列表获取失败，请检查 DSH 模型配置。' : '');
        } catch (e) {
          setAiCatalogWarning('无法获取 DSH 模型列表：' + e.message);
        }
      };
      const loadAiSettings = async () => {
        try {
          const res = await fetch('/api/video-manager/ai-settings');
          const data = await res.json();
          if (data.success) {
            setAiMode(data.mode || 'dsh');
            setAiProviderInput(data.provider || '');
            setAiBaseUrlInput(data.base_url || '');
            setAiModelInput(data.model || '');
            setAiReasoningInput(data.reasoning_effort || '');
            setAiPromptTemplate(data.custom_prompt || data.default_prompt || '');
            setDefaultPromptText(data.default_prompt || '');
          }
          await loadAiCatalog();
        } catch (e) {
          setAiCatalogWarning('无法获取 DSH 模型列表：' + e.message);
        }
      };

      const loadShotAnalysisSettings = async () => {
        const version = ++shotPromptVersionRef.current;
        setShotPromptLoaded(false);
        setShotPromptError('');
        try {
          const response = await fetch('/api/video-manager/shot-analysis-settings');
          const data = await response.json();
          if (!response.ok || !data.success || typeof data.prompt !== 'string' || typeof data.default_prompt !== 'string') {
            throw new Error(data.error || '无法读取镜头深度分析提示词');
          }
          if (version !== shotPromptVersionRef.current) return;
          setShotPrompt(data.prompt);
          setShotDefaultPrompt(data.default_prompt);
          shotPromptInitialRef.current = data.prompt;
          setShotPromptLoaded(true);
        } catch (error) {
          if (version === shotPromptVersionRef.current) setShotPromptError(error.message || '读取提示词失败');
        }
      };
      const saveShotAnalysisSettings = async () => {
        if (!shotPromptLoaded) throw new Error('镜头深度分析提示词尚未加载，未保存设置');
        if (shotPrompt === shotPromptInitialRef.current) return;
        const response = await fetch('/api/video-manager/shot-analysis-settings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: shotPrompt })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || '保存镜头深度分析提示词失败');
        shotPromptInitialRef.current = shotPrompt;
      };

      // 6. Load Local Filesystem Directory for Browser
      const loadBrowseDir = async (dirPath) => {
        setBrowserLoading(true);
        setSelectedBrowserFiles(new Set());
        try {
          const url = dirPath
            ? `/api/video-manager/fs/browse?dir=${encodeURIComponent(dirPath)}`
            : `/api/video-manager/fs/browse`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.success) {
            setBrowserData(data);
            setScanDirPath(data.current_path);
          }
        } catch (e) {
          console.error('Failed to browse directory', e);
        } finally {
          setBrowserLoading(false);
        }
      };

      // Toggle select for one video file in browser
      const toggleBrowserFile = (filePath) => {
        const next = new Set(selectedBrowserFiles);
        if (next.has(filePath)) next.delete(filePath);
        else next.add(filePath);
        setSelectedBrowserFiles(next);
      };

      // Toggle select all video files in current browsing directory
      const toggleSelectAllBrowserFiles = () => {
        const allFiles = (browserData && browserData.video_files) || [];
        if (allFiles.length === 0) return;
        if (selectedBrowserFiles.size === allFiles.length) {
          setSelectedBrowserFiles(new Set());
        } else {
          setSelectedBrowserFiles(new Set(allFiles.map(f => f.path)));
        }
      };

      useEffect(() => {
        loadStatus();
        loadFolders();
        loadVideos(null, '', '');
        loadAiSettings();
      }, []);

      useEffect(() => {
        if (!isBatchAiAnalyzing && !isImporting && !aiAnalyzingId) return;
        let stopped = false;
        let timer;
        const poll = async () => {
          await refreshCurrentViewRef.current();
          if (!stopped) timer = setTimeout(poll, 2000);
        };
        timer = setTimeout(poll, 700);
        return () => { stopped = true; clearTimeout(timer); };
      }, [isBatchAiAnalyzing, isImporting, aiAnalyzingId]);

      const handleFolderSelect = (folderId) => {
        setSelectedFolderId(folderId);
        setSelectedVideoIds(new Set());
        loadVideos(folderId, searchQuery, statusFilter);
        if (isMobile) {
          setMobileTab('videos');
        }
      };

      // Toggle folder collapse
      const toggleFolderCollapse = (folderId, e) => {
        e.stopPropagation();
        const next = new Set(collapsedFolderIds);
        if (next.has(folderId)) next.delete(folderId);
        else next.add(folderId);
        setCollapsedFolderIds(next);
      };

      const hasActiveShotAnalysis = shotId => shotLocksRef.current.has(shotId) ||
        (shotRuns[shotId] || []).some(run => run.status === 'running' || run.status === 'queued');
      const shotAnalysisUrl = (videoId, shotId, suffix) =>
        `/api/video-manager/videos/${encodeURIComponent(videoId)}/shots/${encodeURIComponent(shotId)}/${suffix}`;
      const loadShotRuns = async (videoId, shotId) => {
        const version = (shotRunVersionsRef.current[shotId] || 0) + 1;
        shotRunVersionsRef.current[shotId] = version;
        setShotRunLoading(current => ({ ...current, [shotId]: true }));
        setShotRunError(current => ({ ...current, [shotId]: '' }));
        try {
          const response = await fetch(shotAnalysisUrl(videoId, shotId, 'deep-analyses'));
          const data = await response.json();
          if (!response.ok || !data.success || !Array.isArray(data.runs)) throw new Error(data.error || '读取分析记录失败');
          if (shotRunVersionsRef.current[shotId] === version) setShotRuns(current => ({ ...current, [shotId]: data.runs }));
        } catch (error) {
          if (shotRunVersionsRef.current[shotId] === version) setShotRunError(current => ({ ...current, [shotId]: error.message || '读取分析记录失败' }));
        } finally {
          if (shotRunVersionsRef.current[shotId] === version) setShotRunLoading(current => ({ ...current, [shotId]: false }));
        }
      };
      const handleShotDeepAnalysis = async (videoId, shotId) => {
        if (!videoId || !shotId || editingRef.current || hasActiveShotAnalysis(shotId) || applyingShotRunRef.current) return;
        shotLocksRef.current.add(shotId);
        const version = (shotRunVersionsRef.current[shotId] || 0) + 1;
        shotRunVersionsRef.current[shotId] = version;
        setOpenShotRun(current => ({ ...current, [shotId]: true }));
        setShotRunLoading(current => ({ ...current, [shotId]: true }));
        setShotRunError(current => ({ ...current, [shotId]: '' }));
        try {
          const response = await fetch(shotAnalysisUrl(videoId, shotId, 'deep-analysis'), { method: 'POST' });
          const data = await response.json();
          if (!response.ok || !data.success || !data.run) throw new Error(data.error || '镜头分析失败');
          if (shotRunVersionsRef.current[shotId] === version) {
            setShotRuns(current => ({ ...current, [shotId]: [data.run, ...(current[shotId] || []).filter(run => run.id !== data.run.id)] }));
            setShotSelectedFields(current => ({ ...current, [data.run.id]: [] }));
          }
        } catch (error) {
          if (shotRunVersionsRef.current[shotId] === version) setShotRunError(current => ({ ...current, [shotId]: error.message || '镜头分析失败' }));
        } finally {
          shotLocksRef.current.delete(shotId);
          if (shotRunVersionsRef.current[shotId] === version) setShotRunLoading(current => ({ ...current, [shotId]: false }));
        }
      };
      const handleApplyShotRun = async (videoId, shot, run, fields) => {
        if (!fields.length || editingRef.current || applyingShotRunRef.current || hasActiveShotAnalysis(shot.id) ||
            !run?.baseline || fields.some(field => !Object.hasOwn(run.baseline, field) || JSON.stringify(run.baseline[field] ?? null) !== JSON.stringify(shot[field] ?? null)) ||
            viewRef.current.videoId !== videoId || !run?.id || run.status !== 'completed' ||
            !shotRunBoundaryMatches(run, shot)) return;
        applyingShotRunRef.current = run.id;
        setApplyingShotRun(run.id);
        setShotRunError(current => ({ ...current, [shot.id]: '' }));
        try {
          const response = await fetch(`/api/video-manager/shot-analysis/${encodeURIComponent(run.id)}/apply`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields })
          });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || '应用分析结果失败');
          setShotSelectedFields(current => ({ ...current, [run.id]: [] }));
          if (viewRef.current.videoId === videoId && !editingRef.current) await loadVideoDetail(videoId, true);
          await loadShotRuns(videoId, shot.id);
        } catch (error) {
          setShotRunError(current => ({ ...current, [shot.id]: error.message || '应用分析结果失败' }));
        } finally {
          applyingShotRunRef.current = null;
          setApplyingShotRun(null);
        }
      };

      const renderShotAnalysis = (shot, videoId) => {
        const runs = shotRuns[shot.id] || [];
        const error = shotRunError[shot.id];
        const loading = shotRunLoading[shot.id];
        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--dsw-alias-border-l1)', paddingTop: '8px', minWidth: 0 } },
          loading && h('div', { role: 'status', style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
            shotLocksRef.current.has(shot.id) ? '镜头分析中，请稍候；不会自动修改原有标注。' : '正在读取镜头分析记录…'),
          error && h('div', { role: 'alert', style: { fontSize: '11px', color: 'var(--dsw-alias-label-primary)' } }, `镜头分析：${error}`),
          !loading && !runs.length && !error && h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '暂无镜头深度分析记录。'),
          runs.map(run => {
            const candidate = run.candidate && typeof run.candidate === 'object' ? run.candidate : {};
            const baseline = run.baseline && typeof run.baseline === 'object' ? run.baseline : null;
            const selected = shotSelectedFields[run.id] || [];
            const boundaryStale = !shotRunBoundaryMatches(run, shot);
            const conflictFields = selected.filter(field => !baseline || !Object.hasOwn(baseline, field) || JSON.stringify(baseline[field] ?? null) !== JSON.stringify(shot[field] ?? null));
            const audit = run.audit || {};
            const tokenValue = v => v === null || v === undefined ? '未提供' : String(v);
            return h('section', { key: run.id, style: { border: '1px solid var(--dsw-alias-border-l1)', backgroundColor: 'var(--dsw-alias-bg-layer-1)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 } },
              h('div', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } },
                `镜头精读 · ${run.status === 'completed' ? '已生成候选' : run.status === 'applied' ? '已应用' : run.status === 'failed' ? '分析失败' : run.status === 'running' ? '分析中' : (run.status || '状态未知')}`),
              h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
                `分析范围：${run.start_time ?? '未知'} – ${run.end_time ?? '未知'} 秒；当前范围：${shot.start_time} – ${shot.end_time} 秒`),
              boundaryStale && h('div', { role: 'alert', style: { fontSize: '11px', color: 'var(--dsw-alias-label-primary)' } }, '此结果的时间范围与当前镜头不一致或无法确认，不能应用；请重新分析。'),
              run.status === 'applied' && h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
                `已应用字段：${Array.isArray(run.applied_fields) && run.applied_fields.length ? run.applied_fields.map(field => SHOT_ANALYSIS_FIELDS.find(([key]) => key === field)?.[1] || field).join('、') : '未提供'}`),
              run.error_message && h('div', { role: 'alert', style: { fontSize: '11px', color: 'var(--dsw-alias-label-primary)' } }, `失败原因：${run.error_message}`),
              run.storyboard_path && run.id && h('img', { src: `/api/video-manager/shot-analysis/${encodeURIComponent(run.id)}/storyboard`, alt: '镜头采样故事板', style: { display: 'block', width: '100%', height: 'auto', borderRadius: '4px' } }),
              Array.isArray(run.sample_times) && run.sample_times.length > 0 && h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', overflowWrap: 'anywhere' } }, `采样时间（原视频秒数）：${run.sample_times.map(t => typeof t === 'number' ? t.toFixed(2) : String(t)).join('、')}`),
              (run.status === 'completed' || run.status === 'applied') && SHOT_ANALYSIS_FIELDS.filter(([field]) => Object.hasOwn(candidate, field)).map(([field, label]) => {
                const checked = selected.includes(field);
                return h('label', { key: field, style: { display: 'flex', gap: '7px', alignItems: 'flex-start', fontSize: '11px', color: 'var(--dsw-alias-label-primary)', minWidth: 0 } },
                  h('input', { type: 'checkbox', checked, disabled: run.status !== 'completed' || editingRef.current || !!applyingShotRun || hasActiveShotAnalysis(shot.id) || boundaryStale,
                    onChange: e => setShotSelectedFields(current => ({ ...current, [run.id]: e.target.checked ? [...new Set([...(current[run.id] || []), field])] : (current[run.id] || []).filter(item => item !== field) })) }),
                  h('span', { style: { minWidth: 0, overflowWrap: 'anywhere', lineHeight: '1.5' } },
                    h('strong', null, label), h('br'), `当前：${shotAnalysisValue(shot[field])}`, h('br'), `候选：${shotAnalysisValue(candidate[field])}`)
                );
              }),
              conflictFields.length > 0 && h('div', { role: 'alert', style: { fontSize: '11px', color: 'var(--dsw-alias-label-primary)' } }, '所选字段自分析后已被修改，请重新分析后再应用，避免覆盖人工修改。'),
              candidate.uncertainty != null && h('div', { style: { fontSize: '11px', overflowWrap: 'anywhere' } }, h('strong', null, '不确定性：'), shotAnalysisValue(candidate.uncertainty)),
              candidate.editing_suggestions != null && h('div', { style: { fontSize: '11px', overflowWrap: 'anywhere' } }, h('strong', null, '剪辑建议：'), shotAnalysisValue(candidate.editing_suggestions)),
              h('div', { style: { fontSize: '10px', color: 'var(--dsw-alias-label-secondary)', overflowWrap: 'anywhere' } },
                `服务商：${audit.provider || '未提供'} · 模型：${audit.model || '未提供'} · 推理档位：${audit.reasoning_effort || '未提供'} · 耗时：${audit.latency_ms == null ? '未提供' : `${(Number(audit.latency_ms) / 1000).toFixed(2)} 秒`} · Token（输入/输出/总计）：${tokenValue(audit.prompt_tokens)} / ${tokenValue(audit.completion_tokens)} / ${tokenValue(audit.total_tokens)} · 分析时间：${audit.finished_at || audit.analyzed_at || run.finished_at || '未提供'}`),
              run.status === 'completed' && h('button', {
                type: 'button', style: buttonSecondaryStyle,
                disabled: editingRef.current || !!applyingShotRun || hasActiveShotAnalysis(shot.id) || boundaryStale || !selected.length || conflictFields.length > 0,
                onClick: () => handleApplyShotRun(videoId, shot, run, selected)
              }, applyingShotRun === run.id ? '正在应用…' : `应用选中字段（${selected.length}）`)
            );
          })
        );
      };

      useEffect(() => {
        if (!selectedVideo?.id) return;
        const videoId = selectedVideo.id;
        const pending = (selectedVideo.shots || []).filter(shot =>
          openShotRun[shot.id] && !shotLocksRef.current.has(shot.id) && !shotRunLoading[shot.id] &&
          (shotRuns[shot.id] || []).some(run => run.status === 'running' || run.status === 'queued'));
        if (!pending.length) return;
        const timer = setTimeout(() => {
          for (const shot of pending) loadShotRuns(videoId, shot.id);
        }, 2000);
        return () => clearTimeout(timer);
      }, [selectedVideo?.id, selectedVideo?.shots, openShotRun, shotRuns, shotRunLoading]);

      // Direct Multi-modal AI Video Analysis
      const handleAiAnalyze = async (videoId) => {
        if (!videoId) return;
        const video = videos.find(v => v.id === videoId) || (selectedVideo?.id === videoId ? selectedVideo : null);
        if (video && (video.status === 'queued' || video.status === 'analyzing')) return;
        setAiAnalyzingId(videoId);
        try {
          const res = await fetch(`/api/video-manager/videos/${videoId}/ai-analyze`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            const audit = data.audit;
            const sec = (audit.latency_ms / 1000).toFixed(2);
            alert(`AI 分析完成！\n- 视觉模型: ${audit.model}\n- 分析耗时: ${sec} 秒\n- Token 消耗: ${audit.total_tokens} (输入: ${audit.prompt_tokens}, 输出: ${audit.completion_tokens})`);
            await refreshCurrentViewRef.current();
          } else {
            alert('AI 分析失败: ' + (data.error || '未知错误'));
          }
        } catch (e) {
          alert('AI 分析请求异常: ' + e.message);
        } finally {
          setAiAnalyzingId(null);
          await refreshCurrentViewRef.current();
        }
      };

      // Batch AI Video Analysis
      const handleBatchAiAnalyze = async () => {
        const ids = Array.from(selectedVideoIds);
        if (ids.length === 0 || isBatchAiAnalyzing) return;
        if (videos.some(v => ids.includes(v.id) && (v.status === 'queued' || v.status === 'analyzing'))) {
          alert('所选素材中包含排队中或分析中的视频，请勿重复提交。');
          return;
        }
        if (!confirm(`确定要对选中的 ${ids.length} 个视频依次发起多模态 AI 深度分析吗？\n（将自动生成故事板大图并调用视觉模型切分分镜与提取内容）`)) {
          return;
        }
        setIsBatchAiAnalyzing(true);
        setVideos(current => current.map(v => ids.includes(v.id) ? { ...v, status: 'queued' } : v));
        setSelectedVideo(current => current && ids.includes(current.id) ? { ...current, status: 'queued' } : current);
        try {
          const res = await fetch('/api/video-manager/videos/batch-ai-analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_ids: ids })
          });
          const data = await res.json();
          if (data.success) {
            const failures = (data.results || []).filter(result => !result.success);
            const failureText = failures.length ? `\n失败 ${failures.length} 个：\n${failures.map(r => `${r.video_id}: ${r.error || '未知错误'}`).join('\n')}` : '';
            setSelectedVideoIds(current => new Set([...current].filter(id => !ids.includes(id))));
            await refreshCurrentViewRef.current();
            alert(`批量 AI 分析完成！\n共提交 ${data.total} 个视频，成功完成 ${data.succeeded} 个！${failureText}`);
          } else {
            alert('批量分析失败: ' + data.error);
          }
        } catch (e) {
          alert('批量分析请求异常: ' + e.message);
        } finally {
          setIsBatchAiAnalyzing(false);
          await refreshCurrentViewRef.current();
        }
      };

      // Save AI Settings
      const handleSaveAiSettings = async () => {
        try {
          const res = await fetch('/api/video-manager/ai-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: aiMode,
              provider: aiProviderInput,
              base_url: aiBaseUrlInput,
              api_key: aiMode === 'custom' ? (aiApiKeyInput || undefined) : undefined,
              model: aiModelInput,
              reasoning_effort: aiMode === 'dsh' ? aiReasoningInput : undefined,
              prompt_template: aiPromptTemplate
            })
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || '保存 AI 设置失败');
          setAiApiKeyInput('');
          return true;
        } catch (e) {
          alert('保存 AI 设置失败: ' + e.message);
          return false;
        }
      };

      // Folder Rename
      const handleRenameFolder = async (folderId, newName) => {
        if (!newName || !newName.trim()) return;
        try {
          const res = await fetch(`/api/video-manager/folders/${folderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
          });
          const data = await res.json();
          if (data.success) {
            setRenamingFolder(null);
            loadFolders();
            loadVideos(selectedFolderId, searchQuery, statusFilter);
          }
        } catch (e) {
          alert('重命名分类失败: ' + e.message);
        }
      };

      // Folder Delete
      const handleDeleteFolder = async (folderId, folderName) => {
        if (!confirm(`确定要删除分类「${folderName}」吗？\n\n该分类下的视频将自动归入根目录，绝不会删除物理磁盘上的原始视频文件。`)) {
          return;
        }
        try {
          const res = await fetch(`/api/video-manager/folders/${folderId}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            if (selectedFolderId === folderId) {
              setSelectedFolderId(null);
            }
            loadFolders();
            loadVideos(null, searchQuery, statusFilter);
          }
        } catch (e) {
          alert('删除分类失败: ' + e.message);
        }
      };

      // Single Video Remove (Safe: never deletes original file)
      const handleDeleteSingleVideo = async (videoId, fileName) => {
        if (!confirm(`确定要从素材库移出视频「${fileName}」吗？\n\n注意：此操作仅移出素材库记录，保留缓存和原始视频文件。`)) {
          return;
        }
        try {
          const res = await fetch(`/api/video-manager/videos/${videoId}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            if (selectedVideo && selectedVideo.id === videoId) {
              viewRef.current.videoId = null;
              ++requestVersions.current.detail;
              setSelectedVideo(null);
              if (isMobile) setMobileTab('videos');
            }
            loadFolders();
            loadVideos(selectedFolderId, searchQuery, statusFilter);
          } else {
            alert('移出失败: ' + (data.error || '未知错误'));
          }
        } catch (e) {
          alert('移出失败: ' + e.message);
        }
      };

      // Batch Delete
      const handleBatchDelete = async () => {
        const ids = Array.from(selectedVideoIds);
        if (ids.length === 0) return;
        if (!confirm(`确定要批量移出选中的 ${ids.length} 个视频吗？\n\n注意：此操作仅清除素材库记录，保留缓存和原始视频文件！`)) {
          return;
        }
        try {
          const res = await fetch('/api/video-manager/videos/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_ids: ids })
          });
          const data = await res.json();
          if (data.success) {
            setSelectedVideoIds(new Set());
            viewRef.current.videoId = null;
            ++requestVersions.current.detail;
            setSelectedVideo(null);
            loadFolders();
            loadVideos(selectedFolderId, searchQuery, statusFilter);
          }
        } catch (e) {
          alert('批量移出失败: ' + e.message);
        }
      };

      // Batch Move
      const handleBatchMove = async () => {
        const ids = Array.from(selectedVideoIds);
        if (ids.length === 0) return;
        try {
          const res = await fetch('/api/video-manager/videos/batch-move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              video_ids: ids,
              target_folder_id: batchTargetFolderId || null
            })
          });
          const data = await res.json();
          if (data.success) {
            setShowBatchMoveModal(false);
            setSelectedVideoIds(new Set());
            loadFolders();
            loadVideos(selectedFolderId, searchQuery, statusFilter);
          }
        } catch (e) {
          alert('批量移动失败: ' + e.message);
        }
      };

      // Save Edited Meta Info
      const handleSaveMeta = async () => {
        if (!selectedVideo || !editingMeta) return;
        try {
          const res = await fetch(`/api/video-manager/videos/${selectedVideo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingMeta)
          });
          const data = await res.json();
          if (data.success) {
            setIsEditingMeta(false);
            loadVideoDetail(selectedVideo.id);
            loadVideos(selectedFolderId, searchQuery, statusFilter);
            loadFolders();
          }
        } catch (e) {
          alert('保存失败: ' + e.message);
        }
      };

      // Save Edited Shots
      const handleSaveShots = async () => {
        if (!selectedVideo) return;
        try {
          const res = await fetch('/api/video-manager/shots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              video_id: selectedVideo.id,
              shots: editingShots
            })
          });
          const data = await res.json();
          if (data.success) {
            setIsEditingShots(false);
            loadVideoDetail(selectedVideo.id);
          }
        } catch (e) {
          alert('保存分镜失败: ' + e.message);
        }
      };

      // Save Edited Audio Info
      const handleSaveAudio = async () => {
        if (!selectedVideo || !editingAudio) return;
        try {
          const res = await fetch('/api/video-manager/audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              video_id: selectedVideo.id,
              ...editingAudio
            })
          });
          const data = await res.json();
          if (data.success) {
            setIsEditingAudio(false);
            loadVideoDetail(selectedVideo.id);
          }
        } catch (e) {
          alert('保存音频失败: ' + e.message);
        }
      };

      const handleSaveSettings = async () => {
        if (!shotPromptLoaded) {
          alert('镜头深度分析提示词尚未加载，请重试后再保存。');
          return;
        }
        try {
          const res = await fetch('/api/video-manager/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ffmpeg_path: ffmpegInput, ffprobe_path: ffprobeInput })
          });
          const data = await res.json();
          if (data.success) {
            if (!await handleSaveAiSettings()) return;
            await saveShotAnalysisSettings();
            setShowSettingsModal(false);
            loadStatus();
          }
        } catch (e) {
          alert('保存设置失败: ' + e.message);
        }
      };

      // Scan directory with feedback & parent_id propagation
      const handleScanDirectory = async (customPath) => {
        if (importLockRef.current) return;
        const targetPath = (customPath || scanDirPath || '').trim();
        if (!targetPath) return;

        importLockRef.current = true;
        setIsImporting(true);
        setImportNotice('正在抽取视频参数并生成 4x4 故事板大图，请稍候...');

        try {
          const res = await fetch('/api/video-manager/folders/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              directory_path: targetPath,
              parent_id: selectedFolderId || null
            })
          });
          const data = await res.json();
          if (data.success) {
            setShowScanModal(false);
            await refreshCurrentViewRef.current();
            alert(`成功导入 ${data.imported_count} 个视频！`);
          } else {
            alert('扫描导入失败，部分素材可能已导入，列表将刷新：' + (data.error || '未知错误'));
          }
        } catch (e) {
          alert('扫描异常: ' + e.message);
        } finally {
          importLockRef.current = false;
          setIsImporting(false);
          setImportNotice('');
          await refreshCurrentViewRef.current();
        }
      };

      // Import selected video files directly (supports multiple / select all)
      const handleImportSelectedFiles = async (filePathsOverride) => {
        const targetPaths = filePathsOverride || Array.from(selectedBrowserFiles);
        if (importLockRef.current || !targetPaths || targetPaths.length === 0) return;

        importLockRef.current = true;
        setIsImporting(true);
        setImportNotice(`正在导入 ${targetPaths.length} 个视频并抽取故事板，请稍候...`);

        try {
          const res = await fetch('/api/video-manager/videos/import-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_paths: targetPaths,
              folder_id: selectedFolderId || null
            })
          });
          const data = await res.json();
          if (data.success) {
            setShowScanModal(false);
            await refreshCurrentViewRef.current();
            alert(`成功导入 ${data.imported_count} 个视频！`);
          } else {
            alert('导入失败，部分素材可能已导入，列表将刷新：' + data.error);
          }
        } catch (e) {
          alert('导入异常: ' + e.message);
        } finally {
          importLockRef.current = false;
          setIsImporting(false);
          setImportNotice('');
          await refreshCurrentViewRef.current();
        }
      };

      const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
          const res = await fetch('/api/video-manager/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newFolderName.trim(), parent_id: newFolderParentId || null })
          });
          const data = await res.json();
          if (data.success) {
            setShowNewFolderModal(false);
            setNewFolderName('');
            loadFolders();
          }
        } catch (e) {
          alert('创建分类失败: ' + e.message);
        }
      };

      const handleExportProject = async () => {
        if (!selectedVideo) return;
        try {
          const clips = (selectedVideo.shots || []).map(s => ({
            video_id: selectedVideo.id,
            in_point: s.start_time,
            out_point: s.end_time,
            description: s.visual_description
          }));

          const res = await fetch('/api/video-manager/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sequence_name: exportName || 'My_Edit',
              format: exportFormat,
              clips: clips.length > 0 ? clips : [{ video_id: selectedVideo.id, in_point: 0, out_point: selectedVideo.duration }]
            })
          });
          const data = await res.json();
          if (data.success) {
            alert(exportFormat === 'jianying'
              ? `已生成实验性视频草稿文件：\n${data.export_result.draft_folder || data.export_result.file_path}\n\n此文件不含音乐轨，尚未验证能否在剪映 11.7.3 打开；不会自动安装到剪映。`
              : `已生成工程文件（目标软件兼容性尚未验证）：\n${data.export_result.file_path || data.export_result.draft_folder}`);
            setShowExportModal(false);
          } else {
            alert('导出失败: ' + data.error);
          }
        } catch (e) {
          alert('导出异常: ' + e.message);
        }
      };

      const handleJumpToShot = (startTime) => {
        if (videoRef.current) {
          videoRef.current.currentTime = startTime;
          videoRef.current.play();
        }
      };

      // --- Precise Theme Styles with Guaranteed High Contrast ---
      const buttonPrimaryStyle = {
        padding: '5px 12px',
        fontSize: '12px',
        backgroundColor: '#2563eb', // Fixed solid high-contrast blue
        border: 'none',
        color: '#ffffff', // Crisp white text
        borderRadius: '5px',
        cursor: 'pointer',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0
      };

      const buttonSecondaryStyle = {
        padding: '5px 10px',
        fontSize: '12px',
        backgroundColor: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: '5px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0
      };

      const buttonGhostStyle = {
        padding: '4px 6px',
        fontSize: '12px',
        backgroundColor: 'transparent',
        border: 'none',
        color: 'var(--dsw-alias-label-secondary)',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      };

      const buttonDangerStyle = {
        padding: '5px 10px',
        fontSize: '12px',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        color: '#ef4444',
        borderRadius: '5px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0
      };

      const workbenchStyle = {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden'
      };

      const topbarStyle = {
        minHeight: '48px',
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        backgroundColor: 'var(--dsw-alias-bg-layer-1)',
        flexWrap: 'wrap',
        gap: '6px'
      };

      const bodyStyle = {
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        position: 'relative'
      };

      // Desktop Resizable vs Mobile column styles
      const leftColStyle = {
        width: isMobile ? '100%' : `${sidebarWidth}px`,
        minWidth: isMobile ? '100%' : '180px',
        maxWidth: isMobile ? '100%' : '500px',
        borderRight: isMobile ? 'none' : '1px solid var(--dsw-alias-border-l1)',
        display: (!isMobile || mobileTab === 'folders') ? 'flex' : 'none',
        flexDirection: 'column',
        backgroundColor: 'var(--dsw-alias-bg-layer-1)',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden'
      };

      const midColStyle = {
        flex: 1,
        width: isMobile ? '100%' : 'auto',
        display: (!isMobile || mobileTab === 'videos') ? 'flex' : 'none',
        flexDirection: 'column',
        borderRight: isMobile ? 'none' : '1px solid var(--dsw-alias-border-l1)',
        backgroundColor: 'var(--dsw-alias-bg-base)',
        overflow: 'hidden',
        height: '100%'
      };

      const rightColStyle = {
        width: isMobile ? '100%' : '440px',
        display: (!isMobile || mobileTab === 'detail') ? 'flex' : 'none',
        flexDirection: 'column',
        backgroundColor: 'var(--dsw-alias-bg-layer-1)',
        overflowY: 'auto',
        height: '100%'
      };

      const inputStyle = {
        padding: '6px 10px',
        backgroundColor: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: '5px',
        fontSize: '12px',
        outline: 'none'
      };

      const modalOverlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      };

      const modalCardStyle = {
        width: isMobile ? '95vw' : '660px',
        maxWidth: '95vw',
        maxHeight: isMobile ? '90vh' : '85vh',
        backgroundColor: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        padding: isMobile ? '14px' : '20px',
        borderRadius: '10px',
        border: '1px solid var(--dsw-alias-border-l2)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'hidden'
      };

      const contextMenuStyle = {
        position: 'absolute',
        backgroundColor: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '6px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        zIndex: 1000,
        minWidth: '150px',
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 0',
        overflow: 'hidden'
      };

      const contextMenuItemStyle = {
        padding: '7px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'var(--dsw-alias-label-primary)',
        backgroundColor: 'transparent'
      };

      // Checkbox helper
      const toggleVideoSelect = (id, e) => {
        e.stopPropagation();
        const next = new Set(selectedVideoIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedVideoIds(next);
      };

      const toggleSelectAll = () => {
        if (selectedVideoIds.size === videos.length && videos.length > 0) {
          setSelectedVideoIds(new Set());
        } else {
          setSelectedVideoIds(new Set(videos.map(v => v.id)));
        }
      };

      // Render Folder Recursive Tree (with Collapse/Expand & Icon Shrink Protection)
      const renderFolderNode = (folder, depth = 0) => {
        const isSelected = selectedFolderId === folder.id;
        const isMenuOpen = activeFolderMenuId === folder.id;
        const hasChildren = folder.children && folder.children.length > 0;
        const isCollapsed = collapsedFolderIds.has(folder.id);

        return h('div', { key: folder.id, style: { position: 'relative' } },
          h('div', {
            style: {
              padding: `7px 6px 7px ${6 + depth * 12}px`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isSelected ? 'rgba(37,99,235,0.12)' : 'transparent',
              color: isSelected ? '#2563eb' : 'var(--dsw-alias-label-primary)',
              borderRadius: '5px',
              margin: '2px 4px',
              fontSize: '13px',
              transition: 'background 0.15s ease'
            },
            onClick: () => handleFolderSelect(folder.id)
          },
            // Left block: Collapse arrow + Folder icon + Text (Guaranteed flexShrink: 0 on icons!)
            h('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden'
              }
            },
              // Expand/Collapse Triangle
              hasChildren
                ? h('button', {
                    title: isCollapsed ? '展开子目录' : '折叠子目录',
                    onClick: (e) => toggleFolderCollapse(folder.id, e),
                    style: {
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      cursor: 'pointer',
                      color: 'var(--dsw-alias-label-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0
                    }
                  },
                    isCollapsed ? Icon.chevronRight({ size: 11 }) : Icon.chevronDown({ size: 11 })
                  )
                : h('span', { style: { width: '15px', flexShrink: 0 } }),
              // Fixed-size Folder Icon (Never squeezed out!)
              h('span', { style: { flexShrink: 0, display: 'inline-flex', alignItems: 'center' } },
                Icon.folder({ size: 14, color: isSelected ? '#2563eb' : '#3b82f6' })
              ),
              // Name with ellipsis and title tooltip
              h('span', {
                title: folder.name,
                style: {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: isSelected ? 600 : 400,
                  flex: 1
                }
              }, folder.name)
            ),

            // Right block: Counts + More Menu Button
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 } },
              h('span', {
                style: {
                  fontSize: '11px',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                  color: 'var(--dsw-alias-label-secondary)'
                }
              }, `${folder.analyzedCount}/${folder.videoCount}`),
              h('button', {
                title: '分类操作',
                onClick: (e) => {
                  e.stopPropagation();
                  setActiveFolderMenuId(isMenuOpen ? null : folder.id);
                },
                style: { ...buttonGhostStyle, padding: '2px 4px' }
              }, Icon.moreVertical({ size: 13 }))
            )
          ),

          // Folder Popup Menu
          isMenuOpen && h('div', {
            style: { ...contextMenuStyle, top: '28px', right: '10px' },
            onClick: (e) => e.stopPropagation()
          },
            h('div', {
              style: contextMenuItemStyle,
              onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--dsw-alias-bg-layer-2)',
              onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
              onClick: () => {
                setActiveFolderMenuId(null);
                setRenamingFolder({ id: folder.id, name: folder.name });
              }
            }, Icon.edit({ size: 12 }), '重命名分类'),
            h('div', {
              style: contextMenuItemStyle,
              onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--dsw-alias-bg-layer-2)',
              onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
              onClick: () => {
                setActiveFolderMenuId(null);
                setNewFolderParentId(folder.id);
                setShowNewFolderModal(true);
              }
            }, Icon.plus({ size: 12 }), '新建子分类'),
            h('div', {
              style: { ...contextMenuItemStyle, color: '#ef4444' },
              onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)',
              onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
              onClick: () => {
                setActiveFolderMenuId(null);
                handleDeleteFolder(folder.id, folder.name);
              }
            }, Icon.trash({ size: 12, color: '#ef4444' }), '删除分类')
          ),

          // Render Children when NOT collapsed
          hasChildren && !isCollapsed &&
            h('div', null, folder.children.map(child => renderFolderNode(child, depth + 1)))
        );
      };

      return h('div', { ref: workbenchRef, style: workbenchStyle },
        // Topbar
        h('div', { style: topbarStyle },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            Icon.clapperboard({ size: 18, color: '#3b82f6' }),
            h('span', { style: { fontSize: '14px', fontWeight: 600 } }, '视频素材与分镜资产库'),
            status && status.binaries && h('span', {
              style: {
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                color: status.binaries.available ? '#22c55e' : '#eab308',
                border: `1px solid ${status.binaries.available ? '#22c55e' : '#eab308'}`
              }
            }, status.binaries.available ? 'FFmpeg 就绪' : 'FFmpeg 未配置')
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
            h('button', {
              type: 'button', style: buttonSecondaryStyle,
              onClick: () => setShowEditingWorkbench(true)
            }, Icon.scissors({ size: 13 }), '剪辑项目'),
            h('button', {
              style: buttonSecondaryStyle,
              onClick: () => { loadAiSettings(); loadShotAnalysisSettings(); setShowSettingsModal(true); }
            }, Icon.settings({ size: 13 }), '设置'),
            h('button', {
              style: buttonPrimaryStyle,
              onClick: () => setShowExportModal(true)
            }, Icon.scissors({ size: 13 }), isMobile ? '导出' : '导出剪辑工程')
          )
        ),

        // Mobile View Navigation Switcher
        isMobile && h('div', {
          style: {
            display: 'flex',
            backgroundColor: 'var(--dsw-alias-bg-layer-1)',
            borderBottom: '1px solid var(--dsw-alias-border-l1)',
            padding: '4px 8px',
            gap: '6px'
          }
        },
          [
            { id: 'folders', label: '分类目录', icon: Icon.folder({ size: 13 }) },
            { id: 'videos', label: `素材列表 (${videos.length})`, icon: Icon.grid({ size: 13 }) },
            { id: 'detail', label: '视频详情', icon: Icon.film({ size: 13 }) }
          ].map(tab => {
            const isActive = mobileTab === tab.id;
            return h('button', {
              key: tab.id,
              onClick: () => setMobileTab(tab.id),
              style: {
                flex: 1,
                padding: '7px 4px',
                border: 'none',
                borderRadius: '5px',
                backgroundColor: isActive ? '#2563eb' : 'var(--dsw-alias-bg-layer-2)',
                color: isActive ? '#ffffff' : 'var(--dsw-alias-label-primary)',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }
            }, tab.icon, tab.label);
          })
        ),

        // Body
        h('div', { style: bodyStyle },
          // Left Column: Folders
          h('div', { style: leftColStyle },
            h('div', { style: { padding: '10px', display: 'flex', gap: '6px', flexShrink: 0 } },
              h('button', {
                style: { ...buttonPrimaryStyle, flex: 1 },
                onClick: () => {
                  setShowScanModal(true);
                  loadBrowseDir(scanDirPath);
                }
              }, Icon.upload({ size: 13 }), '导入素材/目录'),
              h('button', {
                style: buttonSecondaryStyle,
                onClick: () => {
                  setNewFolderParentId(selectedFolderId || '');
                  setShowNewFolderModal(true);
                }
              }, Icon.plus({ size: 13 }), '分类')
            ),
            h('div', {
              style: {
                padding: '8px 10px',
                cursor: 'pointer',
                backgroundColor: selectedFolderId === null ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
                color: 'var(--dsw-alias-label-primary)',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '5px',
                margin: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0
              },
              onClick: () => handleFolderSelect(null)
            },
              Icon.grid({ size: 14, color: '#3b82f6' }),
              '全部视频素材'
            ),
            h('div', { style: { flex: 1, overflowY: 'auto' } },
              folders.map(f => renderFolderNode(f))
            )
          ),

          // Resizer Handle (Between Left and Middle Column on Desktop)
          !isMobile && h('div', {
            style: {
              width: '5px',
              backgroundColor: 'transparent',
              cursor: 'col-resize',
              transition: 'background-color 0.15s ease',
              flexShrink: 0,
              zIndex: 10
            },
            onMouseEnter: (e) => e.currentTarget.style.backgroundColor = '#2563eb',
            onMouseLeave: (e) => { if (!isDraggingRef.current) e.currentTarget.style.backgroundColor = 'transparent'; },
            onMouseDown: (e) => {
              isDraggingRef.current = true;
              document.body.style.userSelect = 'none';
              e.preventDefault();
            }
          }),

          // Middle Column: Video Grid with Batch Operations & Audit Tags
          h('div', { style: midColStyle },
            // Filter Bar
            h('div', {
              style: {
                padding: '8px 12px',
                borderBottom: '1px solid var(--dsw-alias-border-l1)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                backgroundColor: 'var(--dsw-alias-bg-layer-1)',
                flexWrap: 'wrap'
              }
            },
              h('input', {
                type: 'text',
                placeholder: '搜索文件名、摘要、标签...',
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value),
                onKeyDown: (e) => { if (e.key === 'Enter') loadVideos(selectedFolderId, searchQuery, statusFilter); },
                style: { ...inputStyle, flex: 1, minWidth: '160px' }
              }),
              h('select', {
                value: statusFilter,
                onChange: (e) => {
                  setStatusFilter(e.target.value);
                  loadVideos(selectedFolderId, searchQuery, e.target.value);
                },
                style: { ...inputStyle, minWidth: '85px' }
              },
                h('option', { value: '' }, '全部状态'),
                h('option', { value: 'imported' }, '待分析'),
                h('option', { value: 'analyzed' }, '已分析')
              ),
              // Sort Selector
              h('div', {
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0
                }
              },
                Icon.arrowUpDown({ size: 13, color: 'var(--dsw-alias-label-secondary)' }),
                h('select', {
                  value: sortRule,
                  onChange: (e) => {
                    const newRule = validateSortRule(e.target.value);
                    sortRuleRef.current = newRule;
                    setSortRule(newRule);
                    try {
                      window.localStorage.setItem(SORT_STORAGE_KEY, newRule);
                    } catch {
                      // Storage may be disabled; sorting still works for this mount.
                    }
                    const { sortBy: sBy, sortDir: sDir } = parseSortRule(newRule);
                    loadVideos(selectedFolderId, searchQuery, statusFilter, sBy, sDir);
                  },
                  title: '排序方式',
                  'aria-label': '排序方式',
                  style: {
                    ...inputStyle,
                    minWidth: isMobile ? '110px' : '150px',
                    cursor: 'pointer'
                  }
                },
                  h('option', { value: 'captured_at_desc' }, '拍摄时间 (最新)'),
                  h('option', { value: 'captured_at_asc' }, '拍摄时间 (最早)'),
                  h('option', { value: 'created_at_desc' }, '导入时间 (最新)'),
                  h('option', { value: 'created_at_asc' }, '导入时间 (最早)'),
                  h('option', { value: 'file_name_asc' }, '文件名 (A ➔ Z)'),
                  h('option', { value: 'file_name_desc' }, '文件名 (Z ➔ A)'),
                  h('option', { value: 'duration_desc' }, '视频时长 (长 ➔ 短)'),
                  h('option', { value: 'duration_asc' }, '视频时长 (短 ➔ 长)')
                )
              )
            ),

            // Batch Action Toolbar
            h('div', {
              style: {
                padding: '6px 12px',
                borderBottom: '1px solid var(--dsw-alias-border-l1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: selectedVideoIds.size > 0 ? 'rgba(37,99,235,0.08)' : 'transparent',
                fontSize: '12px',
                flexWrap: 'wrap',
                gap: '6px'
              }
            },
              h('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' } },
                h('input', {
                  type: 'checkbox',
                  checked: videos.length > 0 && selectedVideoIds.size === videos.length,
                  onChange: toggleSelectAll
                }),
                h('span', null, `全选 (${selectedVideoIds.size}/${videos.length})`)
              ),
              selectedVideoIds.size > 0 && h('div', { style: { display: 'flex', gap: '6px' } },
                h('button', {
                  style: buttonPrimaryStyle,
                  disabled: isBatchAiAnalyzing,
                  onClick: handleBatchAiAnalyze
                }, Icon.sparkles({ size: 12 }), isBatchAiAnalyzing ? '分析中...' : `批量 AI 分析 (${selectedVideoIds.size})`),
                h('button', {
                  style: buttonSecondaryStyle,
                  onClick: () => setShowBatchMoveModal(true)
                }, Icon.move({ size: 12 }), '移动'),
                h('button', {
                  style: buttonDangerStyle,
                  onClick: handleBatchDelete
                }, Icon.trash({ size: 12 }), '移出')
              )
            ),

            // Video Grid List
            h('div', {
              style: {
                flex: 1,
                overflowY: 'auto',
                padding: isMobile ? '8px' : '16px',
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '12px',
                alignContent: 'start'
              }
            },
              videos.map(v => {
                const isSelected = selectedVideo && selectedVideo.id === v.id;
                const isChecked = selectedVideoIds.has(v.id);
                const isMenuOpen = activeVideoMenuId === v.id;
                const isCurrentAnalyzing = aiAnalyzingId === v.id || v.status === 'analyzing';
                const isQueued = v.status === 'queued';
                const captureTime = captureTimePresentation(v, false);

                return h('div', {
                  key: v.id,
                  onClick: () => loadVideoDetail(v.id),
                  style: {
                    backgroundColor: 'var(--dsw-alias-bg-layer-1)',
                    borderRadius: '8px',
                    border: `2px solid ${isSelected ? '#2563eb' : 'var(--dsw-alias-border-l1)'}`,
                    cursor: 'pointer',
                    overflow: 'visible',
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,0.2)' : 'none'
                  }
                },
                  // Storyboard / Thumbnail
                  h('div', {
                    style: {
                      width: isMobile ? '130px' : '100%',
                      height: isMobile ? '95px' : '120px',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      borderRadius: isMobile ? '6px 0 0 6px' : '6px 6px 0 0',
                      flexShrink: 0
                    }
                  },
                    // Checkbox
                    h('input', {
                      type: 'checkbox',
                      checked: isChecked,
                      onClick: (e) => toggleVideoSelect(v.id, e),
                      style: {
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        zIndex: 10,
                        cursor: 'pointer',
                        transform: 'scale(1.15)'
                      }
                    }),
                    // Storyboard image
                    v.storyboard_path
                      ? h('img', {
                          src: `/api/video-manager/videos/${v.id}/storyboard?v=${encodeURIComponent(v.updated_at || '')}`,
                          style: { width: '100%', height: '100%', objectFit: 'cover' },
                          alt: v.file_name
                        })
                      : h('div', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: '11px' } }, '无故事板大图'),
                    // Duration badge
                    h('span', {
                      style: {
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        backgroundColor: 'rgba(0,0,0,0.75)',
                        color: '#fff',
                        fontSize: '9px',
                        padding: '1px 4px',
                        borderRadius: '3px'
                      }
                    }, formatDuration(v.duration)),
                    // Status Badge (High-contrast on any thumbnail in both light & dark themes)
                    h('span', {
                      style: {
                        position: 'absolute',
                        bottom: '4px',
                        left: '4px',
                        backgroundColor: isCurrentAnalyzing
                          ? 'rgba(245, 158, 11, 0.9)'
                          : v.status === 'analyzed'
                            ? 'rgba(34, 197, 94, 0.9)'
                            : 'rgba(51, 65, 85, 0.88)', // Slate-700 solid dark gray, never white in light theme
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 500,
                        backdropFilter: 'blur(2px)'
                      }
                    }, isQueued ? '排队中' : isCurrentAnalyzing ? '分析中...' : (v.status === 'analyzed' ? '已分析' : v.status === 'error' ? '分析失败' : '待分析'))
                  ),

                  // Popup Menu
                  isMenuOpen && h('div', {
                    style: { ...contextMenuStyle, top: isMobile ? '24px' : '32px', right: '6px' },
                    onClick: (e) => e.stopPropagation()
                  },
                    h('div', {
                      style: { ...contextMenuItemStyle, opacity: (isQueued || isCurrentAnalyzing) ? 0.5 : 1, cursor: (isQueued || isCurrentAnalyzing) ? 'not-allowed' : 'pointer' },
                      'aria-disabled': isQueued || isCurrentAnalyzing,
                      onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--dsw-alias-bg-layer-2)',
                      onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
                      onClick: () => {
                        if (isQueued || isCurrentAnalyzing) return;
                        setActiveVideoMenuId(null);
                        handleAiAnalyze(v.id);
                      }
                    }, Icon.sparkles({ size: 12, color: '#3b82f6' }), isQueued ? '排队中' : isCurrentAnalyzing ? '分析中...' : '直接 AI 深度分析'),
                    h('div', {
                      style: contextMenuItemStyle,
                      onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--dsw-alias-bg-layer-2)',
                      onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
                      onClick: () => {
                        setActiveVideoMenuId(null);
                        setSingleMoveVideoId(v.id);
                        setBatchTargetFolderId(v.folder_id || '');
                        setShowBatchMoveModal(true);
                      }
                    }, Icon.move({ size: 12 }), '移动到分类...'),
                    h('div', {
                      style: { ...contextMenuItemStyle, color: '#ef4444' },
                      onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)',
                      onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
                      onClick: () => {
                        setActiveVideoMenuId(null);
                        handleDeleteSingleVideo(v.id, v.file_name);
                      }
                    }, Icon.trash({ size: 12, color: '#ef4444' }), '移出素材库')
                  ),

                  // Meta Info with Audit Pill
                  h('div', {
                    style: {
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      flex: 1,
                      overflow: 'hidden'
                    }
                  },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
                      h('div', {
                        style: {
                          fontWeight: 600,
                          fontSize: '13px',
                          color: 'var(--dsw-alias-label-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        },
                        title: v.file_name
                      }, v.file_name),
                      h('button', {
                        title: '更多操作',
                        onClick: (e) => {
                          e.stopPropagation();
                          setActiveVideoMenuId(isMenuOpen ? null : v.id);
                        },
                        style: { ...buttonGhostStyle, padding: '2px 4px' }
                      }, Icon.moreVertical({ size: 13 }))
                    ),
                    h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', display: 'flex', gap: '8px' } },
                      h('span', null, `${v.width}x${v.height}`),
                      h('span', null, `${v.fps} fps`),
                      h('span', null, v.codec || 'MP4')
                    ),
                    h('div', {
                      style: {
                        fontSize: '11px',
                        color: 'var(--dsw-alias-label-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }
                    },
                      Icon.clock({ size: 10, color: 'var(--dsw-alias-label-secondary)' }),
                      h('span', { title: captureTime.title }, captureTime.text)
                    ),
                    // Audit Pill Badge
                    v.ai_model && h('div', {
                      style: {
                        fontSize: '10px',
                        color: '#3b82f6',
                        backgroundColor: 'rgba(59,130,246,0.08)',
                        border: '1px solid rgba(59,130,246,0.2)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '2px',
                        width: 'fit-content'
                      }
                    },
                      Icon.zap({ size: 10, color: '#3b82f6' }),
                      `${(v.ai_latency_ms ? v.ai_latency_ms / 1000 : 0).toFixed(1)}s`,
                      '·',
                      `${v.ai_total_tokens || 0} tok`,
                      '·',
                      v.ai_model
                    ),
                    v.folder_path && h('div', {
                      style: {
                        fontSize: '11px',
                        color: 'var(--dsw-alias-label-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }
                    },
                      Icon.folder({ size: 11 }),
                      v.folder_path
                    )
                  )
                );
              })
            )
          ),

          // Right Column: Detail Workstation
          h('div', { style: rightColStyle },
            selectedVideo
              ? h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
                  // Mobile Header with Return Button
                  isMobile && h('div', {
                    style: {
                      padding: '6px 10px',
                      backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                      borderBottom: '1px solid var(--dsw-alias-border-l1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }
                  },
                    h('button', {
                      style: { ...buttonSecondaryStyle, padding: '4px 8px', fontSize: '11px' },
                      onClick: () => setMobileTab('videos')
                    }, Icon.arrowLeft({ size: 12 }), '返回素材列表'),
                    h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, '当前预览与分析')
                  ),
                  // Video Player
                  h('div', {
                    style: {
                      width: '100%',
                      height: isMobile ? '180px' : '200px',
                      backgroundColor: '#000',
                      position: 'relative'
                    }
                  },
                    h('video', {
                      ref: videoRef,
                      src: `/api/video-manager/videos/${selectedVideo.id}/stream`,
                      controls: true,
                      style: { width: '100%', height: '100%' }
                    })
                  ),
                  // Detail Header & More Menu
                  h('div', {
                    style: {
                      padding: '8px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--dsw-alias-border-l1)',
                      position: 'relative'
                    }
                  },
                    h('div', { style: { fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '240px' : '320px' } },
                      selectedVideo.file_name
                    ),
                    h('button', {
                      title: '素材选项',
                      onClick: (e) => {
                        e.stopPropagation();
                        setActiveVideoMenuId(activeVideoMenuId === 'detail_menu' ? null : 'detail_menu');
                      },
                      style: { ...buttonSecondaryStyle, padding: '4px 8px' }
                    }, Icon.moreHorizontal({ size: 14 })),

                    // Detail Popup Menu
                    activeVideoMenuId === 'detail_menu' && h('div', {
                      style: { ...contextMenuStyle, top: '34px', right: '12px' },
                      onClick: (e) => e.stopPropagation()
                    },
                      h('div', {
                        style: contextMenuItemStyle,
                        onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--dsw-alias-bg-layer-2)',
                        onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
                        onClick: () => {
                          setActiveVideoMenuId(null);
                          setSingleMoveVideoId(selectedVideo.id);
                          setBatchTargetFolderId(selectedVideo.folder_id || '');
                          setShowBatchMoveModal(true);
                        }
                      }, Icon.move({ size: 12 }), '移动到分类...'),
                      h('div', {
                        style: { ...contextMenuItemStyle, color: '#ef4444' },
                        onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)',
                        onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
                        onClick: () => {
                          setActiveVideoMenuId(null);
                          handleDeleteSingleVideo(selectedVideo.id, selectedVideo.file_name);
                        }
                      }, Icon.trash({ size: 12, color: '#ef4444' }), '移出素材库')
                    )
                  ),

                  // Tab Buttons (Clean, without "可编辑" text)
                  h('div', {
                    style: {
                      display: 'flex',
                      borderBottom: '1px solid var(--dsw-alias-border-l1)',
                      backgroundColor: 'var(--dsw-alias-bg-layer-2)'
                    }
                  },
                    ['shots', 'audio', 'meta'].map(tab => {
                      const labels = { shots: '分镜解析', audio: '音频与提示', meta: '基础信息' };
                      const isTabActive = activeTab === tab;
                      return h('button', {
                        key: tab,
                        onClick: () => setActiveTab(tab),
                        style: {
                          flex: 1,
                          padding: '9px 0',
                          border: 'none',
                          borderBottom: isTabActive ? '2px solid #2563eb' : 'none',
                          backgroundColor: 'transparent',
                          color: isTabActive ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
                          fontWeight: isTabActive ? 600 : 400,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }
                      }, labels[tab]);
                    })
                  ),

                  // Tab Content Box
                  h('div', { style: { flex: 1, overflowY: 'auto', padding: '12px' } },
                    // Tab 1: Shots
                    activeTab === 'shots' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                        h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } },
                          `共 ${editingShots.length} 个分镜镜头`
                        ),
                        h('div', { style: { display: 'flex', gap: '6px' } },
                          !isEditingShots
                            ? h('button', {
                                style: buttonSecondaryStyle,
                                disabled: !!applyingShotRun,
                                onClick: () => { if (!applyingShotRunRef.current) setIsEditingShots(true); }
                              }, Icon.edit({ size: 12 }), '编辑分镜')
                            : h('button', {
                                style: buttonSecondaryStyle,
                                onClick: () => {
                                  const newIndex = editingShots.length + 1;
                                  const lastShot = editingShots[editingShots.length - 1];
                                  const start = lastShot ? lastShot.end_time : 0;
                                  setEditingShots([
                                    ...editingShots,
                                    {
                                      shot_index: newIndex,
                                      start_time: start,
                                      end_time: start + 3,
                                      shot_type: '中景',
                                      camera_movement: '固定',
                                      subject: '',
                                      visual_description: '',
                                      quality_score: 3.5
                                    }
                                  ]);
                                }
                              }, Icon.plus({ size: 12 }), '新增分镜'),
                          h('button', {
                            style: buttonPrimaryStyle,
                            disabled: aiAnalyzingId === selectedVideo.id || selectedVideo.status === 'analyzing' || selectedVideo.status === 'queued',
                            onClick: () => handleAiAnalyze(selectedVideo.id)
                          },
                            Icon.sparkles({ size: 12 }),
                            selectedVideo.status === 'queued' ? '排队中' : (aiAnalyzingId === selectedVideo.id || selectedVideo.status === 'analyzing') ? '分析中...' : 'AI 深度分析'
                          )
                        )
                      ),

                      // Shots List
                      editingShots.map((shot, idx) =>
                        h('div', {
                          key: idx,
                          style: {
                            minWidth: 0,
                            width: '100%',
                            boxSizing: 'border-box',
                            backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                            border: '1px solid var(--dsw-alias-border-l1)',
                            borderRadius: '6px',
                            padding: isMobile ? '10px' : '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }
                        },
                          // Header line
                          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '7px', minWidth: 0, width: '100%' } },
                            isEditingShots
                              ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                                  h('span', { style: { fontWeight: 600, fontSize: '12px' } }, `镜头 #${shot.shot_index}`),
                                  h('input', {
                                    type: 'number',
                                    value: shot.start_time,
                                    step: 0.1,
                                    onChange: (e) => {
                                      const updated = [...editingShots];
                                      updated[idx].start_time = parseFloat(e.target.value) || 0;
                                      setEditingShots(updated);
                                    },
                                    style: { ...inputStyle, width: '56px', padding: '2px 4px' }
                                  }),
                                  h('span', null, '-'),
                                  h('input', {
                                    type: 'number',
                                    value: shot.end_time,
                                    step: 0.1,
                                    onChange: (e) => {
                                      const updated = [...editingShots];
                                      updated[idx].end_time = parseFloat(e.target.value) || 0;
                                      setEditingShots(updated);
                                    },
                                    style: { ...inputStyle, width: '56px', padding: '2px 4px' }
                                  }),
                                  h('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '秒')
                                )
                              : h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0, width: '100%' } },
                                  h('span', { style: { fontWeight: 600, fontSize: '12px', color: 'var(--dsw-alias-label-primary)', minWidth: 0, overflowWrap: 'anywhere' } },
                                    `镜头 #${shot.shot_index} · ${formatDuration(shot.start_time)} – ${formatDuration(shot.end_time)}`
                                  ),
                                  h('span', {
                                    style: {
                                      fontSize: '10px',
                                      padding: '1px 5px',
                                      borderRadius: '3px',
                                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                      color: '#3b82f6'
                                    }
                                  }, shot.shot_type || '中景'),
                                  h('span', {
                                    style: {
                                      fontSize: '10px',
                                      padding: '1px 5px',
                                      borderRadius: '3px',
                                      backgroundColor: 'var(--dsw-alias-bg-base)',
                                      color: 'var(--dsw-alias-label-secondary)'
                                    }
                                  }, shot.camera_movement || '固定'),
                                  shot.quality_score && h('span', {
                                    style: {
                                      fontSize: '10px',
                                      padding: '1px 5px',
                                      borderRadius: '3px',
                                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                      color: '#22c55e'
                                    }
                                  }, `★ ${shot.quality_score}`)
                                ),
                            h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', width: '100%', minWidth: 0 } },
                              h('button', {
                                type: 'button',
                                style: { ...buttonPrimaryStyle, padding: '5px 9px', fontSize: '11px', minHeight: '30px', whiteSpace: 'nowrap' },
                                onClick: () => handleJumpToShot(shot.start_time)
                              }, Icon.play({ size: 11, fill: '#fff', color: '#fff' }), '播放片段'),
                              !isEditingShots && h('button', {
                                type: 'button',
                                style: { ...buttonSecondaryStyle, padding: '5px 9px', fontSize: '11px', minHeight: '30px', whiteSpace: 'nowrap' },
                                disabled: !shot.id || editingRef.current || !!applyingShotRun || !!shotRunLoading[shot.id] || hasActiveShotAnalysis(shot.id),
                                title: shot.id ? '对当前镜头时间范围进行精读' : '请先保存镜头',
                                onClick: () => handleShotDeepAnalysis(selectedVideo.id, shot.id)
                              }, Icon.sparkles({ size: 11 }), hasActiveShotAnalysis(shot.id) ? '分析中' : '深度分析'),
                              !isEditingShots && h('button', {
                                type: 'button',
                                style: { ...buttonSecondaryStyle, padding: '5px 9px', fontSize: '11px', minHeight: '30px', whiteSpace: 'nowrap' },
                                disabled: !shot.id,
                                onClick: () => {
                                  if (!openShotRun[shot.id] && !shotLocksRef.current.has(shot.id)) loadShotRuns(selectedVideo.id, shot.id);
                                  setOpenShotRun(current => ({ ...current, [shot.id]: !current[shot.id] }));
                                }
                              }, openShotRun[shot.id] ? '收起结果' : '分析记录'),
                              isEditingShots && h('button', {
                                style: { ...buttonDangerStyle, padding: '2px 6px', fontSize: '10px' },
                                onClick: () => {
                                  setEditingShots(editingShots.filter((_, i) => i !== idx));
                                }
                              }, Icon.trash({ size: 9 }))
                            )
                          ),

                          // Edit inputs
                          isEditingShots && h('div', { style: { display: 'flex', gap: '6px' } },
                            h('select', {
                              value: shot.shot_type || '中景',
                              onChange: (e) => {
                                const updated = [...editingShots];
                                updated[idx].shot_type = e.target.value;
                                setEditingShots(updated);
                              },
                              style: { ...inputStyle, flex: 1, padding: '3px 6px' }
                            },
                              ['特写', '大特写', '中景', '全景', '远景', '大远景'].map(st => h('option', { key: st, value: st }, `景别: ${st}`))
                            ),
                            h('select', {
                              value: shot.camera_movement || '固定',
                              onChange: (e) => {
                                const updated = [...editingShots];
                                updated[idx].camera_movement = e.target.value;
                                setEditingShots(updated);
                              },
                              style: { ...inputStyle, flex: 1, padding: '3px 6px' }
                            },
                              ['固定', '推镜头', '拉镜头', '摇镜头', '移镜头', '跟镜头', '航拍俯瞰推镜头', '升降镜头'].map(cm => h('option', { key: cm, value: cm }, `运镜: ${cm}`))
                            ),
                            h('input', {
                              type: 'number',
                              placeholder: '评分',
                              step: 0.1, min: 1, max: 5,
                              value: shot.quality_score || 3.5,
                              onChange: (e) => {
                                const updated = [...editingShots];
                                updated[idx].quality_score = parseFloat(e.target.value) || 3;
                                setEditingShots(updated);
                              },
                              style: { ...inputStyle, width: '60px', padding: '3px 6px' }
                            })
                          ),

                          // Description
                          isEditingShots
                            ? h('textarea', {
                                rows: 2,
                                value: shot.visual_description || '',
                                placeholder: '画面详细内容描述与情节...',
                                onChange: (e) => {
                                  const updated = [...editingShots];
                                  updated[idx].visual_description = e.target.value;
                                  setEditingShots(updated);
                                },
                                style: { ...inputStyle, resize: 'vertical', lineHeight: '1.4' }
                              })
                            : h('div', {
                                style: {
                                  fontSize: '12px',
                                  color: 'var(--dsw-alias-label-primary)',
                                  lineHeight: '1.5',
                                  marginTop: '2px'
                                }
                              }, shot.visual_description || '暂无详细描述'),
                          !isEditingShots && shot.id && openShotRun[shot.id] && renderShotAnalysis(shot, selectedVideo.id)
                        )
                      ),

                      // Edit mode action buttons
                      isEditingShots && h('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } },
                        h('button', {
                          style: { ...buttonSecondaryStyle, flex: 1, justifyContent: 'center' },
                          onClick: () => {
                            setIsEditingShots(false);
                            loadVideoDetail(selectedVideo.id);
                          }
                        }, '取消'),
                        h('button', {
                          style: { ...buttonPrimaryStyle, flex: 2, justifyContent: 'center' },
                          onClick: handleSaveShots
                        }, Icon.check({ size: 14 }), '保存分镜修改')
                      )
                    ),

                    // Tab 2: Audio & Cues
                    activeTab === 'audio' && editingAudio && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                        h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, '音频特征与字幕解析'),
                        !isEditingAudio && h('button', {
                          style: buttonSecondaryStyle,
                          onClick: () => setIsEditingAudio(true)
                        }, Icon.edit({ size: 12 }), '编辑音频')
                      ),

                      // Audio Overview
                      isEditingAudio
                        ? h('div', { style: { display: 'flex', gap: '8px' } },
                            h('div', { style: { flex: 1 } },
                              h('label', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '音乐节奏 BPM:'),
                              h('input', {
                                type: 'number',
                                value: editingAudio.bpm > 0 ? editingAudio.bpm : '',
                                placeholder: '未知',
                                onChange: (e) => setEditingAudio({ ...editingAudio, bpm: e.target.value === '' ? null : Number(e.target.value) }),
                                style: { ...inputStyle, width: '100%', marginTop: '3px' }
                              })
                            ),
                            h('div', { style: { flex: 1 } },
                              h('label', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '配乐类型:'),
                              h('select', {
                                value: editingAudio.bgm_type || '无',
                                onChange: (e) => setEditingAudio({ ...editingAudio, bgm_type: e.target.value }),
                                style: { ...inputStyle, width: '100%', marginTop: '3px' }
                              },
                                ['无', '纯人声', '背景音乐', '环境音', '民族交响配乐', '电子鼓点'].map(m => h('option', { key: m, value: m }, m))
                              )
                            ),
                            h('div', { style: { flex: 1 } },
                              h('label', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '音乐情绪:'),
                              h('input', {
                                type: 'text',
                                value: editingAudio.bgm_mood || '',
                                onChange: (e) => setEditingAudio({ ...editingAudio, bgm_mood: e.target.value }),
                                style: { ...inputStyle, width: '100%', marginTop: '3px' }
                              })
                            )
                          )
                        : h('div', {
                            style: {
                              display: 'flex',
                              gap: '12px',
                              backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }
                          },
                            h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
                              Icon.music({ size: 14, color: '#3b82f6' }),
                              `节奏 BPM: ${editingAudio.bpm > 0 ? `${editingAudio.bpm}（来源未确认）` : '未知'}`
                            ),
                            h('span', null, `配乐: ${editingAudio.bgm_type || '无'}`),
                            h('span', null, `情绪: ${editingAudio.bgm_mood || '自然'}`)
                          ),

                      // Silence intervals
                      h('div', {
                        style: {
                          fontWeight: 600,
                          fontSize: '12px',
                          marginTop: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }
                      },
                        Icon.volumeX({ size: 13, color: '#ef4444' }),
                        '静音停顿区间 (Silence Intervals)'
                      ),
                      (selectedVideo.audio?.silence_intervals || []).length > 0
                        ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
                            selectedVideo.audio.silence_intervals.map((si, i) =>
                              h('span', {
                                key: i,
                                style: {
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '3px'
                                }
                              }, `${si.start}s - ${si.end}s (${si.duration}s)`)
                            )
                          )
                        : h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '无明显停顿区间'),

                      // Transcripts
                      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' } },
                        h('div', {
                          style: {
                            fontWeight: 600,
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }
                        },
                          Icon.messageSquare({ size: 13, color: '#3b82f6' }),
                          '语音字幕转录 (Transcripts)'
                        ),
                        isEditingAudio && h('button', {
                          style: { ...buttonSecondaryStyle, padding: '2px 8px', fontSize: '11px' },
                          onClick: () => {
                            const current = editingAudio.transcripts || [];
                            const last = current[current.length - 1];
                            const start = last ? last.end : 0;
                            setEditingAudio({
                              ...editingAudio,
                              transcripts: [...current, { start, end: start + 2, text: '', speaker: '旁白' }]
                            });
                          }
                        }, Icon.plus({ size: 11 }), '新增字幕行')
                      ),

                      // Transcripts list
                      (editingAudio.transcripts || []).length > 0
                        ? editingAudio.transcripts.map((t, i) =>
                            isEditingAudio
                              ? h('div', {
                                  key: i,
                                  style: {
                                    display: 'flex',
                                    gap: '4px',
                                    alignItems: 'center',
                                    backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                                    padding: '6px',
                                    borderRadius: '4px'
                                  }
                                },
                                  h('input', {
                                    type: 'number',
                                    value: t.start,
                                    step: 0.1,
                                    onChange: (e) => {
                                      const trans = [...editingAudio.transcripts];
                                      trans[i].start = parseFloat(e.target.value) || 0;
                                      setEditingAudio({ ...editingAudio, transcripts: trans });
                                    },
                                    style: { ...inputStyle, width: '50px', padding: '2px 4px' }
                                  }),
                                  h('span', null, '-'),
                                  h('input', {
                                    type: 'number',
                                    value: t.end,
                                    step: 0.1,
                                    onChange: (e) => {
                                      const trans = [...editingAudio.transcripts];
                                      trans[i].end = parseFloat(e.target.value) || 0;
                                      setEditingAudio({ ...editingAudio, transcripts: trans });
                                    },
                                    style: { ...inputStyle, width: '50px', padding: '2px 4px' }
                                  }),
                                  h('input', {
                                    type: 'text',
                                    value: t.text || '',
                                    placeholder: '说话内容字幕...',
                                    onChange: (e) => {
                                      const trans = [...editingAudio.transcripts];
                                      trans[i].text = e.target.value;
                                      setEditingAudio({ ...editingAudio, transcripts: trans });
                                    },
                                    style: { ...inputStyle, flex: 1, padding: '2px 6px' }
                                  }),
                                  h('button', {
                                    style: { ...buttonDangerStyle, padding: '2px 5px' },
                                    onClick: () => {
                                      setEditingAudio({
                                        ...editingAudio,
                                        transcripts: editingAudio.transcripts.filter((_, idx) => idx !== i)
                                      });
                                    }
                                  }, Icon.trash({ size: 10 }))
                                )
                              : h('div', {
                                  key: i,
                                  style: {
                                    fontSize: '12px',
                                    color: 'var(--dsw-alias-label-primary)',
                                    padding: '6px 10px',
                                    backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                                    borderRadius: '5px',
                                    lineHeight: '1.4'
                                  }
                                },
                                  h('span', { style: { color: '#3b82f6', fontWeight: 500, marginRight: '6px' } }, `[${formatDuration(t.start)}]`),
                                  t.text
                                )
                          )
                        : h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '暂无语音转录字幕'),

                      isEditingAudio && h('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } },
                        h('button', {
                          style: { ...buttonSecondaryStyle, flex: 1, justifyContent: 'center' },
                          onClick: () => {
                            setIsEditingAudio(false);
                            loadVideoDetail(selectedVideo.id);
                          }
                        }, '取消'),
                        h('button', {
                          style: { ...buttonPrimaryStyle, flex: 2, justifyContent: 'center' },
                          onClick: handleSaveAudio
                        }, Icon.check({ size: 14 }), '保存音频修改')
                      )
                    ),

                    // Tab 3: Meta, Audit & Notes
                    activeTab === 'meta' && editingMeta && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                        h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, '视频资产属性与备注'),
                        !isEditingMeta && h('button', {
                          style: buttonSecondaryStyle,
                          onClick: () => setIsEditingMeta(true)
                        }, Icon.edit({ size: 12 }), '编辑信息')
                      ),

                      // AI Analysis Audit Card
                      selectedVideo.ai_model && h('div', {
                        style: {
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          borderRadius: '6px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          fontSize: '11px'
                        }
                      },
                        h('div', { style: { fontWeight: 600, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px' } },
                          Icon.zap({ size: 13, color: '#3b82f6' }),
                          'AI 深度分析审计报告'
                        ),
                        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', color: 'var(--dsw-alias-label-primary)' } },
                          h('div', null, h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, '分析模型: '), selectedVideo.ai_model),
                          h('div', null, h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, '执行耗时: '), `${((selectedVideo.ai_latency_ms || 0) / 1000).toFixed(2)} 秒`),
                          h('div', null, h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, 'Token 消耗: '), `${selectedVideo.ai_total_tokens || 0} tokens`),
                          h('div', null, h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, '输入 / 输出: '), `${selectedVideo.ai_prompt_tokens || 0} / ${selectedVideo.ai_completion_tokens || 0}`)
                        ),
                        selectedVideo.ai_analyzed_at && h('div', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: '10px' } },
                          `分析时间: ${selectedVideo.ai_analyzed_at.replace('T', ' ').slice(0, 19)}`
                        )
                      ),

                      isEditingMeta
                        ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                            h('div', null,
                              h('label', { style: { fontSize: '12px', fontWeight: 500 } }, '视频显示名称:'),
                              h('input', {
                                type: 'text',
                                value: editingMeta.file_name || '',
                                onChange: (e) => setEditingMeta({ ...editingMeta, file_name: e.target.value }),
                                style: { ...inputStyle, width: '100%', marginTop: '4px' }
                              })
                            ),
                            h('div', null,
                              h('label', { style: { fontSize: '12px', fontWeight: 500 } }, '所属分类目录:'),
                              h('select', {
                                value: editingMeta.folder_id || '',
                                onChange: (e) => setEditingMeta({ ...editingMeta, folder_id: e.target.value }),
                                style: { ...inputStyle, width: '100%', marginTop: '4px' }
                              },
                                h('option', { value: '' }, '根目录 (无特定分类)'),
                                flatFolderList.map(f => h('option', { key: f.id, value: f.id }, f.name))
                              )
                            ),
                            h('div', null,
                              h('label', { style: { fontSize: '12px', fontWeight: 500 } }, '全片画面与剧情概要 (Summary):'),
                              h('textarea', {
                                rows: 3,
                                value: editingMeta.summary || '',
                                placeholder: 'AI 或人工填写的全片情节与画面摘要...',
                                onChange: (e) => setEditingMeta({ ...editingMeta, summary: e.target.value }),
                                style: { ...inputStyle, width: '100%', marginTop: '4px', resize: 'vertical' }
                              })
                            ),
                            h('div', null,
                              h('label', { style: { fontSize: '12px', fontWeight: 500 } }, '剪辑备忘与人工备注 (User Notes):'),
                              h('textarea', {
                                rows: 2,
                                value: editingMeta.user_notes || '',
                                placeholder: '剪辑构思、音乐搭配、注意事项等备忘...',
                                onChange: (e) => setEditingMeta({ ...editingMeta, user_notes: e.target.value }),
                                style: { ...inputStyle, width: '100%', marginTop: '4px', resize: 'vertical' }
                              })
                            ),
                            // Tags
                            h('div', null,
                              h('label', { style: { fontSize: '12px', fontWeight: 500 } }, '业务标签 (Tags):'),
                              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '6px 0' } },
                                (editingMeta.tags || []).map((t, idx) =>
                                  h('span', {
                                    key: idx,
                                    style: {
                                      fontSize: '11px',
                                      padding: '2px 8px',
                                      backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                                      border: '1px solid var(--dsw-alias-border-l1)',
                                      borderRadius: '12px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }
                                  },
                                    t,
                                    h('span', {
                                      style: { cursor: 'pointer', color: '#f87171', fontWeight: 'bold' },
                                      onClick: () => {
                                        setEditingMeta({
                                          ...editingMeta,
                                          tags: editingMeta.tags.filter((_, i) => i !== idx)
                                        });
                                      }
                                    }, '×')
                                  )
                                )
                              ),
                              h('div', { style: { display: 'flex', gap: '6px' } },
                                h('input', {
                                  type: 'text',
                                  placeholder: '输入标签回车添加...',
                                  value: newTagInput,
                                  onChange: (e) => setNewTagInput(e.target.value),
                                  onKeyDown: (e) => {
                                    if (e.key === 'Enter' && newTagInput.trim()) {
                                      setEditingMeta({
                                        ...editingMeta,
                                        tags: [...new Set([...(editingMeta.tags || []), newTagInput.trim()])]
                                      });
                                      setNewTagInput('');
                                    }
                                  },
                                  style: { ...inputStyle, flex: 1 }
                                }),
                                h('button', {
                                  style: buttonSecondaryStyle,
                                  onClick: () => {
                                    if (newTagInput.trim()) {
                                      setEditingMeta({
                                        ...editingMeta,
                                        tags: [...new Set([...(editingMeta.tags || []), newTagInput.trim()])]
                                      });
                                      setNewTagInput('');
                                    }
                                  }
                                }, '添加标签')
                              )
                            ),
                            h('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } },
                              h('button', {
                                style: { ...buttonSecondaryStyle, flex: 1, justifyContent: 'center' },
                                onClick: () => {
                                  setIsEditingMeta(false);
                                  loadVideoDetail(selectedVideo.id);
                                }
                              }, '取消'),
                              h('button', {
                                style: { ...buttonPrimaryStyle, flex: 2, justifyContent: 'center' },
                                onClick: handleSaveMeta
                              }, Icon.check({ size: 14 }), '保存基本信息与备注')
                            )
                          )
                        : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' } },
                            h('div', { style: { padding: '8px 10px', backgroundColor: 'var(--dsw-alias-bg-layer-2)', borderRadius: '6px' } },
                              h('div', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: '11px', marginBottom: '3px' } }, '全片剧情与画面摘要 (Summary)'),
                              h('div', { style: { lineHeight: '1.5' } }, selectedVideo.summary || '暂无全局摘要，可点击上方「AI 深度分析」或「编辑」手动补充')
                            ),
                            h('div', { style: { padding: '8px 10px', backgroundColor: 'var(--dsw-alias-bg-layer-2)', borderRadius: '6px' } },
                              h('div', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: '11px', marginBottom: '3px' } }, '剪辑备忘与人工备注 (User Notes)'),
                              h('div', { style: { lineHeight: '1.5' } }, selectedVideo.user_notes || '暂无备注信息')
                            ),
                            h('div', { style: { padding: '8px 10px', backgroundColor: 'var(--dsw-alias-bg-layer-2)', borderRadius: '6px' } },
                              h('div', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: '11px', marginBottom: '4px' } }, '业务标签 (Tags)'),
                              (selectedVideo.tags || []).length > 0
                                ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
                                    selectedVideo.tags.map((t, idx) =>
                                      h('span', {
                                        key: idx,
                                        style: {
                                          fontSize: '11px',
                                          padding: '2px 8px',
                                          backgroundColor: 'var(--dsw-alias-bg-base)',
                                          border: '1px solid var(--dsw-alias-border-l1)',
                                          borderRadius: '12px'
                                        }
                                      }, t)
                                    )
                                  )
                                : h('div', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: '11px' } }, '暂无标签')
                            ),
                            // Technical Parameters Card
                            h('div', {
                              style: {
                                backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                                padding: '10px',
                                borderRadius: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                fontSize: '11px',
                                color: 'var(--dsw-alias-label-secondary)'
                              }
                            },
                              h('div', null, h('strong', null, '物理绝对路径 (不可篡改): '), h('span', { style: { wordBreak: 'break-all', color: 'var(--dsw-alias-label-primary)' } }, selectedVideo.file_path)),
                              h('div', null, h('strong', null, '文件大小: '), formatFileSize(selectedVideo.file_size)),
                              h('div', null, h('strong', null, '分辨率与帧率: '), `${selectedVideo.width}x${selectedVideo.height} @ ${selectedVideo.fps} fps`),
                              h('div', null, h('strong', null, '编码与码率: '), `${selectedVideo.codec} (${Math.round((selectedVideo.bitrate || 0) / 1000)} kbps)`),
                              h('div', null, h('strong', null, '所属分类目录: '), selectedVideo.folder_path || '根目录'),
                              h('div', { title: captureTimePresentation(selectedVideo).title }, h('strong', null, '拍摄时间: '), captureTimePresentation(selectedVideo).text),
                              h('div', null, h('strong', null, '导入时间: '), formatDateTime(selectedVideo.created_at, true) || '未知')
                            )
                          )
                    )
                  )
                )
              : h('div', {
                  style: {
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--dsw-alias-label-secondary)',
                    fontSize: '13px'
                  }
                }, '请在素材列表中选择一个视频')
          )
        ),

        // --- Modals ---
        showEditingWorkbench && h(EditingWorkbench, {
          isMobile,
          onClose: () => setShowEditingWorkbench(false),
          styles: { overlay: modalOverlayStyle, modal: modalCardStyle, input: inputStyle, primary: buttonPrimaryStyle, secondary: buttonSecondaryStyle }
        }),

        // 1. Rename Folder Modal
        renamingFolder && h('div', { style: modalOverlayStyle },
          h('div', { style: { ...modalCardStyle, width: isMobile ? '92vw' : '400px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              Icon.edit({ size: 18, color: '#3b82f6' }),
              h('h3', { style: { margin: 0, fontSize: '16px', fontWeight: 600 } }, '重命名分类目录')
            ),
            h('input', {
              type: 'text',
              value: renamingFolder.name,
              onChange: (e) => setRenamingFolder({ ...renamingFolder, name: e.target.value }),
              onKeyDown: (e) => {
                if (e.key === 'Enter') handleRenameFolder(renamingFolder.id, renamingFolder.name);
              },
              style: { ...inputStyle, width: '100%', marginTop: '6px' }
            }),
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' } },
              h('button', {
                style: buttonSecondaryStyle,
                onClick: () => setRenamingFolder(null)
              }, '取消'),
              h('button', {
                style: buttonPrimaryStyle,
                onClick: () => handleRenameFolder(renamingFolder.id, renamingFolder.name)
              }, Icon.check({ size: 13 }), '确定修改')
            )
          )
        ),

        // 2. Batch Move Folder Modal
        showBatchMoveModal && h('div', { style: modalOverlayStyle },
          h('div', { style: { ...modalCardStyle, width: isMobile ? '92vw' : '420px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              Icon.move({ size: 18, color: '#3b82f6' }),
              h('h3', { style: { margin: 0, fontSize: '16px', fontWeight: 600 } },
                singleMoveVideoId ? '移动素材到分类' : `批量移动素材 (${selectedVideoIds.size}个)`
              )
            ),
            h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } },
              '请选择目标分类目录（包含多级子场景）：'
            ),
            h('select', {
              value: batchTargetFolderId,
              onChange: (e) => setBatchTargetFolderId(e.target.value),
              style: { ...inputStyle, width: '100%', padding: '8px' }
            },
              h('option', { value: '' }, '根目录 (无特定分类)'),
              flatFolderList.map(f => h('option', { key: f.id, value: f.id }, f.name))
            ),
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' } },
              h('button', {
                style: buttonSecondaryStyle,
                onClick: () => {
                  setShowBatchMoveModal(false);
                  setSingleMoveVideoId(null);
                }
              }, '取消'),
              h('button', {
                style: buttonPrimaryStyle,
                onClick: async () => {
                  if (singleMoveVideoId) {
                    await fetch(`/api/video-manager/videos/${singleMoveVideoId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ folder_id: batchTargetFolderId || null })
                    });
                    setShowBatchMoveModal(false);
                    setSingleMoveVideoId(null);
                    loadFolders();
                    loadVideos(selectedFolderId, searchQuery, statusFilter);
                  } else {
                    handleBatchMove();
                  }
                }
              }, Icon.check({ size: 13 }), '确定移动')
            )
          )
        ),

        // 3. Upgraded Import Modal with Parent Folder Display & Loading Feedback
        showScanModal && h('div', { style: modalOverlayStyle },
          h('div', { style: modalCardStyle },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                Icon.upload({ size: 18, color: '#3b82f6' }),
                h('h3', { style: { margin: 0, fontSize: '15px', fontWeight: 600 } }, '导入视频素材')
              ),
              h('div', { style: { display: 'flex', gap: '6px' } },
                h('button', {
                  style: importTab === 'browse' ? buttonPrimaryStyle : buttonSecondaryStyle,
                  disabled: isImporting,
                  onClick: () => setImportTab('browse')
                }, Icon.compass({ size: 13 }), '图形化选择'),
                h('button', {
                  style: importTab === 'manual' ? buttonPrimaryStyle : buttonSecondaryStyle,
                  disabled: isImporting,
                  onClick: () => setImportTab('manual')
                }, Icon.edit({ size: 13 }), '手动填路径')
              )
            ),

            // Target Parent Folder Indicator (Fixes issue #2)
            h('div', {
              style: {
                padding: '6px 10px',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                borderRadius: '5px',
                fontSize: '11px',
                color: 'var(--dsw-alias-label-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }
            },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                h('span', { style: { color: '#3b82f6', fontWeight: 600 } }, '归属分类:'),
                h('span', null, currentSelectedFolder ? `将作为「${currentSelectedFolder.name}」的子目录导入` : '根目录 (作为顶级分类导入)')
              ),
              h('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: '10px' } },
                selectedFolderId ? '在左侧点击其他分类可切换' : ''
              )
            ),

            // Loading notification banner when importing
            isImporting && h('div', {
              style: {
                padding: '8px 12px',
                backgroundColor: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '5px',
                color: '#eab308',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }
            },
              Icon.loader({ size: 14, color: '#eab308' }),
              importNotice || '正在处理中，请稍候...'
            ),

            // Tab 1: Visual Browser
            importTab === 'browse' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflow: 'hidden' } },
              browserData && h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
                (browserData.drive_roots || []).map((d, i) =>
                  h('button', {
                    key: 'drive_' + i,
                    disabled: isImporting,
                    style: { ...buttonSecondaryStyle, padding: '3px 8px', fontSize: '11px' },
                    onClick: () => loadBrowseDir(d.path)
                  }, Icon.hardDrive({ size: 12 }), d.name)
                ),
                (browserData.quick_places || []).map((p, i) =>
                  h('button', {
                    key: 'quick_' + i,
                    disabled: isImporting,
                    style: { ...buttonSecondaryStyle, padding: '3px 8px', fontSize: '11px' },
                    onClick: () => loadBrowseDir(p.path)
                  }, Icon.folder({ size: 12 }), p.name)
                )
              ),

              browserData && h('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                  borderRadius: '5px',
                  border: '1px solid var(--dsw-alias-border-l1)',
                  fontSize: '12px'
                }
              },
                browserData.parent_path && h('button', {
                  disabled: isImporting,
                  style: { ...buttonSecondaryStyle, padding: '2px 6px', fontSize: '11px' },
                  onClick: () => loadBrowseDir(browserData.parent_path)
                }, Icon.arrowUp({ size: 12 }), '上一级'),
                h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, '当前目录:'),
                h('span', {
                  style: {
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }
                }, browserData.current_path)
              ),

              // File & Folder Explorer View
              h('div', {
                style: {
                  flex: 1,
                  minHeight: isMobile ? '160px' : '220px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  border: '1px solid var(--dsw-alias-border-l1)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--dsw-alias-bg-base)',
                  padding: '6px'
                }
              },
                browserLoading
                  ? h('div', { style: { padding: '20px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: '12px' } }, '正在读取目录...')
                  : browserData
                    ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
                        (browserData.folders || []).map(folder =>
                          h('div', {
                            key: folder.path,
                            style: {
                              padding: '6px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'transparent',
                              fontSize: '12px'
                            },
                            onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--dsw-alias-bg-layer-2)',
                            onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
                            onClick: () => { if (!isImporting) loadBrowseDir(folder.path); }
                          },
                            h('span', { style: { fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' } },
                              Icon.folder({ size: 14, color: '#3b82f6' }),
                              folder.name
                            ),
                            h('span', {
                              style: {
                                fontSize: '11px',
                                color: 'var(--dsw-alias-label-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }
                            },
                              '进入',
                              Icon.chevronRight({ size: 11 })
                            )
                          )
                        ),
                        // Video Files Header with Select All
                        (browserData.video_files || []).length > 0 && h('div', {
                          style: {
                            padding: '6px 10px',
                            backgroundColor: 'var(--dsw-alias-bg-layer-2)',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                            marginTop: (browserData.folders || []).length > 0 ? '6px' : '0',
                            marginBottom: '4px'
                          }
                        },
                          h('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' } },
                            h('input', {
                              type: 'checkbox',
                              disabled: isImporting,
                              checked: (browserData.video_files || []).length > 0 && selectedBrowserFiles.size === browserData.video_files.length,
                              onChange: toggleSelectAllBrowserFiles,
                              style: { cursor: 'pointer' }
                            }),
                            h('span', { style: { fontWeight: 500 } },
                              `全选当前目录所有视频 (${selectedBrowserFiles.size}/${browserData.video_files.length})`
                            )
                          ),
                          selectedBrowserFiles.size > 0 && h('span', { style: { color: '#2563eb', fontWeight: 600 } },
                            `已选 ${selectedBrowserFiles.size} 项`
                          )
                        ),

                        // Video File Items with Multi-select Checkbox
                        (browserData.video_files || []).map(file => {
                          const isSelected = selectedBrowserFiles.has(file.path);
                          return h('div', {
                            key: file.path,
                            style: {
                              padding: '6px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                              border: isSelected ? '1px solid rgba(37, 99, 235, 0.3)' : '1px solid transparent',
                              fontSize: '12px'
                            },
                            onMouseEnter: (e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--dsw-alias-bg-layer-2)'; },
                            onMouseLeave: (e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; },
                            onClick: () => { if (!isImporting) toggleBrowserFile(file.path); }
                          },
                            h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 } },
                              h('input', {
                                type: 'checkbox',
                                checked: isSelected,
                                disabled: isImporting,
                                onChange: () => {},
                                onClick: (e) => {
                                  e.stopPropagation();
                                  if (!isImporting) toggleBrowserFile(file.path);
                                },
                                style: { cursor: 'pointer', flexShrink: 0 }
                              }),
                              Icon.film({ size: 14, color: isSelected ? '#2563eb' : '#3b82f6' }),
                              h('span', {
                                title: file.name,
                                style: {
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: isSelected ? '#2563eb' : 'var(--dsw-alias-label-primary)',
                                  fontWeight: isSelected ? 600 : 400
                                }
                              }, `${file.name} [${file.ext}]`)
                            ),
                            h('span', {
                              style: {
                                fontSize: '11px',
                                color: 'var(--dsw-alias-label-secondary)',
                                flexShrink: 0
                              }
                            }, formatFileSize(file.size))
                          );
                        }),
                        (browserData.folders.length === 0 && browserData.video_files.length === 0) &&
                          h('div', { style: { padding: '20px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: '12px' } }, '当前目录无视频或子文件夹')
                      )
                    : null
              ),

              // Action Toolbar
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '6px' } },
                selectedBrowserFiles.size > 0
                  ? h('div', { style: { fontSize: '12px', color: '#2563eb', fontWeight: 600 } },
                      `已选 ${selectedBrowserFiles.size} 个视频文件`
                    )
                  : h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } },
                      '未勾选特定视频，将扫描导入当前文件夹及所有子目录'
                    ),
                h('div', { style: { display: 'flex', gap: '8px' } },
                  h('button', {
                    style: buttonSecondaryStyle,
                    disabled: isImporting,
                    onClick: () => setShowScanModal(false)
                  }, '取消'),
                  selectedBrowserFiles.size > 0
                    ? h('button', {
                        style: buttonPrimaryStyle,
                        disabled: isImporting,
                        onClick: () => handleImportSelectedFiles()
                      },
                        isImporting ? Icon.loader({ size: 13, color: '#fff' }) : Icon.upload({ size: 13 }),
                        isImporting ? '导入处理中...' : `导入所选视频 (${selectedBrowserFiles.size}个)`
                      )
                    : h('button', {
                        style: buttonPrimaryStyle,
                        disabled: isImporting,
                        onClick: () => handleScanDirectory(browserData ? browserData.current_path : null)
                      },
                        isImporting ? Icon.loader({ size: 13, color: '#fff' }) : Icon.upload({ size: 13 }),
                        isImporting ? '扫描处理中...' : '扫描导入当前文件夹'
                      )
                )
              )
            ),

            // Tab 2: Manual Path Input
            importTab === 'manual' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
              h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } },
                '输入要扫描的本地物理文件夹绝对路径。系统会自动按多级子目录（如 甘南环线旅游 -> 扎尕那）进行组织，并抽取视频参数与故事板。'
              ),
              h('input', {
                type: 'text',
                value: scanDirPath,
                disabled: isImporting,
                onChange: (e) => setScanDirPath(e.target.value),
                placeholder: '例如: D:\\Footages\\甘南环线旅游',
                style: { ...inputStyle, padding: '8px', fontSize: '13px' }
              }),
              h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' } },
                h('button', {
                  style: buttonSecondaryStyle,
                  disabled: isImporting,
                  onClick: () => setShowScanModal(false)
                }, '取消'),
                h('button', {
                  style: buttonPrimaryStyle,
                  disabled: isImporting,
                  onClick: () => handleScanDirectory(scanDirPath)
                },
                  isImporting ? Icon.loader({ size: 13, color: '#fff' }) : Icon.upload({ size: 13 }),
                  isImporting ? '扫描处理中...' : '开始扫描导入'
                )
              )
            )
          )
        ),

        // 4. Settings Modal with AI Config & Prompt Template
        showSettingsModal && h('div', { style: modalOverlayStyle },
          h('div', { style: { ...modalCardStyle, width: isMobile ? '95vw' : '600px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              Icon.settings({ size: 18, color: '#3b82f6' }),
              h('h3', { style: { margin: 0, fontSize: '16px', fontWeight: 600 } }, '插件设置与 AI 分析配置')
            ),

            // Settings Content with Scroll
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto', paddingRight: '4px' } },
              // Section 1: FFmpeg
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                h('div', { style: { fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, '1. 媒体引擎环境 (FFmpeg / FFprobe)'),
                h('div', { style: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' } },
                  h('div', null,
                    h('label', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, 'FFmpeg 绝对路径:'),
                    h('input', {
                      type: 'text',
                      value: ffmpegInput,
                      onChange: (e) => setFfmpegInput(e.target.value),
                      placeholder: '自动检测或如 C:\\ffmpeg\\bin\\ffmpeg.exe',
                      style: { ...inputStyle, width: '100%', marginTop: '3px' }
                    })
                  ),
                  h('div', null,
                    h('label', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, 'FFprobe 绝对路径:'),
                    h('input', {
                      type: 'text',
                      value: ffprobeInput,
                      onChange: (e) => setFfprobeInput(e.target.value),
                      placeholder: '自动检测或如 C:\\ffmpeg\\bin\\ffprobe.exe',
                      style: { ...inputStyle, width: '100%', marginTop: '3px' }
                    })
                  )
                )
              ),

              // Section 2: AI Multi-modal Model
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                h('div', { style: { fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, '2. AI 视觉大模型配置'),
                h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
                  'DSH 模式使用所选服务商及模型的配置；自定义模式使用单独填写的兼容端点。模型未声明图片能力时，请自行确认支持图片。'
                ),
                aiMode === 'dsh' && h('button', { type: 'button', style: buttonSecondaryStyle, onClick: loadAiCatalog }, '刷新 DSH 模型列表'),
                aiCatalogWarning && h('div', { role: 'alert', style: { color: 'var(--dsw-alias-label-primary)', fontSize: '11px' } }, aiCatalogWarning),
                h('label', { style: { fontSize: '11px' } }, '模型来源',
                  h('select', {
                    value: aiMode,
                    onChange: e => { setAiMode(e.target.value); setAiProviderInput(''); setAiModelInput(''); setAiReasoningInput(''); },
                    style: { ...inputStyle, width: '100%', marginTop: '3px' }
                  },
                    h('option', { value: 'dsh' }, 'DSH 已配置模型'),
                    h('option', { value: 'custom' }, '自定义 OpenAI 兼容端点')
                  )
                ),
                aiMode === 'dsh' ? h('div', { style: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' } },
                  h('label', { style: { fontSize: '11px' } }, 'DSH 服务商',
                    h('select', {
                      value: aiProviderInput,
                      onChange: e => { setAiProviderInput(e.target.value); setAiModelInput(''); setAiReasoningInput(''); },
                      style: { ...inputStyle, width: '100%', marginTop: '3px' }
                    },
                      h('option', { value: '' }, '请选择服务商'),
                      aiProviderInput && !aiProviders.some(p => p.id === aiProviderInput) &&
                        h('option', { value: aiProviderInput, disabled: true }, `${aiProviderInput}（当前不可用）`),
                      aiProviders.map(p => h('option', { key: p.id, value: p.id }, p.name || p.id))
                    )
                  ),
                  h('label', { style: { fontSize: '11px' } }, '模型',
                    h('select', {
                      value: aiModelInput,
                      onChange: e => { setAiModelInput(e.target.value); setAiReasoningInput(''); },
                      style: { ...inputStyle, width: '100%', marginTop: '3px' }
                    },
                      h('option', { value: '' }, '请选择模型'),
                      !(aiProviders.find(p => p.id === aiProviderInput)?.models || []).some(m => m.id === aiModelInput) && aiModelInput &&
                        h('option', { value: aiModelInput, disabled: true }, `${aiModelInput}（当前不可用）`),
                      (aiProviders.find(p => p.id === aiProviderInput)?.models || []).map(m =>
                        h('option', { key: m.id, value: m.id, disabled: Array.isArray(m.inputModalities) && !m.inputModalities.includes('image') },
                          `${m.name || m.id}${Array.isArray(m.inputModalities) ? (m.inputModalities.includes('image') ? '' : '（不支持图片）') : '（图片能力未声明）'}`)
                      )
                    )
                  ),
                  h('label', { style: { fontSize: '11px' } }, '推理档位',
                    h('select', {
                      value: aiReasoningInput,
                      onChange: e => setAiReasoningInput(e.target.value),
                      disabled: !aiModelInput || !(aiProviders.find(p => p.id === aiProviderInput)?.models || []).find(m => m.id === aiModelInput)?.reasoning?.efforts?.length,
                      style: { ...inputStyle, width: '100%', marginTop: '3px' }
                    },
                      h('option', { value: '' }, '请选择推理档位'),
                      aiReasoningInput && !(aiProviders.find(p => p.id === aiProviderInput)?.models || []).find(m => m.id === aiModelInput)?.reasoning?.efforts?.some(e => e.id === aiReasoningInput) &&
                        h('option', { value: aiReasoningInput, disabled: true }, `${aiReasoningInput}（当前不可用）`),
                      ((aiProviders.find(p => p.id === aiProviderInput)?.models || []).find(m => m.id === aiModelInput)?.reasoning?.efforts || []).map(e =>
                        h('option', { key: e.id, value: e.id }, e.name || e.id)
                      )
                    ),
                    h('div', { style: { marginTop: '3px', color: 'var(--dsw-alias-label-secondary)' } },
                      !aiModelInput ? '请先选择服务商和模型。' :
                      (aiProviders.find(p => p.id === aiProviderInput)?.models || []).find(m => m.id === aiModelInput)?.reasoning_unavailable ? '无法读取模型能力，请刷新模型列表。' :
                      (aiProviders.find(p => p.id === aiProviderInput)?.models || []).find(m => m.id === aiModelInput)?.reasoning?.efforts?.length ? '请选择档位；请求将直接使用该档位，不会自动换档重试。' : '该模型未声明可选择的推理档位。'
                    )
                  )
                ) : h('div', { style: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' } },
                  h('label', { style: { fontSize: '11px' } }, '自定义模型名称',
                    h('input', { type: 'text', value: aiModelInput, onChange: e => setAiModelInput(e.target.value), style: { ...inputStyle, width: '100%' } })
                  ),
                  h('label', { style: { fontSize: '11px' } }, 'API 基础端点',
                    h('input', { type: 'text', value: aiBaseUrlInput, onChange: e => setAiBaseUrlInput(e.target.value), placeholder: 'https://example.com/v1', style: { ...inputStyle, width: '100%' } })
                  ),
                  h('label', { style: { fontSize: '11px' } }, 'API Key（留空保留已有值）',
                    h('input', { type: 'password', value: aiApiKeyInput, onChange: e => setAiApiKeyInput(e.target.value), autoComplete: 'new-password', style: { ...inputStyle, width: '100%' } })
                  )
                )
              ),

              // Section 3: Prompt Template
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                  h('div', { style: { fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, '3. AI 视频分析提示词模板 (Prompt)'),
                  h('button', {
                    style: { ...buttonSecondaryStyle, padding: '2px 8px', fontSize: '10px' },
                    onClick: () => setAiPromptTemplate(defaultPromptText)
                  }, '恢复默认提示词')
                ),
                h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
                  '支持变量动态注入：{{video_name}}, {{duration}}, {{resolution}}, {{fps}}, {{folder_name}}'
                ),
                h('textarea', {
                  rows: 8,
                  value: aiPromptTemplate,
                  onChange: (e) => setAiPromptTemplate(e.target.value),
                  style: { ...inputStyle, resize: 'vertical', lineHeight: '1.4', fontFamily: 'monospace', fontSize: '11px' }
                })
              ),
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
                  h('div', { style: { fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, '4. 镜头深度分析提示词'),
                  h('button', { type: 'button', style: { ...buttonSecondaryStyle, padding: '2px 8px', fontSize: '10px' }, disabled: !shotPromptLoaded, onClick: () => setShotPrompt(shotDefaultPrompt) }, '恢复镜头默认提示词')
                ),
                h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '仅影响镜头精读；修改后点击“保存全部配置”才会生效。'),
                shotPromptError && h('div', { role: 'alert', style: { fontSize: '11px', color: 'var(--dsw-alias-label-primary)' } }, shotPromptError,
                  h('button', { type: 'button', style: buttonSecondaryStyle, onClick: loadShotAnalysisSettings }, '重试读取')),
                h('textarea', { 'aria-label': '镜头深度分析提示词', rows: 8, value: shotPrompt, disabled: !shotPromptLoaded,
                  onChange: e => setShotPrompt(e.target.value),
                  style: { ...inputStyle, resize: 'vertical', lineHeight: '1.4', fontFamily: 'monospace', fontSize: '11px' } })
              )
            ),

            // Modal Footer
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' } },
              h('button', {
                style: buttonSecondaryStyle,
                onClick: () => setShowSettingsModal(false)
              }, '取消'),
              h('button', {
                style: buttonPrimaryStyle,
                onClick: handleSaveSettings
              }, Icon.check({ size: 13 }), '保存全部配置')
            )
          )
        ),

        // 5. New Folder Modal
        showNewFolderModal && h('div', { style: modalOverlayStyle },
          h('div', { style: { ...modalCardStyle, width: isMobile ? '92vw' : '400px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              Icon.folderPlus({ size: 18, color: '#3b82f6' }),
              h('h3', { style: { margin: 0, fontSize: '16px', fontWeight: 600 } }, '新建分类目录')
            ),
            h('label', { style: { fontSize: '12px' } }, '分类名称:'),
            h('input', {
              type: 'text',
              value: newFolderName,
              onChange: (e) => setNewFolderName(e.target.value),
              placeholder: '如: 甘加秘境 / 人物特写',
              style: inputStyle
            }),
            h('label', { style: { fontSize: '12px' } }, '归属父目录 (留空为顶级项目):'),
            h('select', {
              value: newFolderParentId,
              onChange: (e) => setNewFolderParentId(e.target.value),
              style: inputStyle
            },
              h('option', { value: '' }, '顶级目录 (一级项目)'),
              flatFolderList.map(f => h('option', { key: f.id, value: f.id }, f.name))
            ),
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' } },
              h('button', {
                style: buttonSecondaryStyle,
                onClick: () => setShowNewFolderModal(false)
              }, '取消'),
              h('button', {
                style: buttonPrimaryStyle,
                onClick: handleCreateFolder
              }, Icon.plus({ size: 13 }), '创建')
            )
          )
        ),

        // 6. Export Modal
        showExportModal && h('div', { style: modalOverlayStyle },
          h('div', { style: { ...modalCardStyle, width: isMobile ? '92vw' : '460px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              Icon.scissors({ size: 18, color: '#3b82f6' }),
              h('h3', { style: { margin: 0, fontSize: '16px', fontWeight: 600 } }, '导出剪辑软件工程')
            ),
            h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } },
              '将当前视频分镜时间线一键导出为工程文件，直接在剪辑软件中打开。'
            ),
            h('label', { style: { fontSize: '12px' } }, '工程/草稿名称:'),
            h('input', {
              type: 'text',
              value: exportName,
              onChange: (e) => setExportName(e.target.value),
              style: inputStyle
            }),
            h('label', { style: { fontSize: '12px' } }, '目标剪辑软件格式:'),
            h('select', {
              value: exportFormat,
              onChange: (e) => setExportFormat(e.target.value),
              style: inputStyle
            },
              h('option', { value: 'jianying' }, '剪映电脑版本地草稿 (JianYing Draft)'),
              h('option', { value: 'fcpxml' }, 'Final Cut Pro / Premiere XML (FCPXML)'),
              h('option', { value: 'edl' }, '通用 EDL (CMX 3600)')
            ),
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' } },
              h('button', {
                style: buttonSecondaryStyle,
                onClick: () => setShowExportModal(false)
              }, '取消'),
              h('button', {
                style: buttonPrimaryStyle,
                onClick: handleExportProject
              }, Icon.scissors({ size: 13 }), '立即导出')
            )
          )
        )
      );
    }

    // --- Panel Icon for sidebar.panellist ---
    function PanelIcon(props) {
      const size = props?.size || 20;
      const active = !!props?.active;
      const color = active ? 'var(--dsw-static-deepseek-500, #3b82f6)' : 'currentColor';
      return Icon.clapperboard({ size, color });
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // Register sidebar panel icon
        ctx.slots.inject('sidebar.panellist', () => {
          return ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'video-manager',
            order: 35,
            label: () => '视频资产库'
          }, PanelIcon);
        });

        // Register main view workstation
        ctx.slots.inject('main', () => {
          return ctx.slots.register({
            name: 'main',
            key: 'video-manager'
          }, VideoManagerWorkbench);
        });
      }
    };
  }
});
