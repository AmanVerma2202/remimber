/** Minimal inline SVG icon set (24-stroke style, 1.9px line) used across the
 *  editor toolbar, property panel and floating format bar. All icons share a
 *  24×24 viewBox and inherit the current text colour via `currentColor`. */
const PATHS = {
  // ---------- navigation & history ----------
  back: [
    ['path', { d: 'M19 12H5' }],
    ['path', { d: 'M12 19l-7-7 7-7' }],
  ],
  undo: [
    ['path', { d: 'M3 7v6h6' }],
    ['path', { d: 'M21 17a9 9 0 0 0-15-6.7L3 13' }],
  ],
  redo: [
    ['path', { d: 'M21 7v6h-6' }],
    ['path', { d: 'M3 17a9 9 0 0 1 15-6.7L21 13' }],
  ],

  // ---------- insertable content ----------
  text: [
    ['polyline', { points: '4 7 4 4 20 4 20 7' }],
    ['line', { x1: '9', y1: '20', x2: '15', y2: '20' }],
    ['line', { x1: '12', y1: '4', x2: '12', y2: '20' }],
  ],
  code: [
    ['polyline', { points: '16 18 22 12 16 6' }],
    ['polyline', { points: '8 6 2 12 8 18' }],
  ],
  sticky: [
    ['path', { d: 'M14 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8l6-6V7a2 2 0 0 0-2-2Z' }],
    ['path', { d: 'M14 5v4a2 2 0 0 0 2 2h4' }],
  ],
  table: [
    ['path', { d: 'M4 4h16v16H4Z' }],
    ['line', { x1: '4', y1: '10', x2: '20', y2: '10' }],
    ['line', { x1: '9', y1: '4', x2: '9', y2: '20' }],
    ['line', { x1: '15', y1: '4', x2: '15', y2: '20' }],
  ],
  image: [
    ['rect', { x: '3', y: '4', width: '18', height: '16', rx: '2' }],
    ['circle', { cx: '8.5', cy: '9.5', r: '1.5' }],
    ['path', { d: 'm21 15-4.5-4.5L7.5 19' }],
  ],
  pen: [
    ['path', { d: 'M12 20h9' }],
    ['path', { d: 'M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19.2l-1 3.4L7.2 21.8l.2-1.2a2 2 0 0 1 .5-.5l8.5-8.5Z' }],
    ['path', { d: 'm13.8 6.2 2.4 2.4' }],
  ],

  // ---------- shapes ----------
  rect: [
    ['rect', { x: '4', y: '5', width: '16', height: '14', rx: '1.5' }],
  ],
  circle: [
    ['circle', { cx: '12', cy: '12', r: '8' }],
  ],
  triangle: [
    ['path', { d: 'M12 4 20 20H4Z' }],
  ],
  line: [
    ['line', { x1: '5', y1: '19', x2: '19', y2: '5' }],
  ],
  arrow: [
    ['path', { d: 'M5 19 19 5' }],
    ['path', { d: 'M19 5h-7' }],
    ['path', { d: 'M19 5v7' }],
  ],
  star: [
    ['path', { d: 'm12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7Z' }],
  ],
  heart: [
    ['path', { d: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z' }],
  ],

  // ---------- pages ----------
  plus: [
    ['path', { d: 'M12 5v14' }],
    ['path', { d: 'M5 12h14' }],
  ],
  minus: [
    ['path', { d: 'M5 12h14' }],
  ],

  // ---------- zoom ----------
  zoomIn: [
    ['circle', { cx: '11', cy: '11', r: '7' }],
    ['line', { x1: '21', y1: '21', x2: '16.65', y2: '16.65' }],
    ['line', { x1: '8', y1: '11', x2: '14', y2: '11' }],
    ['line', { x1: '11', y1: '8', x2: '11', y2: '14' }],
  ],
  zoomOut: [
    ['circle', { cx: '11', cy: '11', r: '7' }],
    ['line', { x1: '21', y1: '21', x2: '16.65', y2: '16.65' }],
    ['line', { x1: '8', y1: '11', x2: '14', y2: '11' }],
  ],
  fit: [
    ['path', { d: 'M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4' }],
  ],

  // ---------- selection actions ----------
  duplicate: [
    ['rect', { x: '9', y: '9', width: '12', height: '12', rx: '2' }],
    ['path', { d: 'M15 4V3a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1' }],
  ],
  forward: [
    ['path', { d: 'M12 20V4' }],
    ['path', { d: 'm6 9 6-5 6 5' }],
  ],
  backward: [
    ['path', { d: 'M12 4v16' }],
    ['path', { d: 'm6 15 6 5 6-5' }],
  ],
  trash: [
    ['path', { d: 'M3 6h18' }],
    ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }],
    ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }],
  ],

  // ---------- sharing / export ----------
  link: [
    ['path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }],
    ['path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }],
  ],
  download: [
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['path', { d: 'M7 10l5 5 5-5' }],
    ['path', { d: 'M12 15V3' }],
  ],

  // ---------- rich-text formatting ----------
  bold: [
    ['path', { d: 'M6 4h8a4 4 0 0 1 0 8H6Z' }],
    ['path', { d: 'M6 12h9a4 4 0 0 1 0 8H6Z' }],
  ],
  italic: [
    ['path', { d: 'M19 4h-9' }],
    ['path', { d: 'M14 20H5' }],
    ['path', { d: 'M15 4l-6 16' }],
  ],
  underline: [
    ['path', { d: 'M6 3v7a6 6 0 0 0 12 0V3' }],
    ['path', { d: 'M4 21h16' }],
  ],
  alignLeft: [
    ['path', { d: 'M4 6h16' }],
    ['path', { d: 'M4 12h10' }],
    ['path', { d: 'M4 18h13' }],
  ],
  alignCenter: [
    ['path', { d: 'M4 6h16' }],
    ['path', { d: 'M7 12h10' }],
    ['path', { d: 'M5 18h14' }],
  ],
  alignRight: [
    ['path', { d: 'M4 6h16' }],
    ['path', { d: 'M10 12h10' }],
    ['path', { d: 'M7 18h13' }],
  ],
  alignJustify: [
    ['path', { d: 'M4 6h16' }],
    ['path', { d: 'M4 12h16' }],
    ['path', { d: 'M4 18h16' }],
  ],
  highlighter: [
    ['rect', { x: '7', y: '2.5', width: '10', height: '15', rx: '1.5' }],
    ['path', { d: 'M5 21h14' }],
    ['path', { d: 'M11 17.5 8.5 21' }],
    ['path', { d: 'M13 17.5 15.5 21' }],
  ],
  highlighterOff: [
    ['rect', { x: '7', y: '2.5', width: '10', height: '15', rx: '1.5' }],
    ['path', { d: 'M5 21h14' }],
    ['path', { d: 'M11 17.5 8.21 21' }],
    ['path', { d: 'M13 17.5 15.5 21' }],
    ['path', { d: 'M2.5 2.5 21 21' }],
  ],
  eraser: [
    ['path', { d: 'M7 21H4a1 1 0 0 1-1-1v-2.2a1 1 0 0 1 .3-.7L13.3 7.1a1 1 0 0 1 1.4 0l4.2 4.2a1 1 0 0 1 0 1.4L12.8 19Z' }],
    ['path', { d: 'M10 10l4 4' }],
    ['path', { d: 'M4 21h16' }],
  ],
};

export default function Icon({ name, size = 16, className = '' }) {
  const parts = PATHS[name];
  if (!parts) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className + ' op-icon'}
      aria-hidden="true"
      style={{
        // crisp pseudo-3D: a 1px offset "extrusion" + soft ambient shadow lifts the glyph
        filter: 'drop-shadow(0 1.25px 0.6px rgb(0 0 0 / 0.18))',
      }}
    >
      {parts.map(([tag, attrs], i) => {
        const Tag = tag;
        return <Tag key={i} {...attrs} />;
      })}
    </svg>
  );
}