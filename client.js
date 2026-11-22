window.__ModuleLoader__.load({
  id: '@local/dsh-media-center',
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

    const SORT_STORAGE_KEY = 'dsh-media-center.sortRule';
    const MAX_MUSIC_ANALYSIS_SECONDS = 600;
    const MAX_MUSIC_IMPORT_BATCH = 50;
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

    const LIBRARY_TABS = [
      // Keep this registry data-driven so a future image library can join the same centered tab bar.
      { id: 'video', label: '视频库', shortLabel: '视频', icon: 'clapperboard' },
      { id: 'music', label: '音乐库', shortLabel: '音乐', icon: 'music' }
    ];

    function LibraryPageTabs({ active, onSelect, isMobile }) {
      return h('div', {
        role: 'tablist',
        'aria-label': '媒体中心页面',
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px',
          border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '7px',
          backgroundColor: 'var(--dsw-alias-bg-layer-2)', whiteSpace: 'nowrap'
        }
      }, LIBRARY_TABS.map(tab => {
        const TabIcon = Icon[tab.icon];
        const selected = active === tab.id;
        return h('button', {
          key: tab.id, type: 'button', role: 'tab',
          'aria-label': `切换到${tab.label}`, 'aria-selected': selected,
          onClick: () => onSelect(tab.id),
          style: {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            minHeight: '34px', padding: isMobile ? '5px 8px' : '5px 11px',
            border: selected ? '1px solid var(--dsw-alias-border-l2)' : '1px solid transparent',
            borderRadius: '5px',
            backgroundColor: selected ? 'var(--dsw-alias-bg-layer-1)' : 'transparent',
            color: 'var(--dsw-alias-label-primary)', fontSize: '12px',
            fontWeight: selected ? 600 : 400, cursor: 'pointer'
          }
        }, TabIcon({ size: 14 }), isMobile ? tab.shortLabel : tab.label);
      }));
    }

    function renderMediaLibraryHeader({ active, onSelect, isMobile, status, onSettings, buttonStyle }) {
      const binaries = status?.binaries;
      return h('header', {
        'aria-label': '媒体中心通用标题栏',
        style: {
          minHeight: isMobile ? '48px' : '54px', flexShrink: 0,
          borderBottom: '1px solid var(--dsw-alias-border-l1)',
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          alignItems: 'center', gap: isMobile ? '4px' : '10px',
          padding: isMobile ? '0 7px' : '0 14px',
          backgroundColor: 'var(--dsw-alias-bg-layer-1)', position: 'relative', zIndex: 20
        }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: isMobile ? '5px' : '8px', minWidth: 0 } },
          Icon.hardDrive({ size: isMobile ? 17 : 19, color: '#3b82f6' }),
          h('strong', { style: { fontSize: isMobile ? '12px' : '14px', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, '媒体中心'),
          !isMobile && binaries && h('span', {
            style: {
              fontSize: '10px', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap',
              backgroundColor: 'var(--dsw-alias-bg-layer-2)',
              color: binaries.available ? '#22c55e' : '#eab308',
              border: `1px solid ${binaries.available ? '#22c55e' : '#eab308'}`
            }
          }, binaries.available ? 'FFmpeg 就绪' : 'FFmpeg 未配置')
        ),
        h('div', { style: { justifySelf: 'center', minWidth: 0, display: 'flex', justifyContent: 'center' } },
          LibraryPageTabs({ active, onSelect, isMobile })
        ),
        h('div', { style: { justifySelf: 'end', display: 'flex', alignItems: 'center', minWidth: 0 } },
          h('button', {
            type: 'button', 'aria-label': '媒体中心设置', title: '设置', style: buttonStyle,
            onClick: onSettings
          }, Icon.settings({ size: 13 }), !isMobile && '设置')
        )
      );
    }

    function renderLibrarySectionHeader({ icon, title, description, actions }) {
      return h('div', {
        style: {
          minHeight: '48px', flexShrink: 0, padding: '0 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          borderBottom: '1px solid var(--dsw-alias-border-l1)',
          backgroundColor: 'var(--dsw-alias-bg-layer-1)'
        }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
          icon({ size: 17, color: '#3b82f6' }),
          h('strong', { style: { fontSize: '14px', whiteSpace: 'nowrap' } }, title),
          description && h('span', {
            style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
          }, description)
        ),
        actions && h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 } }, actions)
      );
    }

    function renderMobilePanelNavigation({ isMobile, active, onSelect, labels }) {
      if (!isMobile) return null;
      return h('div', {
        'aria-label': '当前媒体库面板',
        style: {
          display: 'flex', flexShrink: 0, backgroundColor: 'var(--dsw-alias-bg-layer-1)',
          borderBottom: '1px solid var(--dsw-alias-border-l1)', padding: '4px 8px', gap: '6px'
        }
      }, labels.map(tab => {
        const selected = active === tab.id;
        return h('button', {
          key: tab.id, type: 'button', 'aria-pressed': selected,
          onClick: () => onSelect(tab.id),
          style: {
            flex: 1, minWidth: 0, padding: '7px 4px', border: 'none', borderRadius: '5px',
            backgroundColor: selected ? '#2563eb' : 'var(--dsw-alias-bg-layer-2)',
            color: selected ? '#ffffff' : 'var(--dsw-alias-label-primary)',
            fontSize: '12px', fontWeight: selected ? 600 : 400, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
          }
        }, tab.icon, h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, tab.label));
      }));
    }

    function renderLibraryColumnLayout({ bodyStyle, isMobile, onResizeStart, isDraggingRef, columns }) {
      return h('div', { style: bodyStyle },
        columns[0],
        !isMobile && h('div', {
          'aria-label': '调整目录栏宽度',
          style: { width: '5px', backgroundColor: 'transparent', cursor: 'col-resize', flexShrink: 0, zIndex: 10 },
          onMouseEnter: e => { e.currentTarget.style.backgroundColor = '#2563eb'; },
          onMouseLeave: e => { if (!isDraggingRef?.current) e.currentTarget.style.backgroundColor = 'transparent'; },
          onMouseDown: onResizeStart
        }),
        ...columns.slice(1)
      );
    }

    function renderImportMethodTabs({ active, onSelect, disabled, secondaryStyle, primaryStyle }) {
      return h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        h('button', {
          type: 'button', style: active === 'browse' ? primaryStyle : secondaryStyle, disabled,
          onClick: () => onSelect('browse')
        }, Icon.compass({ size: 13 }), '图形化选择'),
        h('button', {
          type: 'button', style: active === 'manual' ? primaryStyle : secondaryStyle, disabled,
          onClick: () => onSelect('manual')
        }, Icon.edit({ size: 13 }), '手动填路径')
      );
    }

    function renderAssetImportDialog({ isMobile, overlayStyle, cardStyle, ariaLabel, children }) {
      const overlay = overlayStyle || {
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
      };
      const card = cardStyle || {
        width: isMobile ? '95vw' : '660px', maxWidth: '95vw', maxHeight: isMobile ? '90vh' : '85vh',
        backgroundColor: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
        padding: isMobile ? '14px' : '20px', borderRadius: '10px',
        border: '1px solid var(--dsw-alias-border-l2)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden'
      };
      return h('div', { style: overlay }, h('div', { style: card, role: 'dialog', 'aria-modal': true, 'aria-label': ariaLabel || '导入媒体资源' },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0, overflowY: 'auto' } }, children)
      ));
    }

    function MusicLibraryWorkbench({ isMobile, mobileTab, setMobileTab, layout, styles, onResizeStart, isDraggingRef }) {
      const [items,setItems]=useState([]);
      const [selectedId,setSelectedId]=useState('');
      const [profile,setProfile]=useState(null);
      const [analysisId,setAnalysisId]=useState('');
      const [loading,setLoading]=useState(false);
      const [busy,setBusy]=useState('');
      const [error,setError]=useState('');
      const [notice,setNotice]=useState('');
      const [query,setQuery]=useState('');
      const [licenseFilter,setLicenseFilter]=useState('all');
      const [analysisFilter,setAnalysisFilter]=useState('all');
      const [styleFilter,setStyleFilter]=useState('all');
      const [bpmMin,setBpmMin]=useState('');
      const [bpmMax,setBpmMax]=useState('');
      const [filePath,setFilePath]=useState('');
      const [musicTitle,setMusicTitle]=useState('');
      const [artist,setArtist]=useState('');
      const [licenseNote,setLicenseNote]=useState('');
      const [browser,setBrowser]=useState(null);
      const [showBrowser,setShowBrowser]=useState(false);
      const [selectedAudioPaths,setSelectedAudioPaths]=useState(new Set());
      const [importProgress,setImportProgress]=useState({completed:0,total:0});
       const [showImportModal,setShowImportModal]=useState(false);
      const [importTab,setImportTab]=useState('browse');
      const [selectedDirectory,setSelectedDirectory]=useState('');
      const [collapsedDirectories,setCollapsedDirectories]=useState(new Set());
      const [startSeconds,setStartSeconds]=useState(0);
      const [durationSeconds,setDurationSeconds]=useState(60);
      const [selectedCandidates,setSelectedCandidates]=useState(new Set());
       const [modelInterpretationDraft,setModelInterpretationDraft]=useState(null);
       const [selectedModelBeatSuggestions,setSelectedModelBeatSuggestions]=useState(new Set());
      const lock=useRef(false);
      const fieldStyle=styles?.inputStyle||{backgroundColor:'var(--dsw-alias-bg-layer-2)',color:'var(--dsw-alias-label-primary)',border:'1px solid var(--dsw-alias-border-l2)',borderRadius:'5px',padding:'7px 9px',fontSize:'12px',width:'100%',boxSizing:'border-box'};
      const secondary=styles?.buttonSecondaryStyle||{backgroundColor:'var(--dsw-alias-bg-layer-2)',color:'var(--dsw-alias-label-primary)',border:'1px solid var(--dsw-alias-border-l2)',borderRadius:'5px',padding:'6px 9px',fontSize:'12px',cursor:'pointer',minHeight:'34px'};
      const primary=styles?.buttonPrimaryStyle||{...secondary,backgroundColor:'#2563eb',border:'1px solid #2563eb',color:'#fff',fontWeight:600};
      const listPre={whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:'11px',color:'var(--dsw-alias-label-secondary)'};
      const call=async(url,options)=>{
        const response=await fetch(url,options);
        let data;try{data=await response.json();}catch{throw new Error('音乐库服务响应无效');}
        if(!response.ok||data?.success===false)throw new Error(data?.error||'音乐库操作失败');
        return data;
      };
      const loadLibrary=async(nextQuery=query,nextLicense=licenseFilter,keepSelected=true)=>{
        setLoading(true);setError('');
        try{
          const params=new URLSearchParams({limit:'100'});
          if(nextQuery.trim())params.set('query',nextQuery.trim());
          if(nextLicense!=='all')params.set('license_status',nextLicense);
          const data=await call(`/api/media-center/editing/music?${params}`);
          const list=data.items||data.music?.items||[];setItems(list);
          if(!keepSelected||!list.some(item=>item.id===selectedId)){setSelectedId(list[0]?.id||'');setProfile(null);setAnalysisId('');setSelectedCandidates(new Set());}else if(selectedId)await loadProfile(selectedId);
        }catch(e){setError(e?.message||'无法读取音乐库');}
        finally{setLoading(false);}
      };
      const isLegacyMusicHostError=error=>/未知剪辑工作流操作/.test(error?.message||'');
      const defaultWindowDuration=id=>{const duration=Number(items.find(item=>item.id===id)?.duration);return Number.isFinite(duration)&&duration>0?Math.min(duration,MAX_MUSIC_ANALYSIS_SECONDS):60;};
       const resetAnalysisWindow=id=>{setStartSeconds(0);setDurationSeconds(defaultWindowDuration(id));};
       const extractProfile=data=>data?.profile||data?.analysis||(data&&(typeof data.status==='string'||'beat_candidates'in data||'bpm'in data||'analysis_window'in data)?data:null);
      const loadProfile=async id=>{
        if(!id){setProfile(null);setAnalysisId('');setModelInterpretationDraft(null);setSelectedModelBeatSuggestions(new Set());return;}
        setError('');
        try{
          const data=await call(`/api/media-center/editing/music/${encodeURIComponent(id)}/analysis`);
          const loadedProfile=extractProfile(data);
          setProfile(loadedProfile);setAnalysisId(data.analysis_id||loadedProfile?.analysis_id||'');setSelectedCandidates(new Set());setModelInterpretationDraft(null);setSelectedModelBeatSuggestions(new Set());

           const storedWindow=loadedProfile?.analysis_window||loadedProfile?.window;const storedStart=Number(storedWindow?.start_seconds),storedDuration=Number(storedWindow?.duration_seconds);
           if(Number.isFinite(storedStart)&&Number.isFinite(storedDuration)){setStartSeconds(storedStart);setDurationSeconds(storedDuration);}else resetAnalysisWindow(id);

        }catch(e){
          if(isLegacyMusicHostError(e)){setProfile(null);setAnalysisId('');resetAnalysisWindow(id);setNotice('当前 Host 尚未加载新版音乐分析接口；重载插件/Host 后即可使用 BPM、节奏候选和风格档案。');return;}
           if(/404|没有|尚无|不存在/.test(e?.message||'')){setProfile(null);setAnalysisId('');resetAnalysisWindow(id);return;}
          setError(e?.message||'无法读取音乐分析记录');
        }
      };
      useEffect(()=>{loadLibrary('', 'all',false);},[]);
      useEffect(()=>{if(selectedId)loadProfile(selectedId);},[selectedId]);
      const selected=items.find(item=>item.id===selectedId)||null;
      const styleOptions=Array.from(new Set(items.flatMap(item=>Array.isArray(item.analysis_summary?.style_tags)?item.analysis_summary.style_tags.map(tag=>typeof tag==='string'?tag:String(tag?.tag||'')):[]).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'zh-CN'));
      const musicDirectoryTree=(()=>{
        const root={id:'',name:'',count:0,children:[]},nodes=new Map([['',root]]);
        for(const item of items){
          const parts=String(item?.file_path||'').replace(/\\/g,'/').split('/').filter(Boolean);
          parts.pop();
          if(!parts.length){root.count++;continue;}
          let parentId='';
          for(const part of parts){
            const id=parentId?`${parentId}/${part}`:part;
            let node=nodes.get(id);
            if(!node){node={id,name:part,count:0,children:[]};nodes.set(id,node);nodes.get(parentId).children.push(node);}
            node.count++;
            parentId=id;
          }
        }
        for(const node of nodes.values())node.children.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
        return root.children;
      })();
      const directoryItems=items.filter(item=>{
        if(!selectedDirectory)return true;
        const parts=String(item?.file_path||'').replace(/\\/g,'/').split('/').filter(Boolean);parts.pop();
        const directory=parts.join('/');
        return directory===selectedDirectory||directory.startsWith(`${selectedDirectory}/`);
      });
      const selectMusicDirectory=id=>{
        const matching=items.filter(item=>{
          const parts=String(item?.file_path||'').replace(/\\/g,'/').split('/').filter(Boolean);parts.pop();
          const directory=parts.join('/');
          return !id||directory===id||directory.startsWith(`${id}/`);
        });
        setSelectedDirectory(id);
        if(!matching.some(item=>item.id===selectedId))setSelectedId(matching[0]?.id||'');
        if(isMobile)setMobileTab?.('videos');
      };
      const visibleItems=directoryItems.filter(item=>{
        const summary=item.analysis_summary||{},bpmValues=[summary.bpm,...(summary.tempo_candidates||[]).map(value=>typeof value==='number'?value:value?.bpm)].map(Number).filter(Number.isFinite);
        if(analysisFilter!=='all'&&(summary.status||'not_analyzed')!==analysisFilter)return false;
        if(styleFilter!=='all'&&!(summary.style_tags||[]).some(tag=>(typeof tag==='string'?tag:tag?.tag)===styleFilter))return false;
        if((bpmMin!==''||bpmMax!=='')&&!bpmValues.some(bpm=>(bpmMin===''||bpm>=Number(bpmMin))&&(bpmMax===''||bpm<=Number(bpmMax))))return false;
        return true;
      });
      const toggleMusicDirectory=(id,event)=>{
        event?.stopPropagation?.();
        setCollapsedDirectories(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
      };
      const renderMusicDirectory=(node,depth=0)=>{
        const selected=selectedDirectory===node.id,collapsed=collapsedDirectories.has(node.id),hasChildren=node.children.length>0;
        return h('div',{key:node.id,style:{position:'relative'}},
          h('div',{style:{display:'flex',alignItems:'center',gap:'4px',minHeight:'34px',padding:`3px 6px 3px ${6+depth*12}px`,margin:'2px 4px',borderRadius:'5px',backgroundColor:selected?'rgba(37,99,235,0.12)':'transparent'}},
            hasChildren?h('button',{type:'button','aria-label':collapsed?`展开目录 ${node.name}`:`折叠目录 ${node.name}`,onClick:event=>toggleMusicDirectory(node.id,event),style:{border:'none',background:'transparent',padding:'2px',color:'var(--dsw-alias-label-secondary)',cursor:'pointer',display:'flex',flexShrink:0}},collapsed?Icon.chevronRight({size:11}):Icon.chevronDown({size:11})):h('span',{style:{width:'15px',flexShrink:0}}),
            Icon.folder({size:14,color:selected?'#2563eb':'#3b82f6'}),
            h('button',{type:'button','aria-label':`选择目录 ${node.id}`,title:node.id,onClick:()=>selectMusicDirectory(node.id),style:{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'left',border:'none',background:'transparent',padding:'4px 2px',color:selected?'#2563eb':'var(--dsw-alias-label-primary)',fontSize:'12px',fontWeight:selected?600:400,cursor:'pointer'}},node.name),
            h('span',{style:{fontSize:'10px',padding:'1px 5px',borderRadius:'10px',backgroundColor:'var(--dsw-alias-bg-layer-2)',color:'var(--dsw-alias-label-secondary)',flexShrink:0}},String(node.count))
          ),
          hasChildren&&!collapsed&&node.children.map(child=>renderMusicDirectory(child,depth+1))
        );
      };
      const toggleAudioFile=audioPath=>{
        if(selectedAudioPaths.has(audioPath)){const next=new Set(selectedAudioPaths);next.delete(audioPath);setSelectedAudioPaths(next);return;}
        if(selectedAudioPaths.size>=MAX_MUSIC_IMPORT_BATCH){setError(`一次最多选择 ${MAX_MUSIC_IMPORT_BATCH} 个音频文件。`);return;}
        setSelectedAudioPaths(new Set([...selectedAudioPaths,audioPath]));setError('');
      };
      const toggleCurrentAudioFiles=()=>{
        const paths=(browser?.audio_files||[]).map(item=>item.path),allSelected=paths.length>0&&paths.every(audioPath=>selectedAudioPaths.has(audioPath));
        if(allSelected){const next=new Set(selectedAudioPaths);for(const audioPath of paths)next.delete(audioPath);setSelectedAudioPaths(next);return;}
        const missing=paths.filter(audioPath=>!selectedAudioPaths.has(audioPath));
        if(selectedAudioPaths.size+missing.length>MAX_MUSIC_IMPORT_BATCH){setError(`批量导入最多 ${MAX_MUSIC_IMPORT_BATCH} 个音频；请分批选择。`);return;}
        setSelectedAudioPaths(new Set([...selectedAudioPaths,...missing]));setError('');
      };
      const browse=async dir=>{
        setBusy('browse');setError('');
        try{
          const url=dir?`/api/media-center/fs/browse?dir=${encodeURIComponent(dir)}`:'/api/media-center/fs/browse';
          const data=await call(url);setBrowser(data);setShowBrowser(true);
        }catch(e){setError(e?.message||'无法浏览本地目录');}
        finally{setBusy('');}
      };
      const importMusic=async()=>{
        const paths=importTab==='browse'&&selectedAudioPaths.size?[...selectedAudioPaths]:filePath.trim()?[filePath.trim()]:[];
        if(!paths.length){setError('请先选择一个或多个本地音频文件，或输入单个绝对路径。');return;}
        if(paths.length>MAX_MUSIC_IMPORT_BATCH){setError(`一次最多导入 ${MAX_MUSIC_IMPORT_BATCH} 个音频文件。`);return;}
        if(lock.current)return;lock.current=true;setBusy('import');setImportProgress({completed:0,total:paths.length});setError('');setNotice('');
        const imported=[],failed=[];
        try{
          for(const [index,sourcePath] of paths.entries()){
            try{
              const result=await call('/api/media-center/editing/music',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file_path:sourcePath,title:paths.length===1?musicTitle.trim():'',artist:paths.length===1?artist.trim():'',license_status:'unknown',license_note:licenseNote.trim()})});
              imported.push({music:result.music,created:result.created!==false});
            }catch(error){failed.push({path:sourcePath,message:error?.message||'导入失败'});}
            finally{setImportProgress({completed:index+1,total:paths.length});}
          }
          if(imported.length){
            setFilePath('');setSelectedAudioPaths(new Set());setMusicTitle('');setArtist('');setShowBrowser(false);setShowImportModal(false);
            const created=imported.filter(item=>item.created).length,existing=imported.length-created;
            setNotice(`批量导入完成：新增 ${created} 条${existing?`，已有记录 ${existing} 条`:''}；源文件未复制或修改。`);
            await loadLibrary(query,licenseFilter,false);
            const lastMusic=imported.at(-1)?.music;if(lastMusic?.id)setSelectedId(lastMusic.id);
          }
          if(failed.length){
            const names=failed.slice(0,3).map(item=>`${item.path.split(/[\\/]/).at(-1)||item.path}：${item.message}`);
            setError(`导入失败 ${failed.length} 条：${names.join('；')}${failed.length>3?'；其余失败项已省略':''}`);
          }else if(!imported.length)setError('没有成功导入音频引用。');
        }finally{lock.current=false;setBusy('');}
      };
      const confirmPersonal=async()=>{
        if(!selectedId||!window.confirm('请确认你有权将这首音乐用于个人分享。此操作只记录你的声明，不代表插件或平台核验版权。继续？'))return;
        setBusy('rights');setError('');
        try{
          await call(`/api/media-center/editing/music/${encodeURIComponent(selectedId)}/confirm-personal`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true,license_note:licenseNote.trim()})});
          setNotice('个人用途声明已记录；该声明未经独立核验。');await loadLibrary(query,licenseFilter,true);
        }catch(e){setError(e?.message||'无法记录许可声明');}
        finally{setBusy('');}
      };
      const analyze=async()=>{
        if(!selectedId)return;
        const start=Number(startSeconds),duration=Number(durationSeconds);
        if(!Number.isFinite(start)||start<0||!Number.isFinite(duration)||duration<=0||duration>MAX_MUSIC_ANALYSIS_SECONDS){setError(`分析窗口起点须非负，长度须为 0–${MAX_MUSIC_ANALYSIS_SECONDS} 秒（10分钟）。`);return;}
        setBusy('analyze');setError('');setNotice('');setSelectedCandidates(new Set());
        try{
          const result=await call(`/api/media-center/editing/music/${encodeURIComponent(selectedId)}/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startSeconds:start,durationSeconds:duration})});
          const analyzedProfile=extractProfile(result);
          setAnalysisId(result.analysis_id||analyzedProfile?.analysis_id||'');setProfile(analyzedProfile);
          setNotice('本地节奏分析已保存；拍点候选须试听确认，模型节奏/风格建议会单独标注。');
          await loadLibrary(query,licenseFilter,true);
        }catch(e){if(isLegacyMusicHostError(e))setNotice('当前 Host 尚未加载新版音乐分析接口；请重载插件/Host 后再分析。');else setError(e?.message||'音乐分析失败');}
        finally{setBusy('');}
      };
      const interpretMusic=async()=>{
        if(!selectedId||!analysisId||!modelWindowMatches){setError('请先对当前音频窗口运行本地分析，再进行频谱图模型解读。');return;}
        if(!sourceCurrent){setError('音乐源文件缺失或身份已变化，无法生成频谱图。');return;}
        setBusy('interpret');setError('');setNotice('');
        try{
          await call(`/api/media-center/editing/music/${encodeURIComponent(selectedId)}/interpret`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({analysis_id:analysisId})});
          await loadProfile(selectedId);
          setNotice('频谱图模型解读已记录；速度与节奏点是近似视觉提示，与DSP候选分开，标签可手动编辑。');
        }catch(e){if(isLegacyMusicHostError(e))setNotice('当前 Host 尚未加载新版频谱解读接口；重载插件/Host 后即可使用。');else setError(e?.message||'频谱图模型解读失败');}
        finally{setBusy('');}
      };
      const submitModelInterpretationEdits=async(edits,noticeText)=>{
        if(!selectedId||!analysisId||!profile?.model_interpretation)return;
        setBusy('interpretEdit');setError('');setNotice('');
        try{
          const result=await call(`/api/media-center/editing/music/${encodeURIComponent(selectedId)}/interpret/edits`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({analysis_id:analysisId,edits,confirmed:true})});
          setProfile(current=>current?{...current,model_interpretation_edits:result.model_interpretation_edits,model_interpretation_edits_provenance:result.model_interpretation_edits_provenance}:current);
          setModelInterpretationDraft(null);setSelectedModelBeatSuggestions(new Set());setNotice(noticeText);
        }catch(e){setError(e?.message||'无法保存频谱解读编辑');}
        finally{setBusy('');}
      };
      const beginModelInterpretationEdit=()=>{
        const generated=profile?.model_interpretation,edits=profile?.model_interpretation_edits||{};if(!generated)return;
        setModelInterpretationDraft({summary:edits.summary??generated.summary??'',rhythm_character:edits.rhythm_character??generated.rhythm_character??'',
          energy_arc:edits.energy_arc??generated.energy_arc??'',style_tags:(edits.style_tags??generated.style_tags??[]).join(', ')});
      };
      const saveModelInterpretationEdit=()=>{
        if(!modelInterpretationDraft)return;
        const edits=profile?.model_interpretation_edits||{},generated=profile?.model_interpretation||{};
        const styleTags=String(modelInterpretationDraft.style_tags||'').split(/[\n,，、]/).map(tag=>tag.trim()).filter(Boolean);
        return submitModelInterpretationEdits({summary:String(modelInterpretationDraft.summary||'').trim()||generated.summary,
          rhythm_character:String(modelInterpretationDraft.rhythm_character||'').trim()||generated.rhythm_character,
          energy_arc:String(modelInterpretationDraft.energy_arc||'').trim()||generated.energy_arc,style_tags:styleTags,
          user_confirmed_model_beats:edits.user_confirmed_model_beats||[]},'已保存人工编辑的频谱解读和风格标签。');
      };
      const confirmModelBeatHints=()=>{
        const selected=Array.from(selectedModelBeatSuggestions).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!selected.length)return;
        if(!window.confirm('你已试听并确认这些模型估计的近似节奏位置？它们会与DSP测量拍点分开记录。'))return;
        const edits=profile?.model_interpretation_edits||{},generated=profile?.model_interpretation||{};
        return submitModelInterpretationEdits({summary:edits.summary??generated.summary,rhythm_character:edits.rhythm_character??generated.rhythm_character,
          energy_arc:edits.energy_arc??generated.energy_arc,style_tags:edits.style_tags??generated.style_tags??[],
          user_confirmed_model_beats:[...new Set([...(edits.user_confirmed_model_beats||[]),...selected])]},'已记录用户确认的模型节奏提示（独立于DSP拍点）。');
      };
      const removeMusic=async()=>{
        if(!selectedId||!window.confirm('仅从音乐库移除这条引用；不会删除或修改磁盘源文件。继续？'))return;
        setBusy('remove');setError('');
        try{await call(`/api/media-center/editing/music/${encodeURIComponent(selectedId)}`,{method:'DELETE'});setSelectedId('');setProfile(null);setAnalysisId('');await loadLibrary(query,licenseFilter,false);}
        catch(e){setError(e?.message||'移除音乐记录失败');}
        finally{setBusy('');}
      };
      const eventTime=value=>{
        if(typeof value==='number'&&Number.isFinite(value))return value;
        if(!value||typeof value!=='object')return null;
        for(const key of ['source_seconds','time_seconds','time','seconds','timestamp'])if(Number.isFinite(Number(value[key])))return Number(value[key]);
        return null;
      };
      const listTimes=value=>Array.isArray(value)?value.map(eventTime).filter(Number.isFinite):[];
      const profileWindow=profile?.window||profile?.analysis_window||{};
      const windowStart=Number(profileWindow.start_seconds??profileWindow.startSeconds??startSeconds)||0;
      const windowDuration=Number(profileWindow.duration_seconds??profileWindow.durationSeconds??durationSeconds)||0;

      const beatCandidates=listTimes(profile?.beat_candidates);
      const confirmedBeats=listTimes(profile?.user_confirmed_beats);
      const tempoAlternatives=Array.isArray(profile?.tempo_alternatives)?profile.tempo_alternatives:Array.isArray(profile?.tempo_candidates)?profile.tempo_candidates:[];
      const confidence=profile?.confidence==null?Number.NaN:Number(profile.confidence);
      const status=profile?.status||profile?.analysis_status||'unavailable';
       const featureSummary=profile?.feature_summary||{};
      const ambiguous=profile?.ambiguous===true||tempoAlternatives.some(item=>item?.ambiguous===true)||status==='ambiguous';
      const canConfirmBeats=beatCandidates.length>0&&!!analysisId;
      const selectedBeatTimes=Array.from(selectedCandidates).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
       const confirmBeatsDisabled=!canConfirmBeats||!selectedBeatTimes.length||!!busy;
      const beatConfirmationGuidance=!analysisId?'缺少版本化 analysis_id，不能保存人工确认。':!beatCandidates.length?'此窗口没有 beat candidates；可查看独立的模型节奏提示。':ambiguous||status!=='ok'||!Number.isFinite(confidence)||confidence<0.55?'系统节奏估值置信度有限/存在速度歧义；仍可试听后逐项确认真实拍点，确认不会提升或覆盖 BPM 估值。':`请试听核对后勾选拍点候选；${selectedBeatTimes.length} 个已选。`;
      const toggleCandidate=time=>{
        const key=String(Number(time.toFixed(4))),next=new Set(selectedCandidates);
        if(next.has(key))next.delete(key);else next.add(key);setSelectedCandidates(next);
      };
      const confirmBeats=async()=>{
        if(!canConfirmBeats||!selectedBeatTimes.length)return;
        if(!window.confirm(`确认你已试听并核对这 ${selectedBeatTimes.length} 个候选拍点？这只记录你的人工判断。`))return;
        setBusy('confirm-beats');setError('');
        try{
          const result=await call(`/api/media-center/editing/music/${encodeURIComponent(selectedId)}/analysis/confirm-beats`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({analysis_id:analysisId,beats:selectedBeatTimes,confirmed:true})});
          const confirmedProfile=extractProfile(result);
          setProfile(confirmedProfile);setAnalysisId(result.analysis_id||confirmedProfile?.analysis_id||analysisId);setSelectedCandidates(new Set());setNotice('已记录所选人工确认拍点。');await loadLibrary(query,licenseFilter,true);
        }catch(e){if(isLegacyMusicHostError(e))setNotice('当前 Host 尚未加载新版音乐分析接口；请重载插件/Host 后再确认。');else setError(e?.message||'无法确认拍点');}
        finally{setBusy('');}
      };
      const styleProfile=profile?.style_tags||{};
      const styleArray=Array.isArray(styleProfile)?styleProfile:null;
      const suggestedStyles=styleArray?[]:Array.isArray(styleProfile.suggested)?styleProfile.suggested:Array.isArray(styleProfile.agent_suggestions)?styleProfile.agent_suggestions:[];
      const confirmedStyles=styleArray?(profile?.style_provenance==='dsh-agent-user-approved'?styleArray:styleArray.filter(item=>item?.status==='user_confirmed'||item?.status==='confirmed'||item?.source==='user')):Array.isArray(styleProfile?.user_confirmed)?styleProfile.user_confirmed:Array.isArray(styleProfile?.confirmed)?styleProfile.confirmed:Array.isArray(profile?.user_confirmed_style_tags)?profile.user_confirmed_style_tags:[];
       const styleRationale=profile?.style_rationale||'';
      const unclassifiedStyles=styleArray?styleArray.filter(item=>!suggestedStyles.includes(item)&&!confirmedStyles.includes(item)):[];
      const tagText=item=>typeof item==='string'?item:String(item?.tag??item?.name??item?.label??'');
      const tagRationale=item=>typeof item==='object'?(item?.rationale||item?.reason||'') : '';
      const renderStyleTag=(item,index,kind)=>h('div',{key:`${kind}-${index}`,style:{display:'flex',alignItems:'flex-start',gap:'7px',padding:'5px 7px',border:'1px solid var(--dsw-alias-border-l1)',borderRadius:'5px',fontSize:'11px',minWidth:0}},
        h('span',{style:{border:'1px solid var(--dsw-alias-border-l2)',borderRadius:'10px',padding:'2px 6px',whiteSpace:'nowrap'}},tagText(item)),
        tagRationale(item)&&h('span',{style:{color:'var(--dsw-alias-label-secondary)',overflowWrap:'anywhere'}},tagRationale(item))
      );
      const trackStyles={position:'relative',height:'44px',margin:'10px 4px 16px',borderBottom:'1px solid var(--dsw-alias-border-l1)',borderTop:'1px solid var(--dsw-alias-border-l1)'};
      const markers=(times,kind)=>times.filter(t=>windowDuration>0&&t>=windowStart&&t<=windowStart+windowDuration).map((time,index)=>{
        const left=Math.max(0,Math.min(100,((time-windowStart)/windowDuration)*100));
        const userConfirmed=kind==='confirmed';
        return h('span',{key:`${kind}-${time}-${index}`,title:`${kind==='onset'?'瞬态':kind==='candidate'?'候选拍点':'人工确认拍点'} ${time.toFixed(3)} 秒`,style:{position:'absolute',left:`${left}%`,top:userConfirmed?'2px':'8px',height:userConfirmed?'38px':'30px',borderLeft:userConfirmed?'2px solid #2563eb':kind==='candidate'?'2px dashed var(--dsw-alias-label-primary)':'1px solid var(--dsw-alias-label-secondary)',opacity:kind==='onset'?0.55:1}});
      });
      const timeRows=(label,times,canSelect,limit=80)=>h('div',{style:{display:'flex',flexDirection:'column',gap:'4px',marginTop:'8px'}},
        h('strong',{style:{fontSize:'12px'}},`${label} (${times.length})`),
        times.slice(0,limit).map((time,index)=>h('label',{key:`${label}-${index}`,style:{display:'flex',alignItems:'center',gap:'7px',fontSize:'12px',color:'var(--dsw-alias-label-secondary)',padding:'3px 0'}},
          canSelect&&h('input',{type:'checkbox','aria-label':`确认候选拍点 ${time.toFixed(3)} 秒`,checked:selectedCandidates.has(String(Number(time.toFixed(4)))),disabled:!canConfirmBeats||busy==='confirm-beats',onChange:()=>toggleCandidate(time)}),
          h('span',null,`${time.toFixed(3)} 秒`)
        )),times.length>limit&&h('span',{style:{fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},`仅显示前 ${limit} 个，另有 ${times.length-limit} 个`)
      );
      const activeRights=selected?.license_status==='personal_confirmed';
       const sourceCurrent=selected?.source_status==='current';
       const modelWindowMatches=!!profile?.analysis_window&&profile.status!=='stale'&&Number(profile.analysis_window.start_seconds)===Number(startSeconds)&&Number(profile.analysis_window.duration_seconds)===Number(durationSeconds);
       const modelInterpretationView=profile?.model_interpretation?{...profile.model_interpretation,...(profile.model_interpretation_edits||{})}:null;
       const modelBeatHints=Array.isArray(profile?.model_interpretation?.beat_time_hypotheses)?profile.model_interpretation.beat_time_hypotheses:[];
       const confirmedModelBeatTimes=listTimes(profile?.model_interpretation_edits?.user_confirmed_model_beats);
      const statusLabel={ok:'可用测量',low_confidence:'低置信度',silence:'静音/无明显音频',no_audio:'无音轨',error:'分析失败',unavailable:'尚未分析'}[status]||status;
      const confidenceLabel=Number.isFinite(confidence)?`${Math.round(confidence*100)}%`:'未提供';
      const busyLabel=busy==='import'?`正在导入 ${importProgress.completed}/${importProgress.total}`:{browse:'正在浏览',rights:'正在记录声明',analyze:'正在测量',interpret:'正在生成谱图并请求模型',interpretEdit:'正在保存解读编辑/模型节奏确认',remove:'正在移除',"confirm-beats":'正在保存确认'}[busy];
      const musicBodyStyle=layout?.bodyStyle||{display:'flex',flex:1,minHeight:0,overflow:'hidden',position:'relative'};
      const musicLeftStyle={...(layout?.leftColStyle||{width:isMobile?'100%':'250px',minWidth:isMobile?'100%':'180px',display:'flex',flexDirection:'column',backgroundColor:'var(--dsw-alias-bg-layer-1)',overflowY:'auto',overflowX:'hidden'}),minHeight:0};
      const musicMiddleStyle={...(layout?.midColStyle||{flex:1,width:isMobile?'100%':'auto',display:'flex',flexDirection:'column',backgroundColor:'var(--dsw-alias-bg-base)',overflow:'hidden'}),minWidth:0,minHeight:0};
      const musicRightStyle={...(layout?.rightColStyle||{width:isMobile?'100%':'440px',display:'flex',flexDirection:'column',backgroundColor:'var(--dsw-alias-bg-layer-1)',overflowY:'auto'}),minHeight:0};
      const musicMobileLabels=[{id:'folders',label:'目录',icon:Icon.folder({size:13})},{id:'videos',label:`音乐列表 (${visibleItems.length})`,icon:Icon.music({size:13})},{id:'detail',label:'音乐详情',icon:Icon.hardDrive({size:13})}];
      const busyStatus=!!busyLabel&&h('div',{role:'status',style:{padding:'6px 12px',fontSize:'11px',color:'var(--dsw-alias-label-secondary)',borderBottom:'1px solid var(--dsw-alias-border-l1)'}},busyLabel);
      const closeImport=()=>{setShowImportModal(false);setShowBrowser(false);setSelectedAudioPaths(new Set());setFilePath('');setError('');};
      const importDialog=showImportModal&&renderAssetImportDialog({
        isMobile,overlayStyle:styles?.modalOverlayStyle,cardStyle:styles?.modalCardStyle,ariaLabel:'导入本地音乐',
        children:h(React.Fragment,null,
          h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}},
            h('div',{style:{display:'flex',alignItems:'center',gap:'8px'}},Icon.music({size:18,color:'#3b82f6'}),h('strong',{style:{fontSize:'15px',fontWeight:600}},'导入本地音乐')),
            renderImportMethodTabs({active:importTab,onSelect:next=>{setImportTab(next);setShowBrowser(false);},disabled:busy==='import',secondaryStyle:secondary,primaryStyle:primary})
          ),
          h('div',{style:{padding:'8px 10px',backgroundColor:'var(--dsw-alias-bg-layer-2)',border:'1px solid var(--dsw-alias-border-l1)',borderRadius:'5px',fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},'支持一次勾选最多 50 个音频文件；批量时各曲目使用嵌入元数据或文件名，手动标题/作者仅用于单文件。这里只登记本地引用，不复制、移动、修改或删除源文件。许可状态是用户声明，不代表插件核验版权。'),
          error&&h('div',{role:'alert',style:{padding:'8px 10px',border:'1px solid var(--dsw-alias-border-l2)',borderRadius:'5px',fontSize:'12px'}},error),
          importTab==='browse'
            ? h('div',{style:{display:'flex',flexDirection:'column',gap:'8px',minHeight:0}},
                h('label',{style:{fontSize:'12px',display:'flex',flexDirection:'column',gap:'5px'}},'音频文件',
                  h('div',{style:{display:'flex',gap:'8px',alignItems:'center'}},
                    h('input',{type:'text','aria-label':'本地音频绝对路径',value:selectedAudioPaths.size?`已选 ${selectedAudioPaths.size} 个音频文件`:filePath,onChange:e=>setFilePath(e.target.value),readOnly:selectedAudioPaths.size>0,placeholder:'可选择多个本地音频文件',style:{...fieldStyle,flex:1}}),
                    h('button',{type:'button',style:secondary,disabled:!!busy,onClick:()=>browse()},Icon.folder({size:13}),'浏览')
                  )
                ),
                showBrowser&&browser&&h('div',{style:{border:'1px solid var(--dsw-alias-border-l1)',borderRadius:'6px',padding:'8px',maxHeight:'240px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'4px',backgroundColor:'var(--dsw-alias-bg-base)'}},
                  h('div',{style:{display:'flex',alignItems:'center',gap:'6px',padding:'6px 8px',backgroundColor:'var(--dsw-alias-bg-layer-2)',borderRadius:'5px',fontSize:'11px'}},
                    browser.parent_path&&h('button',{type:'button',style:secondary,disabled:!!busy,onClick:()=>browse(browser.parent_path)},Icon.arrowUp({size:12}),'上一级'),
                    h('span',{style:{color:'var(--dsw-alias-label-secondary)',flexShrink:0}},'当前目录'),
                    h('span',{title:browser.current_path,style:{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}},browser.current_path)
                  ),
                  h('div',{style:{display:'flex',flexWrap:'wrap',gap:'5px'}},
                    ...(browser.drive_roots||[]).map(item=>h('button',{key:`drive-${item.path}`,type:'button',style:{...secondary,padding:'3px 8px',fontSize:'11px'},disabled:!!busy,onClick:()=>browse(item.path)},Icon.hardDrive({size:12}),item.name)),
                    ...(browser.quick_places||[]).map(item=>h('button',{key:`quick-${item.path}`,type:'button',style:{...secondary,padding:'3px 8px',fontSize:'11px'},disabled:!!busy,onClick:()=>browse(item.path)},Icon.folder({size:12}),item.name))
                  ),
                  ...(browser.folders||[]).map(item=>h('button',{key:`folder-${item.path}`,type:'button',style:{...secondary,minHeight:'38px',textAlign:'left',justifyContent:'flex-start'},disabled:!!busy,onClick:()=>browse(item.path)},Icon.folder({size:14}),`目录：${item.name}`)),
                  (browser.audio_files||[]).length>0&&h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',padding:'6px 8px',backgroundColor:'var(--dsw-alias-bg-layer-2)',borderRadius:'5px',fontSize:'11px'}},
                    h('label',{style:{display:'inline-flex',alignItems:'center',gap:'6px',cursor:'pointer'}},
                      h('input',{type:'checkbox','aria-label':'选择当前目录全部音频',checked:browser.audio_files.length>0&&browser.audio_files.every(item=>selectedAudioPaths.has(item.path)),disabled:!!busy,onChange:toggleCurrentAudioFiles}),
                      `选择当前目录音频 (${browser.audio_files.length})`
                    ),
                    h('span',{style:{color:'var(--dsw-alias-label-secondary)'}},`${selectedAudioPaths.size}/${MAX_MUSIC_IMPORT_BATCH} 已选`)
                  ),
                  ...(browser.audio_files||[]).map(item=>{
                    const selectedAudio=selectedAudioPaths.has(item.path);
                    return h('label',{key:`audio-${item.path}`,style:{minHeight:'38px',padding:'5px 8px',borderRadius:'5px',border:selectedAudio?'1px solid var(--dsw-alias-border-l2)':'1px solid transparent',backgroundColor:selectedAudio?'var(--dsw-alias-bg-layer-2)':'transparent',display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}},
                      h('input',{type:'checkbox','aria-label':`选择音频 ${item.name}`,checked:selectedAudio,disabled:!!busy,onChange:()=>toggleAudioFile(item.path)}),
                      Icon.music({size:14,color:selectedAudio?'#2563eb':'#3b82f6'}),
                      h('span',{title:item.name,style:{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'12px'}},item.name),
                      h('span',{style:{fontSize:'10px',color:'var(--dsw-alias-label-secondary)',flexShrink:0}},item.ext||'音频')
                    );
                  }),
                  !(browser.folders||[]).length&&!(browser.audio_files||[]).length&&h('div',{style:{padding:'14px',textAlign:'center',fontSize:'12px',color:'var(--dsw-alias-label-secondary)'}},'当前目录没有支持的音频文件或子目录')
                )
              )
            : h('label',{style:{fontSize:'12px',display:'flex',flexDirection:'column',gap:'6px'}},'音频文件绝对路径',h('input',{type:'text','aria-label':'本地音频绝对路径',value:filePath,onChange:e=>setFilePath(e.target.value),placeholder:'例如：D:\\Music\\track.wav',style:fieldStyle})),
          h('label',{style:{fontSize:'12px',display:'flex',flexDirection:'column',gap:'5px'}},'标题（可选）',h('input',{type:'text','aria-label':'音乐标题',value:musicTitle,onChange:e=>setMusicTitle(e.target.value),style:fieldStyle})),
          h('label',{style:{fontSize:'12px',display:'flex',flexDirection:'column',gap:'5px'}},'作者（可选）',h('input',{type:'text','aria-label':'音乐作者',value:artist,onChange:e=>setArtist(e.target.value),style:fieldStyle})),
          h('label',{style:{fontSize:'12px',display:'flex',flexDirection:'column',gap:'5px'}},'许可备注（可选）',h('textarea',{'aria-label':'个人用途许可备注',value:licenseNote,onChange:e=>setLicenseNote(e.target.value),placeholder:'记录你的授权依据；这不是插件的版权核验。',rows:3,style:fieldStyle})),
          h('div',{style:{display:'flex',justifyContent:'flex-end',gap:'8px',borderTop:'1px solid var(--dsw-alias-border-l1)',paddingTop:'10px'}},
            h('button',{type:'button',style:secondary,disabled:busy==='import',onClick:closeImport},'取消'),
            h('button',{type:'button',style:primary,disabled:!!busy||(!selectedAudioPaths.size&&!filePath.trim()),onClick:importMusic},busy==='import'?`正在导入 ${importProgress.completed}/${importProgress.total}…`:selectedAudioPaths.size?`导入所选音频 (${selectedAudioPaths.size})`:'导入音乐引用')
          )
        )
      });
      return h('div',{style:{width:'100%',flex:1,minHeight:0,display:'flex',flexDirection:'column',overflow:'hidden'},'aria-label':'音乐库页面'},
        renderLibrarySectionHeader({icon:Icon.music,title:'本地音乐库',description:`${items.length} 条音频资产`,actions:h('button',{type:'button','aria-label':'导入音乐',style:primary,disabled:!!busy,onClick:()=>{setError('');setShowImportModal(true);setShowBrowser(false);setImportTab('browse');setSelectedAudioPaths(new Set());setFilePath('');}},Icon.upload({size:13}),'导入音乐')}),
        renderMobilePanelNavigation({isMobile,active:mobileTab,onSelect:setMobileTab,labels:musicMobileLabels}),
        !showImportModal&&error&&h('div',{role:'alert',style:{margin:'8px 12px 0',padding:'8px',border:'1px solid var(--dsw-alias-border-l2)',borderRadius:'5px',fontSize:'12px'}},error),
        !showImportModal&&notice&&h('div',{role:'status',style:{margin:'8px 12px 0',padding:'8px',border:'1px solid var(--dsw-alias-border-l1)',borderRadius:'5px',fontSize:'12px'}},notice),
        busyStatus,
        renderLibraryColumnLayout({bodyStyle:musicBodyStyle,isMobile,onResizeStart,isDraggingRef,columns:[
          h('aside',{style:musicLeftStyle,'aria-label':'音乐来源目录'},
            h('div',{style:{padding:'12px 12px 8px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid var(--dsw-alias-border-l1)'}},
              h('strong',{style:{fontSize:'12px',display:'inline-flex',alignItems:'center',gap:'7px'}},Icon.folder({size:14,color:'#3b82f6'}),'来源目录'),
              h('span',{style:{fontSize:'10px',color:'var(--dsw-alias-label-secondary)'}},`${items.length} 首`)
            ),
            h('button',{type:'button','aria-label':'显示全部音乐',onClick:()=>selectMusicDirectory(''),style:{display:'flex',alignItems:'center',gap:'7px',margin:'6px 5px',padding:'7px 8px',border:'none',borderRadius:'5px',backgroundColor:selectedDirectory===''?'rgba(37,99,235,0.12)':'transparent',color:selectedDirectory===''?'#2563eb':'var(--dsw-alias-label-primary)',fontSize:'12px',fontWeight:selectedDirectory===''?600:400,textAlign:'left',cursor:'pointer'}},Icon.grid({size:14,color:'#3b82f6'}),'全部音乐',h('span',{style:{marginLeft:'auto',fontSize:'10px',color:'var(--dsw-alias-label-secondary)'}},String(items.length))),
            h('div',{role:'tree','aria-label':'音乐文件夹',style:{flex:1,minHeight:0,overflowY:'auto',paddingBottom:'8px'}},
              musicDirectoryTree.map(node=>renderMusicDirectory(node)),
              !musicDirectoryTree.length&&h('div',{style:{padding:'12px',fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},items.length?'尚无可用来源目录信息':'导入音乐后将按源文件夹显示目录')
            )
          ),
          h('main',{style:musicMiddleStyle,'aria-label':'音乐内容区'},
            h('div',{style:{padding:'10px 12px',borderBottom:'1px solid var(--dsw-alias-border-l1)',backgroundColor:'var(--dsw-alias-bg-layer-1)',display:'flex',flexDirection:'column',gap:'8px',flexShrink:0}},
              h('div',{style:{display:'flex',alignItems:'center',gap:'7px',flexWrap:'wrap'}},
                h('input',{type:'search','aria-label':'搜索音乐库',value:query,onChange:e=>setQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter')loadLibrary();},placeholder:'搜索标题、作者或文件名',style:{...fieldStyle,flex:1,minWidth:'160px'}}),
                h('button',{type:'button',style:secondary,disabled:loading,onClick:()=>loadLibrary()},'搜索')
              ),
              h('div',{style:{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,minmax(100px,1fr))',gap:'6px'}},
                h('select',{'aria-label':'授权状态筛选',value:licenseFilter,onChange:e=>setLicenseFilter(e.target.value),style:fieldStyle},h('option',{value:'all'},'全部授权状态'),h('option',{value:'unknown'},'授权未知'),h('option',{value:'personal_confirmed'},'用户声明个人用途')),
                h('select',{'aria-label':'音乐分析状态筛选',value:analysisFilter,onChange:e=>setAnalysisFilter(e.target.value),style:fieldStyle},h('option',{value:'all'},'全部分析状态'),h('option',{value:'not_analyzed'},'未分析'),h('option',{value:'ok'},'高置信度'),h('option',{value:'low_confidence'},'低置信度'),h('option',{value:'stale'},'源文件变更'),h('option',{value:'no_audio'},'无音轨'),h('option',{value:'error'},'分析失败')),
                h('select',{'aria-label':'音乐风格筛选',value:styleFilter,onChange:e=>setStyleFilter(e.target.value),style:fieldStyle},h('option',{value:'all'},'全部风格'),styleOptions.map(tag=>h('option',{key:tag,value:tag},tag))),
                h('div',{style:{display:'flex',gap:'5px',minWidth:0}},h('input',{type:'number','aria-label':'最低 BPM',min:1,max:400,value:bpmMin,onChange:e=>setBpmMin(e.target.value),placeholder:'最低 BPM',style:fieldStyle}),h('input',{type:'number','aria-label':'最高 BPM',min:1,max:400,value:bpmMax,onChange:e=>setBpmMax(e.target.value),placeholder:'最高 BPM',style:fieldStyle}))
              ),
              h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},
                h('span',null,selectedDirectory?`目录：${selectedDirectory.replaceAll('/',' / ')}`:'全部来源目录'),
                h('span',null,`${visibleItems.length} / ${directoryItems.length} 首`)
              )
            ),
            h('div',{style:{flex:1,minHeight:0,overflowY:'auto',padding:isMobile?'8px':'12px',display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(210px,1fr))',alignContent:'start',gap:'12px'}},
              loading&&h('div',{role:'status',style:{gridColumn:'1 / -1',padding:'10px',fontSize:'12px',color:'var(--dsw-alias-label-secondary)'}},'读取音乐目录…'),
              ...visibleItems.map(item=>{
                const summary=item.analysis_summary||{},active=selectedId===item.id,bpm=summary.bpm??summary.estimated_bpm,conf=summary.confidence;
                const title=item.title||item.file_name;
                return h('button',{key:item.id,type:'button','aria-label':`选择音乐 ${title}`,style:{padding:0,borderRadius:'7px',border:active?'1px solid var(--dsw-alias-border-l2)':'1px solid var(--dsw-alias-border-l1)',backgroundColor:active?'var(--dsw-alias-bg-layer-2)':'var(--dsw-alias-bg-layer-1)',color:'var(--dsw-alias-label-primary)',cursor:'pointer',textAlign:'left',overflow:'hidden',display:'flex',flexDirection:'column',minWidth:0},onClick:()=>{setSelectedId(item.id);if(isMobile)setMobileTab?.('detail');}},
                  h('div',{style:{position:'relative',width:'100%',aspectRatio:'16 / 9',overflow:'hidden',backgroundColor:'var(--dsw-alias-bg-layer-2)',display:'flex',alignItems:'center',justifyContent:'center'}},
                    h('div',{style:{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--dsw-alias-label-secondary)'}},Icon.music({size:28})),
                    h('img',{src:`/api/media-center/editing/music/${encodeURIComponent(item.id)}/spectrogram`,alt:`${title} 的频谱图`,loading:'lazy',decoding:'async',style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'},onError:e=>{e.currentTarget.style.display='none';}})
                  ),
                  h('div',{style:{display:'flex',flexDirection:'column',gap:'3px',padding:'9px 10px 10px',minWidth:0}},
                    h('strong',{style:{fontSize:'12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},title),
                    h('span',{style:{fontSize:'11px',color:'var(--dsw-alias-label-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},`${item.artist||item.source_name||'作者未提供'} · ${item.duration!=null&&Number.isFinite(Number(item.duration))?Number(item.duration).toFixed(1)+' 秒':'时长未知'}`),
                    h('span',{style:{fontSize:'11px',color:'var(--dsw-alias-label-secondary)',overflowWrap:'anywhere'}},`BPM ${bpm??'未测'} · 置信度 ${conf!=null&&Number.isFinite(Number(conf))?Math.round(Number(conf)*100)+'%':'未提供'} · ${item.license_status==='personal_confirmed'?'用户声明个人用途':'授权未知'}`)
                  )
                );
              }),
              !loading&&visibleItems.length===0&&h('div',{style:{gridColumn:'1 / -1',padding:'24px 12px',textAlign:'center',fontSize:'12px',color:'var(--dsw-alias-label-secondary)'}},'没有符合筛选条件的音乐')
            ),
          ),
          h('aside',{style:{...musicRightStyle,borderLeft:'1px solid var(--dsw-alias-border-l1)',padding:'10px',gap:'9px'},'aria-label':'音乐详情'},
              !selected&&h('div',{style:{padding:'24px 8px',textAlign:'center',fontSize:'12px',color:'var(--dsw-alias-label-secondary)'}},'从左侧选择音乐以查看播放、测量和风格记录。'),
              selected&&h(React.Fragment,null,
                h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px'}},
                  h('div',{style:{minWidth:0}},h('h3',{style:{margin:'0 0 4px',fontSize:'15px',overflowWrap:'anywhere'}},selected.title||selected.file_name),h('div',{style:{fontSize:'12px',color:'var(--dsw-alias-label-secondary)'}},`${selected.artist||selected.source_name||'作者未提供'} · ${selected.duration?Number(selected.duration).toFixed(1)+' 秒':'时长未知'}`)),
                  h('button',{type:'button',style:secondary,disabled:!!busy,onClick:removeMusic},'从音乐库移除')
                ),
                sourceCurrent&&h('audio',{controls:true,preload:'metadata','aria-label':`试听 ${selected.title||selected.file_name}`,src:`/api/media-center/editing/music/${encodeURIComponent(selected.id)}/stream`,style:{width:'100%',position:'sticky',top:0,zIndex:8,backgroundColor:'var(--dsw-alias-bg-layer-1)',padding:'4px 0'}}),
                 !sourceCurrent&&h('div',{role:'alert',style:{fontSize:'12px',color:'var(--dsw-alias-label-secondary)'}},'源文件缺失或身份已变化；请从本地音乐重新导入后再试听和分析。'),
                h('div',{style:{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',fontSize:'12px'}},
                  h('span',null,`来源状态：${sourceCurrent?'当前文件与导入时匹配':'缺失/已变化'} · 许可状态：${activeRights?'用户已声明个人用途（未独立核验）':'未知'}`),
                  !activeRights&&h('button',{type:'button',style:secondary,disabled:!!busy||!sourceCurrent,onClick:confirmPersonal},'确认个人使用权限')
                ),
                h('details',{style:{fontSize:'11px',color:'var(--dsw-alias-label-secondary)',border:'1px solid var(--dsw-alias-border-l1)',borderRadius:'5px',padding:'7px 8px'}},
                  h('summary',{style:{cursor:'pointer',fontWeight:600,color:'var(--dsw-alias-label-primary)'}},'分析逻辑与拍点确认'),
                  h('div',{style:{marginTop:'6px',lineHeight:'1.55'}},'本地测量由 FFmpeg 读取所选源音频窗口并转为单声道 PCM；内部瞬态检测只用于推导速度与拍点候选，原始瞬态列表不再展示或提供给 Agent。确认方式：先试听，再展开“选择拍点候选”并勾选听审认可的时间点，最后点击“确认所选拍点”；只有明确确认的点才会记录为人工拍点。可选的大模型功能会把本窗口生成的对数频率频谱图作为 DSH 图片附件发送给设置中的图像模型，给出节奏质感、能量走势和场景建议；频谱图模型会给出粗略速度假设、相对时间节奏提示、场景与风格标签；它们是视觉推断，不是精确拍点或DSP测量，需试听确认并可手动编辑。')
                ),
                h('div',{style:{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'110px 130px auto',gap:'7px',alignItems:'end'}},
                  h('label',{style:{fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},'分析起点（秒）',h('input',{type:'number','aria-label':'音乐分析起点',min:0,value:startSeconds,onChange:e=>setStartSeconds(e.target.value),style:fieldStyle})),
                  h('label',{style:{fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},'窗口长度（默认整首，最多10分钟）',h('input',{type:'number','aria-label':'音乐分析窗口长度',min:0.1,max:MAX_MUSIC_ANALYSIS_SECONDS,value:durationSeconds,onChange:e=>setDurationSeconds(e.target.value),style:fieldStyle})),
                  h('button',{type:'button',style:primary,disabled:!!busy||!sourceCurrent,onClick:analyze},'分析所选窗口')
                ),
                h('div',{style:{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',marginTop:'6px'}},
                  h('button',{type:'button',style:modelWindowMatches?secondary:{...secondary,opacity:0.58,cursor:'not-allowed'},disabled:!!busy||!analysisId||!modelWindowMatches||!sourceCurrent,onClick:interpretMusic,'aria-label':'使用大模型解读频谱图',title:'只将生成的频谱图作为 DSH 图片附件发送给已配置图像模型，不发送原始音频'},Icon.sparkles({size:13}),profile?.model_interpretation?'重新生成频谱解读':'大模型频谱解读'),
                  h('span',{style:{fontSize:'10px',color:'var(--dsw-alias-label-secondary)'}},modelWindowMatches?'只发送派生频谱图；模型结果是主观场景建议。':profile?'输入窗口与已测窗口不同；请先重新运行本地分析。':'先运行本地分析，再可使用频谱图模型解读。')
                ),
                selected&&Number(selected.duration)>MAX_MUSIC_ANALYSIS_SECONDS&&h('div',{role:'status',style:{fontSize:'10px',color:'var(--dsw-alias-label-secondary)',marginTop:'4px'}},'音频长于10分钟上限；当前默认使用前10分钟，可修改起点分段分析。'),
                profile&&h('div',{style:{borderTop:'1px solid var(--dsw-alias-border-l1)',paddingTop:'8px',minWidth:0}},
                  h('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap',fontSize:'12px'}},
                    h('strong',null,`分析状态：${statusLabel}`),
                    h('span',null,`BPM 估计：${profile.bpm??profile.estimated_bpm??'未检测到'}`),
                    h('span',null,`置信度：${confidenceLabel}`),

                  ),
                  tempoAlternatives.length>0&&h('div',{style:{marginTop:'5px',fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},`速度候选：${tempoAlternatives.slice(0,6).map(item=>typeof item==='number'?item:`${item.bpm??item.value??'?'} BPM`).join(' · ')}`),
                  Object.keys(featureSummary).length>0&&h('div',{style:{marginTop:'6px',fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},`音频信号特征（非风格判断）：平均 RMS ${featureSummary.mean_rms??'—'} · 动态范围 ${featureSummary.dynamic_range_db??'—'} dB`),
                                    profile.model_interpretation&&h('div',{style:{marginTop:'8px',padding:'9px',border:'1px solid var(--dsw-alias-border-l1)',borderRadius:'6px',backgroundColor:'var(--dsw-alias-bg-layer-1)'}},
                    h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}},
                      h('strong',{style:{fontSize:'12px'}},'频谱图模型解读（主观推测）'),
                      h('button',{type:'button',style:secondary,disabled:!!busy,onClick:()=>modelInterpretationDraft?setModelInterpretationDraft(null):beginModelInterpretationEdit(),'aria-label':modelInterpretationDraft?'取消编辑频谱解读':'编辑频谱解读与风格标签'},Icon.edit({size:12}),modelInterpretationDraft?'取消':'编辑')
                    ),
                    profile.model_interpretation_provenance&&h('div',{style:{fontSize:'10px',marginTop:'3px',color:'var(--dsw-alias-label-secondary)'}},`模型 ${profile.model_interpretation_provenance.model||'未知'} · ${profile.model_interpretation_provenance.analyzed_at||''}${profile.model_interpretation_edits_provenance?' · 用户已编辑':''}`),
                    modelInterpretationDraft?h('div',{style:{display:'flex',flexDirection:'column',gap:'6px',marginTop:'7px'}},
                      h('label',{style:{fontSize:'10px',color:'var(--dsw-alias-label-secondary)'}},'解读摘要',h('textarea',{'aria-label':'编辑模型解读摘要',value:modelInterpretationDraft.summary,onChange:e=>setModelInterpretationDraft(d=>({...d,summary:e.target.value})),style:{...fieldStyle,minHeight:'55px',resize:'vertical'}})),
                      h('label',{style:{fontSize:'10px',color:'var(--dsw-alias-label-secondary)'}},'节奏质感',h('input',{'aria-label':'编辑模型节奏质感',value:modelInterpretationDraft.rhythm_character,onChange:e=>setModelInterpretationDraft(d=>({...d,rhythm_character:e.target.value})),style:fieldStyle})),
                      h('label',{style:{fontSize:'10px',color:'var(--dsw-alias-label-secondary)'}},'能量走势',h('input',{'aria-label':'编辑模型能量走势',value:modelInterpretationDraft.energy_arc,onChange:e=>setModelInterpretationDraft(d=>({...d,energy_arc:e.target.value})),style:fieldStyle})),
                      h('label',{style:{fontSize:'10px',color:'var(--dsw-alias-label-secondary)'}},'风格标签（逗号或换行分隔）',h('textarea',{'aria-label':'编辑模型风格标签',value:modelInterpretationDraft.style_tags,onChange:e=>setModelInterpretationDraft(d=>({...d,style_tags:e.target.value})),style:{...fieldStyle,minHeight:'48px',resize:'vertical'}})),
                      h('div',{style:{display:'flex',justifyContent:'flex-end',gap:'6px'}},h('button',{type:'button',style:secondary,disabled:!!busy,onClick:()=>setModelInterpretationDraft(null)},'取消'),h('button',{type:'button',style:primary,disabled:!!busy,onClick:saveModelInterpretationEdit},'保存编辑'))
                    ):h(React.Fragment,null,
                      h('div',{style:{fontSize:'11px',marginTop:'6px',lineHeight:'1.5'}},modelInterpretationView?.summary),
                      h('div',{style:{fontSize:'11px',marginTop:'5px',color:'var(--dsw-alias-label-secondary)'}},`节奏质感：${modelInterpretationView?.rhythm_character||'—'} · 能量走势：${modelInterpretationView?.energy_arc||'—'}`),
                      (profile.model_interpretation.tempo_hypotheses||[]).length>0&&h('div',{style:{fontSize:'11px',marginTop:'5px'}},'模型速度推测（非DSP测量）： ',profile.model_interpretation.tempo_hypotheses.map(item=>`${item.bpm} BPM · ${item.confidence}`).join('；')),
                      h('div',{style:{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'6px'}},(modelInterpretationView?.style_tags||[]).length?(modelInterpretationView.style_tags.map((tag,index)=>h('span',{key:`model-tag-${index}`,style:{fontSize:'10px',padding:'2px 6px',borderRadius:'10px',border:'1px solid var(--dsw-alias-border-l1)',color:'var(--dsw-alias-label-primary)'}},tag))):h('span',{style:{fontSize:'10px',color:'var(--dsw-alias-label-secondary)'}},'暂无模型风格标签')),
                      h('div',{style:{display:'flex',flexDirection:'column',gap:'5px',marginTop:'6px'}},(modelInterpretationView?.scene_suggestions||[]).map((item,index)=>h('div',{key:`scene-${index}`,style:{fontSize:'11px'}},h('strong',null,`${item.scene}（${item.fit||'medium'}）`),`：${item.reason}`))),
                      modelBeatHints.length>0&&h('details',{style:{marginTop:'7px'}},h('summary',{style:{fontSize:'10px',cursor:'pointer',color:'var(--dsw-alias-label-secondary)'}},`模型节奏点推测 (${modelBeatHints.length}) · 近似视觉估计，试听确认后才记录`),
                        h('div',{style:{display:'flex',flexDirection:'column',gap:'5px',marginTop:'6px'}},modelBeatHints.map((hint,index)=>{
                          const time=Number(hint.source_seconds),confirmed=confirmedModelBeatTimes.some(value=>Math.abs(value-time)<=0.1),key=String(hint.source_seconds);
                          return h('label',{key:`model-beat-${index}`,style:{display:'flex',alignItems:'flex-start',gap:'6px',fontSize:'10px',color:'var(--dsw-alias-label-primary)'}},
                            h('input',{type:'checkbox','aria-label':`选择模型节奏提示约 ${time.toFixed(1)} 秒`,checked:confirmed||selectedModelBeatSuggestions.has(key),disabled:!!busy||confirmed,onChange:e=>setSelectedModelBeatSuggestions(current=>{const next=new Set(current);if(e.target.checked)next.add(key);else next.delete(key);return next;})}),
                            h('span',null,`约 ${time.toFixed(1)} 秒 · ${hint.confidence||'low'} 置信度${confirmed?' · 用户已试听确认':''} · ${hint.reason||'模型视觉估计'}`)
                          );
                        })),
                        selectedModelBeatSuggestions.size>0&&h('button',{type:'button',style:secondary,disabled:!!busy,onClick:confirmModelBeatHints},`确认所选模型节奏提示 (${selectedModelBeatSuggestions.size})`)
                      ),
                      (profile.model_interpretation.uncertainties||[]).length>0&&h('div',{style:{marginTop:'6px',fontSize:'10px',color:'var(--dsw-alias-label-secondary)'}},`不确定性：${profile.model_interpretation.uncertainties.join('；')}`)
                    )
                  ),windowDuration>0&&h(React.Fragment,null,
                    h('div',{style:{display:'flex',gap:'12px',flexWrap:'wrap',fontSize:'10px',color:'var(--dsw-alias-label-secondary)',marginTop:'8px'}},
                      h('span',null,`拍点候选 (${beatCandidates.length})`),h('span',{style:{color:'#2563eb'}},`用户确认拍点 (${confirmedBeats.length})`)
                    ),
                    h('div',{style:trackStyles,'aria-label':'候选拍点与用户确认拍点时间轴'},markers(beatCandidates,'candidate'),markers(confirmedBeats,'confirmed'),beatCandidates.length===0&&h('span',{style:{position:'absolute',inset:0,display:'grid',placeItems:'center',textAlign:'center',fontSize:'10px',color:'var(--dsw-alias-label-secondary)'}},'此窗口没有本地拍点候选；可参考模型近似节奏提示'))
                  ),

                  h('details',{style:{marginTop:'8px'}},h('summary',{style:{fontSize:'11px',cursor:'pointer',color:'var(--dsw-alias-label-secondary)'}},`选择拍点候选 (${beatCandidates.length}) · 试听核对后勾选`,),timeRows('拍点候选（不等于已确认拍点）',beatCandidates,true,512)),
                  timeRows('用户确认拍点',confirmedBeats,false),
                  h('div',{style:{marginTop:'8px',padding:'8px',border:'1px solid var(--dsw-alias-border-l1)',borderRadius:'5px',fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},
                    h('div',null,beatConfirmationGuidance),
                    h('button',{type:'button',style:confirmBeatsDisabled?{...secondary,opacity:0.6,cursor:'not-allowed'}:primary,disabled:confirmBeatsDisabled,onClick:confirmBeats,'aria-label':'确认所选候选拍点'},canConfirmBeats?`确认所选拍点 (${selectedBeatTimes.length})`:'暂无拍点候选')
                  ),
                  h('div',{style:{marginTop:'10px',borderTop:'1px solid var(--dsw-alias-border-l1)',paddingTop:'8px'}},
                    h('strong',{style:{fontSize:'12px'}},'风格标签'),
                    h('div',{style:{fontSize:'11px',marginTop:'5px',color:'var(--dsw-alias-label-secondary)'}},'DSH Agent 建议（仅记录，不在插件内生成）'),
                    h('div',{style:{display:'flex',flexDirection:'column',gap:'5px',marginTop:'4px'}},suggestedStyles.length?suggestedStyles.map((tag,index)=>renderStyleTag(tag,index,'suggested')):h('span',{style:{fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},'暂无 DSH Agent 风格建议')),
                    h('div',{style:{fontSize:'11px',marginTop:'8px',color:'var(--dsw-alias-label-secondary)'}},'用户确认的 Agent 风格建议'),
                     styleRationale&&h('div',{style:{fontSize:'11px',marginTop:'4px',color:'var(--dsw-alias-label-secondary)',whiteSpace:'pre-wrap'}},styleRationale),
                    h('div',{style:{display:'flex',flexDirection:'column',gap:'5px',marginTop:'4px'}},confirmedStyles.length?confirmedStyles.map((tag,index)=>renderStyleTag(tag,index,'confirmed')):h('span',{style:{fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},'暂无用户确认标签')),
                    unclassifiedStyles.length>0&&h('div',{style:{marginTop:'8px',fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},`有 ${unclassifiedStyles.length} 个风格标签未标注来源；未视为 Agent 建议或用户确认。`)
                  ),
                  profile.provenance&&h('details',{style:{marginTop:'8px'}},h('summary',{style:{fontSize:'11px',cursor:'pointer'}},'测量来源'),h('pre',{style:{...listPre,maxHeight:'100px',overflow:'auto'}},JSON.stringify(profile.provenance,null,2)))
                )
              )
            )
          ]}),
          importDialog
      );
    }

    // --- Main Workbench View Component with Mobile Responsive Layout ---
    function MediaCenterWorkbench() {
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
      const [previewInfo, setPreviewInfo] = useState(null);
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
      const [cacheUsage, setCacheUsage] = useState(null);
      const [cacheBusy, setCacheBusy] = useState(false);
      const [activeLibrary,setActiveLibrary]=useState('video');
      const [showScanModal, setShowScanModal] = useState(false);
      const [showNewFolderModal, setShowNewFolderModal] = useState(false);
      const [showExportModal, setShowExportModal] = useState(false);

      // Folder Action Popup state
      const [activeFolderMenuId, setActiveFolderMenuId] = useState(null);
      const [renamingFolder, setRenamingFolder] = useState(null); // { id, name }
      const [newSubFolderParentId, setNewSubFolderParentId] = useState(null);

      // Video Card Action Popup state
      const [activeVideoMenuId, setActiveVideoMenuId] = useState(null);
      const [summaryVideoId, setSummaryVideoId] = useState(null);
      const [singleMoveVideoId, setSingleMoveVideoId] = useState(null);

      // Import Loading state (Prevents repeated submission and gives immediate feedback)
      const [isImporting, setIsImporting] = useState(false);
      const importLockRef = useRef(false);
      const [importNotice, setImportNotice] = useState('');
      const [importProgress, setImportProgress] = useState(() => {
        try {
          const id = window.sessionStorage.getItem('dsh-media-center-active-import');
          if (id) return { id, status: 'running' };
          const pending = JSON.parse(window.localStorage.getItem('dsh-media-center-pending-import') || 'null');
          if (pending?.url) return { status: 'interrupted', total: null };
          return null;
        } catch { return null; }
      });
      const [pendingImport, setPendingImport] = useState(() => {
        try { return JSON.parse(window.localStorage.getItem('dsh-media-center-pending-import') || 'null'); } catch { return null; }
      });

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
      const [aiConcurrency, setAiConcurrency] = useState(3);
      const [settingsSection, setSettingsSection] = useState('general');
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
      const [selectedBrowserFolders, setSelectedBrowserFolders] = useState(new Set()); // Set of checked child folder paths

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
          const res = await fetch('/api/media-center/status');
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
          const res = await fetch('/api/media-center/folders');
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

          let url = '/api/media-center/videos?limit=200';
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
          const res = await fetch(`/api/media-center/videos/${videoId}`);
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

      useEffect(() => {
        if (!importProgress?.id || !['queued', 'running', 'initializing', 'scanning', 'importing', 'storyboarding'].includes(importProgress.status)) return;
        let cancelled = false, timer;
        importLockRef.current = true;
        setIsImporting(true);
        const poll = async () => {
          try {
            const response = await fetch(`/api/media-center/import-jobs/${encodeURIComponent(importProgress.id)}`);
            if (response.status === 404) {
              if (!cancelled) {
                setImportProgress({ status: 'interrupted', error: '后台任务已不可查询；可从此处继续本次导入。' });
                importLockRef.current = false; setIsImporting(false);
                try { window.sessionStorage.removeItem('dsh-media-center-active-import'); } catch {}
                await refreshCurrentViewRef.current();
              }
              return;
            }
            const data = await response.json();
            if (!response.ok || !data.success || !data.job) throw new Error(data.error || '无法读取导入进度');
            if (cancelled) return;
            setImportProgress(data.job);
            const active = ['queued', 'running', 'initializing', 'scanning', 'importing', 'storyboarding'].includes(data.job.status);
            if (!active) {
              importLockRef.current = false; setIsImporting(false);
              try { window.sessionStorage.removeItem('dsh-media-center-active-import'); } catch {}
              if (['completed', 'completed_with_errors'].includes(data.job.status)) clearPendingImport();
            }
            await refreshCurrentViewRef.current();
            if (!cancelled && active) timer = setTimeout(poll, 1200);
          } catch (error) {
            if (!cancelled) { setImportProgress(current => ({ ...current, status: 'connection_error', error: error.message || '无法读取导入进度；任务可能仍在后台运行。' })); }
          }
        };
        timer = setTimeout(poll, 500);
        return () => { cancelled = true; clearTimeout(timer); };
      }, [importProgress?.id, importProgress?.status]);

      useEffect(() => {
        if (!videos.some(v => ['pending', 'generating'].includes(v.storyboard_status))) return;
        const timer = setInterval(() => { refreshCurrentViewRef.current(); }, 3000);
        return () => clearInterval(timer);
      }, [videos]);

      useEffect(() => {
        const id = selectedVideo?.id;
        setPreviewInfo(null);
        if (!id) return;
        let cancelled = false;
        fetch(`/api/media-center/videos/${encodeURIComponent(id)}/preview`)
          .then(response => response.json())
          .then(data => { if (!cancelled && data.success) setPreviewInfo(data.preview); })
          .catch(() => { if (!cancelled) setPreviewInfo({ required: false, status: 'unknown' }); });
        return () => { cancelled = true; };
      }, [selectedVideo?.id]);

      const loadCacheUsage = async () => {
        try {
          const response = await fetch('/api/media-center/cache');
          const data = await response.json();
          if (data.success) setCacheUsage(data.usage || null);
        } catch {}
      };
      const clearPluginCache = async (scope) => {
        if (cacheBusy) return;
        if (!window.confirm(scope === 'previews' ? '仅清理兼容预览缓存？源视频与故事板不受影响。' : '清理故事板、预览、关键帧和音乐频谱图缓存？源视频不受影响，故事板需要重新生成。')) return;
        setCacheBusy(true);
        try {
          const response = await fetch('/api/media-center/cache/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope }) });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || '清理缓存失败');
          setCacheUsage(data.usage || null);
          await refreshCurrentViewRef.current();
        } catch (error) { alert('清理缓存失败：' + (error.message || '未知错误')); }
        finally { setCacheBusy(false); }
      };

      // 5. Load AI Settings
      const loadAiCatalog = async () => {
        try {
          const response = await fetch('/api/media-center/ai-models');
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
          const res = await fetch('/api/media-center/ai-settings');
          const data = await res.json();
          if (data.success) {
            setAiMode(data.mode || 'dsh');
            setAiProviderInput(data.provider || '');
            setAiBaseUrlInput(data.base_url || '');
            setAiModelInput(data.model || '');
            setAiReasoningInput(data.reasoning_effort || '');
            setAiConcurrency(Number(data.concurrency) || 3);
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
          const response = await fetch('/api/media-center/shot-analysis-settings');
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
        const response = await fetch('/api/media-center/shot-analysis-settings', {
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
        setSelectedBrowserFolders(new Set());
        try {
          const url = dirPath
            ? `/api/media-center/fs/browse?dir=${encodeURIComponent(dirPath)}`
            : `/api/media-center/fs/browse`;
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
        setSelectedBrowserFolders(new Set());
      };

      // Toggle select all video files in current browsing directory
      const toggleSelectAllBrowserFiles = () => {
        const allFiles = (browserData && browserData.video_files) || [];
        if (allFiles.length === 0) return;
        setSelectedBrowserFolders(new Set());
        if (selectedBrowserFiles.size === allFiles.length) {
          setSelectedBrowserFiles(new Set());
        } else {
          setSelectedBrowserFiles(new Set(allFiles.map(f => f.path)));
        }
      };
      const toggleBrowserFolder = folderPath => {
        const next=new Set(selectedBrowserFolders);
        if(next.has(folderPath))next.delete(folderPath);
        else {if(next.size>=50){alert('一次最多选择 50 个子文件夹。');return;}next.add(folderPath);}
        setSelectedBrowserFolders(next);
        setSelectedBrowserFiles(new Set());
      };
      const toggleSelectAllBrowserFolders = () => {
        const folders=browserData?.folders||[];
        if(!folders.length)return;
        if(folders.length>50){alert('当前目录子文件夹超过 50 个，请手动选择需要导入的文件夹。');return;}
        setSelectedBrowserFiles(new Set());
        setSelectedBrowserFolders(selectedBrowserFolders.size===folders.length?new Set():new Set(folders.map(folder=>folder.path)));
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
        `/api/media-center/videos/${encodeURIComponent(videoId)}/shots/${encodeURIComponent(shotId)}/${suffix}`;
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
          const response = await fetch(`/api/media-center/shot-analysis/${encodeURIComponent(run.id)}/apply`, {
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
              run.storyboard_path && run.id && h('img', { src: `/api/media-center/shot-analysis/${encodeURIComponent(run.id)}/storyboard`, alt: '镜头采样故事板', style: { display: 'block', width: '100%', height: 'auto', borderRadius: '4px' } }),
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
          const res = await fetch(`/api/media-center/videos/${videoId}/ai-analyze`, { method: 'POST' });
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
          const res = await fetch('/api/media-center/videos/batch-ai-analyze', {
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
          const res = await fetch('/api/media-center/ai-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: aiMode,
              provider: aiProviderInput,
              base_url: aiBaseUrlInput,
              api_key: aiMode === 'custom' ? (aiApiKeyInput || undefined) : undefined,
              model: aiModelInput,
              reasoning_effort: aiMode === 'dsh' ? aiReasoningInput : undefined,
              concurrency: Number(aiConcurrency),
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
          const res = await fetch(`/api/media-center/folders/${folderId}`, {
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
          const res = await fetch(`/api/media-center/folders/${folderId}`, { method: 'DELETE' });
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
          const res = await fetch(`/api/media-center/videos/${videoId}`, { method: 'DELETE' });
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
          const res = await fetch('/api/media-center/videos/batch-delete', {
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
          const res = await fetch('/api/media-center/videos/batch-move', {
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
          const res = await fetch(`/api/media-center/videos/${selectedVideo.id}`, {
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
          const res = await fetch('/api/media-center/shots', {
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
          const res = await fetch('/api/media-center/audio', {
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
          const res = await fetch('/api/media-center/settings', {
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

      const rememberPendingImport = (url, body) => {
        const pending = { url, body, saved_at: new Date().toISOString() };
        setPendingImport(pending);
        try { window.localStorage.setItem('dsh-media-center-pending-import', JSON.stringify(pending)); } catch {}
      };
      const clearPendingImport = () => {
        setPendingImport(null);
        try { window.localStorage.removeItem('dsh-media-center-pending-import'); } catch {}
      };
      const startVideoImport = async (url, body) => {
        if (importLockRef.current) return;
        importLockRef.current = true;
        setIsImporting(true);
        setShowScanModal(false);
        setImportNotice('');
        rememberPendingImport(url, body);
        setImportProgress({ status: 'starting', total: null, completed: 0 });
        try {
          const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const data = await response.json();
          if (!response.ok || !data.success || !data.job?.id) throw new Error(data.error || '无法启动导入任务');
          try { window.sessionStorage.setItem('dsh-media-center-active-import', data.job.id); } catch {}
          setImportProgress(data.job);
          await refreshCurrentViewRef.current();
          if (['completed', 'completed_with_errors'].includes(data.job.status)) {
            clearPendingImport();
            importLockRef.current = false; setIsImporting(false);
            try { window.sessionStorage.removeItem('dsh-media-center-active-import'); } catch {}
          }
        } catch (error) {
          setImportProgress({ status: 'failed', error: error.message || '导入启动失败' });
          importLockRef.current = false;
          setIsImporting(false);
          await refreshCurrentViewRef.current();
        }
      };
      const cancelVideoImport = async () => {
        if (!importProgress?.id) return;
        try {
          const response = await fetch(`/api/media-center/import-jobs/${encodeURIComponent(importProgress.id)}`, { method: 'POST' });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || '无法中断导入');
          setImportProgress(data.job);
        } catch (error) { setImportProgress(current => ({ ...current, error: error.message || '无法中断导入' })); }
      };
      const resumeVideoImport = async () => {
        if (!pendingImport?.url) return;
        await startVideoImport(pendingImport.url, pendingImport.body);
      };
      const regenerateStoryboard = async (videoId) => {
        try {
          const response = await fetch(`/api/media-center/videos/${encodeURIComponent(videoId)}/storyboard`, { method: 'POST' });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || '无法重新生成故事板');
          setVideos(current => current.map(video => video.id === videoId ? { ...video, storyboard_status: 'generating', storyboard_error: null } : video));
        } catch (error) { alert('重新生成故事板失败：' + (error.message || '未知错误')); }
      };
      const clearCompatiblePreview = async (videoId) => {
        try {
          await fetch(`/api/media-center/videos/${encodeURIComponent(videoId)}/preview`, { method: 'DELETE' });
          if (selectedVideo?.id === videoId) setPreviewInfo(current => current?.required ? { ...current, status: 'missing' } : current);
        } catch {}
      };
      const openInSystemPlayer = async (videoId) => {
        try {
          const response = await fetch(`/api/media-center/videos/${encodeURIComponent(videoId)}/open`, { method: 'POST' });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || '无法打开系统播放器');
        } catch (error) { alert('打开原视频失败：' + (error.message || '请检查源文件是否可用')); }
      };
      const startCompatiblePreview = async () => {
        if (!selectedVideo?.id) return;
        setPreviewInfo(current => ({ ...current, status: 'generating' }));
        try {
          const response = await fetch(`/api/media-center/videos/${encodeURIComponent(selectedVideo.id)}/preview`, { method: 'POST' });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || '无法生成兼容预览');
          setPreviewInfo(data.preview);
          const poll = async () => {
            const statusResponse = await fetch(`/api/media-center/videos/${encodeURIComponent(selectedVideo.id)}/preview`);
            const statusData = await statusResponse.json();
            if (!statusData.success) return;
            setPreviewInfo(statusData.preview);
            if (['missing', 'generating'].includes(statusData.preview?.status)) setTimeout(poll, 2000);
          };
          setTimeout(poll, 1500);
        } catch (error) {
          setPreviewInfo(current => ({ ...current, status: 'failed', error: error.message || '兼容预览生成失败' }));
        }
      };

      // Scan directory with feedback & parent_id propagation
      const handleScanDirectory = async (customPath) => {
        if (importLockRef.current) return;
        const targetPath = (customPath || scanDirPath || '').trim();
        if (!targetPath) return;

        await startVideoImport('/api/media-center/folders/scan', { directory_path: targetPath, parent_id: selectedFolderId || null });
      };

      const handleScanSelectedFolders = async () => {
        const directoryPaths=Array.from(selectedBrowserFolders);
        if(importLockRef.current||!directoryPaths.length||!browserData?.current_path)return;
        if(directoryPaths.length>50){alert('一次最多选择 50 个子文件夹。');return;}
        if(!window.confirm(`将递归导入 ${directoryPaths.length} 个所选文件夹中的所有视频，并把它们作为当前素材分类的子分类。源视频不会复制或修改。继续？`))return;
        setSelectedBrowserFolders(new Set());
        await startVideoImport('/api/media-center/folders/scan-selected', {
          parent_directory_path: browserData.current_path, directory_paths: directoryPaths, parent_id: selectedFolderId || null
        });
      };

      // Import selected video files directly (supports multiple / select all)
      const handleImportSelectedFiles = async (filePathsOverride) => {
        const targetPaths = filePathsOverride || Array.from(selectedBrowserFiles);
        if (importLockRef.current || !targetPaths || targetPaths.length === 0) return;

        setSelectedBrowserFiles(new Set());
        await startVideoImport('/api/media-center/videos/import-files', { file_paths: targetPaths, folder_id: selectedFolderId || null });
      };

      const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
          const res = await fetch('/api/media-center/folders', {
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

          const res = await fetch('/api/media-center/export', {
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
        renderMediaLibraryHeader({
          active: activeLibrary,
          onSelect: tab => { setActiveLibrary(tab); setShowSettingsModal(false); setShowExportModal(false); setShowScanModal(false); setShowBatchMoveModal(false); setShowNewFolderModal(false); setRenamingFolder(null); },
          isMobile, status,
          onSettings: () => { loadAiSettings(); loadShotAnalysisSettings(); loadCacheUsage(); setShowSettingsModal(true); },
          buttonStyle: buttonSecondaryStyle
        }),
        importProgress && h('div', {          role: 'status', 'aria-live': 'polite', 'aria-label': '视频导入进度',
          style: { position: 'absolute', right: '16px', bottom: '16px', zIndex: 80, width: 'min(360px, calc(100% - 32px))',
            padding: '12px', borderRadius: '8px', backgroundColor: 'var(--dsw-alias-bg-layer-1)',
            border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-primary)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)', fontSize: '12px' }
        },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' } },
            h('strong', null, ['starting', 'initializing', 'scanning'].includes(importProgress.status) ? '正在统计待导入视频…' :
              importProgress.status === 'connection_error' ? '进度连接中断' : importProgress.status === 'failed' ? '导入失败' :
              importProgress.status === 'cancelled' || importProgress.status === 'interrupted' ? '导入已中断' :
              importProgress.status === 'cancelling' ? '正在中断导入…' :
              ['queued', 'running', 'importing', 'storyboarding'].includes(importProgress.status) ? '视频导入中' :
              importProgress.status === 'completed_with_errors' ? '导入完成（部分失败）' : '视频导入完成'),
            !['starting', 'initializing', 'scanning', 'queued', 'running', 'importing', 'storyboarding', 'cancelling'].includes(importProgress.status) && h('button', {
              type: 'button', style: buttonSecondaryStyle, onClick: () => {
                importLockRef.current = false; setIsImporting(false);
                try { window.sessionStorage.removeItem('dsh-media-center-active-import'); } catch {}
                setImportProgress(null);
              }, 'aria-label': '关闭导入进度'
            }, '关闭')
          ),
          h('div', { style: { display: 'flex', gap: '6px', marginTop: '8px' } },
            ['queued', 'running', 'initializing', 'scanning', 'importing', 'storyboarding'].includes(importProgress.status) && !importProgress.cancel_requested && h('button', {
              type: 'button', style: buttonSecondaryStyle, onClick: cancelVideoImport, 'aria-label': '中断视频导入'
            }, '中断导入'),
            importProgress.cancel_requested && h('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '正在停止当前处理…'),
            ['cancelled', 'interrupted', 'failed', 'connection_error'].includes(importProgress.status) && pendingImport && h('button', {
              type: 'button', style: buttonPrimaryStyle, onClick: resumeVideoImport, 'aria-label': '继续上次视频导入'
            }, '继续导入'),
            (importProgress.status === 'cancelled' || importProgress.status === 'interrupted') && pendingImport && h('button', {
              type: 'button', style: buttonSecondaryStyle, onClick: () => { clearPendingImport(); setImportProgress(null); }
            }, '放弃本次导入')
          ),
          importProgress.total_known === false && h('div', { style: { marginTop: '7px' } }, `正在扫描，已发现 ${importProgress.discovered || 0} 个视频${importProgress.requested_count ? `（已选择 ${importProgress.requested_count} 项）` : ''}…`),
          importProgress.total != null && importProgress.total_known !== false && h('div', { style: { marginTop: '7px', lineHeight: '1.6' } },
            `发现 ${importProgress.total} 个视频 · 需导入 ${importProgress.importable ?? '计算中'} 个`,
            h('br'), `已判定 ${importProgress.processed || 0} · 全流程完成 ${importProgress.completed || 0}`,
            h('br'), `新增 ${importProgress.inserted || 0} · 已存在 ${importProgress.duplicates || 0}${importProgress.input_duplicates ? ` · 重复选择 ${importProgress.input_duplicates}` : ''} · 失败 ${importProgress.failed || 0}`,
            h('br'), `故事板 ${importProgress.storyboard_done || 0}/${importProgress.storyboard_total || 0}${importProgress.storyboard_failed ? ` · 失败 ${importProgress.storyboard_failed}` : ''}`
          ),
          importProgress.total_known !== false && Number.isFinite(importProgress.percent) && h('progress', { max: 100, value: Math.max(0, Math.min(100, importProgress.percent)),
            'aria-label': '导入及故事板进度', style: { display: 'block', width: '100%', marginTop: '8px' } }),
          importProgress.error && h('div', { style: { color: 'var(--dsw-alias-state-error-primary)', marginTop: '6px', overflowWrap: 'anywhere' } }, importProgress.error),
          Array.isArray(importProgress.items) && importProgress.items.some(item => item.error_code) && h('details', { style: { marginTop: '6px' } },
            h('summary', { style: { cursor: 'pointer' } }, '查看失败项'),
            h('div', { style: { maxHeight: '120px', overflowY: 'auto', overflowWrap: 'anywhere' } },
              importProgress.items.filter(item => item.error_code).map((item, index) => h('div', { key: `${item.video_id || item.file_name || 'item'}-${index}` }, `${item.file_name || '视频'}：${item.error_code}`)))
          ),
          importProgress.items_omitted > 0 && h('div', { style: { marginTop: '4px', color: 'var(--dsw-alias-label-secondary)' } }, `进度明细已截断，另有 ${importProgress.items_omitted} 项未显示。`),
          importProgress.status === 'connection_error' && importProgress.id && h('button', { type: 'button', style: buttonSecondaryStyle,
            onClick: () => { importLockRef.current = true; setIsImporting(true); setImportProgress(current => ({ ...current, status: 'running', error: null })); } }, '重试读取进度')
        ),
        !importProgress && pendingImport && h('div', { role: 'status', 'aria-label': '未完成的视频导入', style: { position: 'absolute', right: '16px', bottom: '16px', zIndex: 79, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', fontSize: '12px', color: 'var(--dsw-alias-label-primary)' } },
          '有未完成的视频导入',
          h('button', { type: 'button', style: buttonPrimaryStyle, onClick: resumeVideoImport, 'aria-label': '继续上次视频导入' }, '继续导入'),
          h('button', { type: 'button', style: buttonSecondaryStyle, onClick: () => clearPendingImport() }, '忽略')
        ),
        activeLibrary === 'music' && h(MusicLibraryWorkbench, {
              isMobile, mobileTab, setMobileTab, isDraggingRef,
              layout: { bodyStyle, leftColStyle, midColStyle, rightColStyle },
              styles: { inputStyle, buttonPrimaryStyle, buttonSecondaryStyle, modalOverlayStyle, modalCardStyle },
              onResizeStart: e => { isDraggingRef.current = true; document.body.style.userSelect = 'none'; e.preventDefault(); }
            }),
        h(React.Fragment, null,
        activeLibrary === 'video' && renderLibrarySectionHeader({
          icon: Icon.clapperboard, title: '视频素材库', description: `${videos.length} 条素材`,
          actions: h('button', { type: 'button', style: buttonPrimaryStyle, onClick: () => setShowExportModal(true) }, Icon.scissors({ size: 13 }), isMobile ? '导出' : '导出剪辑工程')
        }),

        activeLibrary === 'video' && renderMobilePanelNavigation({isMobile,active:mobileTab,onSelect:setMobileTab,labels:[
          {id:'folders',label:'分类目录',icon:Icon.folder({size:13})},
          {id:'videos',label:`素材列表 (${videos.length})`,icon:Icon.grid({size:13})},
          {id:'detail',label:'视频详情',icon:Icon.film({size:13})}
        ]}),

        activeLibrary === 'video' && renderLibraryColumnLayout({bodyStyle,isMobile,isDraggingRef,onResizeStart:e=>{isDraggingRef.current=true;document.body.style.userSelect='none';e.preventDefault();},columns:[
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
                  onMouseEnter: () => setSummaryVideoId(v.id),
                  onMouseLeave: () => setSummaryVideoId(current => current === v.id ? null : current),
                  onFocus: () => setSummaryVideoId(v.id),
                  onBlur: e => { if (!e.currentTarget.contains(e.relatedTarget)) setSummaryVideoId(null); },
                  tabIndex: 0,
                  title: v.summary || undefined,
                  'aria-describedby': summaryVideoId === v.id && v.summary ? `video-summary-${v.id}` : undefined,
                  onKeyDown: e => { if (e.key === 'Escape') setSummaryVideoId(null); else if (e.key === 'Enter' && e.target === e.currentTarget) loadVideoDetail(v.id); },
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
                          src: `/api/media-center/videos/${v.id}/storyboard?v=${encodeURIComponent(v.updated_at || '')}`,
                          style: { width: '100%', height: '100%', objectFit: 'cover' },
                          alt: v.file_name
                        })
                      : h('div', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: '11px' } },
                          v.storyboard_status === 'pending' ? '故事板等待处理' : v.storyboard_status === 'generating' ? '正在生成故事板…' :
                          v.storyboard_status === 'failed' ? '故事板生成失败' : v.storyboard_status === 'not_started' ? '故事板未生成' : '无故事板大图'),
                    v.storyboard_status && v.storyboard_status !== 'ready' && h('span', {
                      style: { position: 'absolute', top: '6px', right: '6px', padding: '2px 5px', borderRadius: '3px',
                        backgroundColor: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', fontSize: '10px', zIndex: 5 }
                    }, v.storyboard_status === 'pending' ? '故事板排队' : v.storyboard_status === 'generating' ? '故事板生成中' : v.storyboard_status === 'not_started' ? '故事板未生成' : '故事板失败'),
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

                  summaryVideoId === v.id && !isMenuOpen && v.summary && h('div', {
                    role: 'tooltip', id: `video-summary-${v.id}`,
                    style: { position: 'absolute', left: '6px', right: '6px', top: isMobile ? '100%' : '120px', zIndex: 15,
                      padding: '10px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border-l2)',
                      backgroundColor: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.25)', fontSize: '12px', lineHeight: '1.5',
                      maxHeight: '240px', overflow: 'hidden', overflowWrap: 'anywhere', pointerEvents: 'none' }
                  }, h('strong', { style: { display: 'block', marginBottom: '4px' } }, '视频摘要'), v.summary),

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
                      style: { ...contextMenuItemStyle, opacity: v.storyboard_status === 'generating' ? 0.5 : 1, cursor: v.storyboard_status === 'generating' ? 'not-allowed' : 'pointer' },
                      onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--dsw-alias-bg-layer-2)',
                      onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
                      onClick: () => {
                        if (v.storyboard_status === 'generating') return;
                        setActiveVideoMenuId(null);
                        regenerateStoryboard(v.id);
                      }
                    }, Icon.clapperboard({ size: 12 }), '重新生成故事板'),
                    h('div', {
                      style: contextMenuItemStyle,
                      onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--dsw-alias-bg-layer-2)',
                      onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
                      onClick: () => {
                        setActiveVideoMenuId(null);
                        clearCompatiblePreview(v.id);
                      }
                    }, Icon.film({ size: 12 }), '清除兼容预览缓存'),
                    h('div', {
                      style: contextMenuItemStyle,
                      onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--dsw-alias-bg-layer-2)',
                      onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent',
                      onClick: () => {
                        setActiveVideoMenuId(null);
                        openInSystemPlayer(v.id);
                      }
                    }, Icon.play({ size: 12 }), '用系统播放器打开'),
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
                    previewInfo?.required && previewInfo.status !== 'ready'
                      ? h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', color: '#fff', fontSize: '12px', textAlign: 'center' } },
                          previewInfo.status === 'generating'
                            ? h(React.Fragment, null, Icon.loader({ size: 18, color: '#fff' }), '正在生成浏览器兼容预览（H.264），完成后自动播放…')
                            : previewInfo.status === 'failed'
                              ? h(React.Fragment, null, '兼容预览生成失败，可重试。',
                                  h('button', { type: 'button', style: buttonSecondaryStyle, onClick: startCompatiblePreview }, '重试生成'))
                              : h(React.Fragment, null, `此视频编码为 ${previewInfo.codec || 'HEVC'}，当前浏览器无法直接播放。`,
                                  h('button', { type: 'button', style: buttonPrimaryStyle, onClick: startCompatiblePreview }, '生成兼容预览')))
                      : h('video', {
                          ref: videoRef,
                          src: previewInfo?.required
                            ? `/api/media-center/videos/${selectedVideo.id}/stream?preview=1&v=${encodeURIComponent(selectedVideo.updated_at || '')}`
                            : `/api/media-center/videos/${selectedVideo.id}/stream`,
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
                          openInSystemPlayer(selectedVideo.id);
                        }
                      }, Icon.play({ size: 12 }), '用系统播放器打开原视频'),
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
          ]}),


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
                    await fetch(`/api/media-center/videos/${singleMoveVideoId}`, {
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
        showScanModal && renderAssetImportDialog({
          isMobile, overlayStyle: modalOverlayStyle, cardStyle: modalCardStyle, ariaLabel: '导入视频素材',
          children: h(React.Fragment, null,
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                Icon.upload({ size: 18, color: '#3b82f6' }),
                h('h3', { style: { margin: 0, fontSize: '15px', fontWeight: 600 } }, '导入视频素材')
              ),
              renderImportMethodTabs({active:importTab,onSelect:setImportTab,disabled:isImporting,secondaryStyle:buttonSecondaryStyle,primaryStyle:buttonPrimaryStyle})
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
                    ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
                        (browserData.folders || []).length > 0 && h('div', {
                          style:{padding:'6px 10px',backgroundColor:'var(--dsw-alias-bg-layer-2)',borderRadius:'4px',display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'11px'}
                        },
                          h('label',{style:{display:'inline-flex',alignItems:'center',gap:'6px',cursor:'pointer'}},
                            h('input',{type:'checkbox','aria-label':'选择当前目录所有子文件夹',disabled:isImporting||browserData.folders.length>50,checked:selectedBrowserFolders.size===browserData.folders.length,onChange:toggleSelectAllBrowserFolders,style:{cursor:'pointer'}}),
                            h('span',null,`选择子文件夹（${selectedBrowserFolders.size}/${browserData.folders.length}，最多50）`)
                          ),
                          selectedBrowserFolders.size>0&&h('span',{style:{color:'var(--dsw-alias-label-primary)',fontWeight:600}},`已选 ${selectedBrowserFolders.size} 个文件夹`)
                        ),
                        (browserData.folders || []).map(folder => {
                          const selected=selectedBrowserFolders.has(folder.path);
                          return h('div',{key:folder.path,style:{minHeight:'38px',padding:'0 4px',borderRadius:'4px',display:'flex',alignItems:'center',gap:'8px',backgroundColor:selected?'var(--dsw-alias-bg-layer-2)':'transparent',border:selected?'1px solid var(--dsw-alias-border-l2)':'1px solid transparent',fontSize:'13px'}},
                            h('input',{type:'checkbox','aria-label':`选择文件夹 ${folder.name}`,checked:selected,disabled:isImporting,onChange:()=>toggleBrowserFolder(folder.path),style:{cursor:'pointer',flexShrink:0}}),
                            h('button',{type:'button',disabled:isImporting,style:{...buttonSecondaryStyle,padding:'6px 10px',minHeight:'38px',fontSize:'13px',flex:1,textAlign:'left',display:'inline-flex',alignItems:'center',justifyContent:'space-between'},onClick:()=>loadBrowseDir(folder.path)},
                              h('span',{style:{display:'inline-flex',alignItems:'center',gap:'6px',minWidth:0}},Icon.folder({size:14,color:'var(--dsw-alias-label-secondary)'}),folder.name),
                              h('span',{style:{display:'inline-flex',alignItems:'center',gap:'3px',fontSize:'11px',color:'var(--dsw-alias-label-secondary)'}},'进入',Icon.chevronRight({size:11}))
                            )
                          );
                        }),
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
                selectedBrowserFolders.size > 0
                  ? h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-primary)', fontWeight: 600 } }, `已选 ${selectedBrowserFolders.size} 个子文件夹，将递归导入其中视频`)
                  : selectedBrowserFiles.size > 0
                    ? h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-primary)', fontWeight: 600 } }, `已选 ${selectedBrowserFiles.size} 个视频文件`)
                    : h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, '勾选视频文件或子文件夹，也可扫描当前文件夹及其子目录'),
                h('div', { style: { display: 'flex', gap: '8px' } },
                  h('button', {style:buttonSecondaryStyle,disabled:isImporting,onClick:()=>setShowScanModal(false)},'取消'),
                  selectedBrowserFolders.size > 0
                    ? h('button',{style:buttonPrimaryStyle,disabled:isImporting,onClick:handleScanSelectedFolders},isImporting?Icon.loader({size:13,color:'#fff'}):Icon.upload({size:13}),isImporting?'导入处理中...':`导入所选文件夹 (${selectedBrowserFolders.size}个)`)
                    : selectedBrowserFiles.size > 0
                      ? h('button',{style:buttonPrimaryStyle,disabled:isImporting,onClick:()=>handleImportSelectedFiles()},isImporting?Icon.loader({size:13,color:'#fff'}):Icon.upload({size:13}),isImporting?'导入处理中...':`导入所选视频 (${selectedBrowserFiles.size}个)`)
                      : h('button',{style:buttonPrimaryStyle,disabled:isImporting,onClick:()=>handleScanDirectory(browserData?browserData.current_path:null)},isImporting?Icon.loader({size:13,color:'#fff'}):Icon.upload({size:13}),isImporting?'扫描处理中...':'扫描导入当前文件夹')
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
        }),

        // 4. Settings Modal
        showSettingsModal && h('div', { style: modalOverlayStyle },
          h('div', { style: { ...modalCardStyle, width: isMobile ? '96vw' : '980px', maxWidth: '96vw', height: isMobile ? '90vh' : 'min(820px,88vh)', padding: 0, gap: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--dsw-alias-border-l1)', flexShrink: 0 } },
              h('div', null,
                h('h3', { style: { margin: 0, fontSize: '18px', fontWeight: 650, color: 'var(--dsw-alias-label-primary)' } }, '设置'),
                h('div', { style: { marginTop: '3px', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '媒体中心 · 分析、模型、提示词与缓存')
              ),
              h('button', { type: 'button', style: buttonSecondaryStyle, onClick: () => setShowSettingsModal(false) }, '关闭')
            ),
            h('div', { style: { display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, minHeight: 0 } },
              h('nav', { 'aria-label': '设置分类', style: { width: isMobile ? '100%' : '190px', flexShrink: 0, padding: '10px', backgroundColor: 'var(--dsw-alias-bg-layer-2)', borderRight: isMobile ? 'none' : '1px solid var(--dsw-alias-border-l1)', borderBottom: isMobile ? '1px solid var(--dsw-alias-border-l1)' : 'none', display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '4px', overflowX: isMobile ? 'auto' : 'visible' } },
                [['general', '通用设置', Icon.settings], ['ai', 'AI 与并发', Icon.sparkles], ['prompts', '分析提示词', Icon.edit], ['cache', '缓存管理', Icon.hardDrive]].map(([id, label, icon]) => h('button', {
                  key: id, type: 'button', onClick: () => setSettingsSection(id),
                  style: { display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left', width: isMobile ? 'auto' : '100%', backgroundColor: settingsSection === id ? 'var(--dsw-alias-bg-layer-1)' : 'transparent', color: settingsSection === id ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)', fontWeight: settingsSection === id ? 600 : 400, fontSize: '13px' }
                }, icon({ size: 15 }), label))
              ),
              h('div', { style: { flex: 1, minWidth: 0, overflowY: 'auto', padding: '18px 22px' } },
                settingsSection === 'general' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
                  h('div', null,
                    h('div', { style: { fontSize: '15px', fontWeight: 650, color: 'var(--dsw-alias-label-primary)' } }, '通用设置'),
                    h('div', { style: { marginTop: '4px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', lineHeight: '1.55' } }, '配置本机媒体引擎。源视频、音频只作为只读引用，不会被复制或修改。')
                  ),
                  h('div', { style: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' } },
                    h('div', null,
                      h('div', { style: { fontSize: '13px', fontWeight: 600 } }, '媒体引擎环境'),
                      h('div', { style: { marginTop: '3px', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '留空时自动从系统 PATH 检测 FFmpeg 与 FFprobe。修改后保存生效。')
                    ),
                    h('div', { style: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' } },
                      h('label', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, 'FFmpeg 绝对路径',
                        h('input', { type: 'text', 'aria-label': 'FFmpeg 路径', value: ffmpegInput, onChange: (e) => setFfmpegInput(e.target.value), placeholder: 'C:\\ffmpeg\\bin\\ffmpeg.exe', style: { ...inputStyle, width: '100%', marginTop: '4px' } })),
                      h('label', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, 'FFprobe 绝对路径',
                        h('input', { type: 'text', 'aria-label': 'FFprobe 路径', value: ffprobeInput, onChange: (e) => setFfprobeInput(e.target.value), placeholder: 'C:\\ffmpeg\\bin\\ffprobe.exe', style: { ...inputStyle, width: '100%', marginTop: '4px' } }))
                    )
                  ),
                  h('div', { style: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' } },
                    h('div', null, h('div', { style: { fontSize: '13px', fontWeight: 600 } }, '当前运行环境'), h('div', { style: { marginTop: '3px', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, status?.binaries?.ffmpeg ? 'FFmpeg 与 FFprobe 就绪' : '未检测到可用的 FFmpeg')),
                    h('button', { type: 'button', style: buttonSecondaryStyle, onClick: () => loadStatus() }, '重新检测')
                  )
                ),
                settingsSection === 'ai' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
                  h('div', null,
                    h('div', { style: { fontSize: '15px', fontWeight: 650 } }, 'AI 与并发'),
                    h('div', { style: { marginTop: '4px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', lineHeight: '1.55' } }, '视频分析与音乐频谱解读共用当前 DSH 图像模型配置；自定义模式使用单独填写的兼容端点。')
                  ),
                  h('div', { style: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' } },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
                      h('div', null, h('div', { style: { fontSize: '13px', fontWeight: 600 } }, '视觉模型'), h('div', { style: { marginTop: '3px', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '用于视频故事板分析与音乐频谱图解读。')),
                      aiMode === 'dsh' && h('button', { type: 'button', style: buttonSecondaryStyle, onClick: loadAiCatalog }, '刷新 DSH 模型列表')
                    ),
                    aiCatalogWarning && h('div', { role: 'alert', style: { color: 'var(--dsw-alias-label-primary)', fontSize: '11px' } }, aiCatalogWarning),
                    h('label', { style: { fontSize: '11px' } }, '模型来源',
                      h('select', { value: aiMode, onChange: e => { setAiMode(e.target.value); setAiProviderInput(''); setAiModelInput(''); setAiReasoningInput(''); }, style: { ...inputStyle, width: '100%', marginTop: '4px' } },
                        h('option', { value: 'dsh' }, 'DSH 已配置模型'), h('option', { value: 'custom' }, '自定义 OpenAI 兼容端点'))),
                    aiMode === 'dsh' ? h('div', { style: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' } },
                      h('label', { style: { fontSize: '11px' } }, 'DSH 服务商',
                        h('select', { value: aiProviderInput, onChange: e => { setAiProviderInput(e.target.value); setAiModelInput(''); setAiReasoningInput(''); }, style: { ...inputStyle, width: '100%', marginTop: '4px' } },
                          h('option', { value: '' }, '请选择服务商'), aiProviderInput && !aiProviders.some(p => p.id === aiProviderInput) && h('option', { value: aiProviderInput, disabled: true }, `${aiProviderInput}（当前不可用）`), aiProviders.map(p => h('option', { key: p.id, value: p.id }, p.name || p.id)))),
                      h('label', { style: { fontSize: '11px' } }, '模型',
                        h('select', { value: aiModelInput, onChange: e => { setAiModelInput(e.target.value); setAiReasoningInput(''); }, style: { ...inputStyle, width: '100%', marginTop: '4px' } },
                          h('option', { value: '' }, '请选择模型'), !(aiProviders.find(p => p.id === aiProviderInput)?.models || []).some(m => m.id === aiModelInput) && aiModelInput && h('option', { value: aiModelInput, disabled: true }, `${aiModelInput}（当前不可用）`),
                          (aiProviders.find(p => p.id === aiProviderInput)?.models || []).map(m => h('option', { key: m.id, value: m.id, disabled: Array.isArray(m.inputModalities) && !m.inputModalities.includes('image') }, `${m.name || m.id}${Array.isArray(m.inputModalities) ? (m.inputModalities.includes('image') ? '' : '（不支持图片）') : '（图片能力未声明）'}`)))),
                      h('label', { style: { fontSize: '11px' } }, '推理档位',
                        h('select', { value: aiReasoningInput, onChange: e => setAiReasoningInput(e.target.value), disabled: !aiModelInput || !(aiProviders.find(p => p.id === aiProviderInput)?.models || []).find(m => m.id === aiModelInput)?.reasoning?.efforts?.length, style: { ...inputStyle, width: '100%', marginTop: '4px' } },
                          h('option', { value: '' }, '请选择推理档位'), aiReasoningInput && !(aiProviders.find(p => p.id === aiProviderInput)?.models || []).find(m => m.id === aiModelInput)?.reasoning?.efforts?.some(e => e.id === aiReasoningInput) && h('option', { value: aiReasoningInput, disabled: true }, `${aiReasoningInput}（当前不可用）`),
                          ((aiProviders.find(p => p.id === aiProviderInput)?.models || []).find(m => m.id === aiModelInput)?.reasoning?.efforts || []).map(e => h('option', { key: e.id, value: e.id }, e.name || e.id)))),
                      h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginTop: '3px' } },
                        !aiModelInput ? '请先选择服务商和模型。' : (aiProviders.find(p => p.id === aiProviderInput)?.models || []).find(m => m.id === aiModelInput)?.reasoning_unavailable ? '无法读取模型能力，请刷新模型列表。' : (aiProviders.find(p => p.id === aiProviderInput)?.models || []).find(m => m.id === aiModelInput)?.reasoning?.efforts?.length ? '请求直接使用所选档位，不会自动换档重试。' : '该模型未声明可选择的推理档位。')
                    ) : h('div', { style: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' } },
                      h('label', { style: { fontSize: '11px' } }, '自定义模型名称', h('input', { type: 'text', value: aiModelInput, onChange: e => setAiModelInput(e.target.value), style: { ...inputStyle, width: '100%', marginTop: '4px' } })),
                      h('label', { style: { fontSize: '11px' } }, 'API 基础端点', h('input', { type: 'text', value: aiBaseUrlInput, onChange: e => setAiBaseUrlInput(e.target.value), placeholder: 'https://example.com/v1', style: { ...inputStyle, width: '100%', marginTop: '4px' } })),
                      h('label', { style: { fontSize: '11px' } }, 'API Key（留空保留已有值）', h('input', { type: 'password', value: aiApiKeyInput, onChange: e => setAiApiKeyInput(e.target.value), autoComplete: 'new-password', style: { ...inputStyle, width: '100%', marginTop: '4px' } }))
                    )
                  ),
                  h('div', { style: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' } },
                    h('div', { style: { maxWidth: '560px' } },
                      h('div', { style: { fontSize: '13px', fontWeight: 600 } }, '批量 AI 分析并发'),
                      h('div', { style: { marginTop: '3px', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', lineHeight: '1.55' } }, '同时请求远端图像模型的最大数量。模型并发能力强时可提高；过高会增加本机解码、内存与网络压力。')
                    ),
                    h('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' } }, '最大并发',
                      h('input', { type: 'number', 'aria-label': 'AI 分析最大并发', min: 1, max: 8, step: 1, value: aiConcurrency, onChange: e => setAiConcurrency(e.target.value), style: { ...inputStyle, width: '90px' } }),
                      h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, '1–8'))
                  )
                ),
                settingsSection === 'prompts' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
                  h('div', null, h('div', { style: { fontSize: '15px', fontWeight: 650 } }, '分析提示词'), h('div', { style: { marginTop: '4px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, '提示词影响模型对视频与镜头的理解；修改后点击“保存全部配置”生效。')),
                  h('div', { style: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' } },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, h('div', { style: { fontSize: '13px', fontWeight: 600 } }, 'AI 视频分析提示词'), h('button', { type: 'button', style: { ...buttonSecondaryStyle, padding: '3px 9px', fontSize: '11px' }, onClick: () => setAiPromptTemplate(defaultPromptText) }, '恢复默认')),
                    h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '支持变量：{{video_name}}, {{duration}}, {{resolution}}, {{fps}}, {{folder_name}}'),
                    h('textarea', { rows: 9, 'aria-label': 'AI 视频分析提示词', value: aiPromptTemplate, onChange: (e) => setAiPromptTemplate(e.target.value), style: { ...inputStyle, resize: 'vertical', lineHeight: '1.45', fontFamily: 'monospace', fontSize: '11px' } })
                  ),
                  h('div', { style: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' } },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, h('div', { style: { fontSize: '13px', fontWeight: 600 } }, '镜头深度分析提示词'), h('button', { type: 'button', style: { ...buttonSecondaryStyle, padding: '3px 9px', fontSize: '11px' }, disabled: !shotPromptLoaded, onClick: () => setShotPrompt(shotDefaultPrompt) }, '恢复默认')),
                    h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '仅影响单片段镜头精读。'),
                    shotPromptError && h('div', { role: 'alert', style: { fontSize: '11px', color: 'var(--dsw-alias-label-primary)' } }, shotPromptError, h('button', { type: 'button', style: buttonSecondaryStyle, onClick: loadShotAnalysisSettings }, '重试读取')),
                    h('textarea', { 'aria-label': '镜头深度分析提示词', rows: 9, value: shotPrompt, disabled: !shotPromptLoaded, onChange: e => setShotPrompt(e.target.value), style: { ...inputStyle, resize: 'vertical', lineHeight: '1.45', fontFamily: 'monospace', fontSize: '11px' } })
                  )
                ),
                settingsSection === 'cache' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
                  h('div', null, h('div', { style: { fontSize: '15px', fontWeight: 650 } }, '缓存管理'), h('div', { style: { marginTop: '4px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, '仅清理插件生成的衍生文件；源视频、音频和导出工程不受影响。')),
                  h('div', { style: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' } },
                    h('div', { style: { fontSize: '13px', fontWeight: 600 } }, '缓存占用'),
                    h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', lineHeight: '1.8' } },
                      cacheUsage ? `故事板 ${formatFileSize(cacheUsage.storyboards)} · 兼容预览 ${formatFileSize(cacheUsage.previews)} · 关键帧 ${formatFileSize(cacheUsage.keyframes)} · 音乐频谱 ${formatFileSize(cacheUsage.music_spectrograms)}` : '点击设置时统计缓存占用。',
                      cacheUsage && h('div', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, `合计 ${formatFileSize(cacheUsage.total)}`)),
                    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
                      h('button', { type: 'button', style: buttonSecondaryStyle, disabled: cacheBusy, onClick: () => clearPluginCache('previews') }, '仅清理兼容预览'),
                      h('button', { type: 'button', style: buttonSecondaryStyle, disabled: cacheBusy, onClick: () => clearPluginCache('all') }, '清理全部缓存'),
                      h('button', { type: 'button', style: buttonSecondaryStyle, disabled: cacheBusy, onClick: loadCacheUsage }, '刷新占用'))
                  ),
                  h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '清理故事板后，列表中的故事板会重置为未生成，可再次按需生成。')
                )
              )
            ),
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid var(--dsw-alias-border-l1)', flexShrink: 0 } },
              h('button', { type: 'button', style: buttonSecondaryStyle, onClick: () => setShowSettingsModal(false) }, '取消'),
              h('button', { type: 'button', style: buttonPrimaryStyle, onClick: handleSaveSettings }, Icon.check({ size: 13 }), '保存全部配置')
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
        ),
          )
      );
    }

    // --- Panel Icon for sidebar.panellist ---
    function PanelIcon(props) {
      const size = props?.size || 20;
      const active = !!props?.active;
      const color = active ? 'var(--dsw-static-deepseek-500, #3b82f6)' : 'currentColor';
      return Icon.hardDrive({ size, color });
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // Register sidebar panel icon
        ctx.slots.inject('sidebar.panellist', () => {
          return ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'media-center',
            order: 35,
            label: () => '媒体中心'
          }, PanelIcon);
        });

        // Register main view workstation
        ctx.slots.inject('main', () => {
          return ctx.slots.register({
            name: 'main',
            key: 'media-center'
          }, MediaCenterWorkbench);
        });
      }
    };
  }
});
