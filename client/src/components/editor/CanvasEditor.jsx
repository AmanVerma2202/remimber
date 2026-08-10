import { useEffect, useRef, useState, useCallback, useReducer } from 'react';
import * as fabric from 'fabric';
import Toolbar from './Toolbar';
import FormatBar from './FormatBar';
import Icon from './icons';
import { useNotes } from '../../store/noteStore';
import { useTheme } from '../../store/themeStore';
import { notes as notesApi, upload } from '../../api/client';
import { useToast } from '../common/Toast';
import useRealtime from './useRealtime';

const CANVAS_W = 1200;
const CANVAS_H = 800;
// notebook-style pages: canvas width grows with each added page
const PAGE_W = 1080;
const PAGE_H = 1320;
const PAGE_MARGIN = 92;

/** Build a "textbook page" background (paper, red margin, ruled lines, page numbers). */
function notebookSvg(pages, dark = false) {
  const W = PAGE_W,
    H = PAGE_H,
    gap = 88;
  // light "exam paper" vs dark "night mode" paper
  const paper = dark ? '#20242e' : '#fffdf6';
  const edge = dark ? '#31363f' : '#e7e1d3';
  const margin = dark ? '#5d3636' : '#f2c9c9';
  const rule = dark ? '#39404c' : '#dbe3ea';
  const ruleBottom = dark ? '#6d3f3f' : '#f2c9c9';
  const num = dark ? '#6e7681' : '#b9b09d';
  const blocks = [];
  for (let p = 0; p < pages; p++) {
    const y0 = p * H;
    let rules = '';
    for (let ly = 130; ly < H - 30; ly += gap) {
      rules += `<line x1="${PAGE_MARGIN}" y1="${y0 + ly}" x2="${W - 40}" y2="${y0 + ly}" stroke="${rule}" stroke-width="1" stroke-dasharray="4 5" opacity="0.65"/>`;
    }
    blocks.push(`
      <g>
        <rect x="4" y="${y0 + 4}" width="${W - 8}" height="${H - 8}" rx="3" fill="${paper}" stroke="${edge}" stroke-width="2"/>
        <line x1="${PAGE_MARGIN}" y1="${y0}" x2="${PAGE_MARGIN}" y2="${y0 + H}" stroke="${margin}" stroke-width="2"/>
        ${rules}
        <line x1="${PAGE_MARGIN}" y1="${y0 + H - 34}" x2="${W - 40}" y2="${y0 + H - 34}" stroke="${ruleBottom}" stroke-width="2"/>
        <text x="${W - 56}" y="${y0 + H - 12}" font-family="Georgia, serif" font-size="13" fill="${num}">${p + 1}</text>
      </g>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H * pages}">${blocks.join('')}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Paint the notebook background onto a fabric canvas (v6 uses backgroundImage). */
async function applyNotebook(canvas, svgUrl) {
  try {
    const img = await fabric.Image.fromURL(svgUrl);
    if (!canvas || canvas.disposed) return;
    img.set({ left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false, excludeFromExport: true });
    canvas.backgroundImage = img;
    canvas.requestRenderAll();
  } catch {
    // ignore if the canvas was disposed mid-load
  }
}

const FONTS = [
  'Inter', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Menlo', 'Verdana',
  'Trebuchet MS', 'Tahoma', 'Palatino', 'Garamond', 'Comic Sans MS', 'Brush Script MT', 'Arial Black',
];
const TEXT_COLORS = [
  '#111827', '#ffffff', '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#16a34a',
  '#059669', '#0d9488', '#0284c7', '#2563eb', '#4f46e5', '#7c3aed', '#c026d3',
  '#db2777', '#be123c',
];
// fill palette for shapes / sticky notes
const FILL_COLORS = [
  '#93c5fd', '#a5b4fc', '#c4b5fd', '#f0abfc', '#f9a8d4', '#fca5a5', '#fecaca',
  '#fdba74', '#fcd34d', '#fde047', '#bef264', '#86efac', '#6ee7b7', '#67e8f9',
  '#a5f3fc', '#e2e8f0',
];

// free-pen highlighter — translucent marker colors, strokes are ephemeral
// (drawn on the page, then fade away without ever being saved)
const PEN_COLORS = [
  { name: 'Yellow', value: 'rgba(250, 204, 21, 0.45)' },
  { name: 'Orange', value: 'rgba(251, 146, 60, 0.5)' },
  { name: 'Red', value: 'rgba(248, 113, 113, 0.5)' },
  { name: 'Pink', value: 'rgba(249, 168, 212, 0.55)' },
  { name: 'Purple', value: 'rgba(196, 181, 253, 0.5)' },
  { name: 'Blue', value: 'rgba(147, 197, 253, 0.5)' },
  { name: 'Cyan', value: 'rgba(103, 232, 249, 0.5)' },
  { name: 'Green', value: 'rgba(134, 239, 172, 0.5)' },
  { name: 'White', value: 'rgba(255, 255, 255, 0.75)' },
  { name: 'Ink', value: 'rgba(30, 30, 46, 0.85)' },
];
const PEN_WIDTH = 18; // default marker stroke width in canvas units
const PEN_WIDTH_MIN = 4; // size slider range
const PEN_WIDTH_MAX = 48;
const PEN_LIFE = 1000; // how long a stroke stays before it begins to vanish
const PEN_FADE = 600; // fade-out duration (ms)

// text alignment choices (icon, value, tooltip)
const ALIGNMENTS = [
  { value: 'left', icon: 'alignLeft', label: 'Align left' },
  { value: 'center', icon: 'alignCenter', label: 'Align center' },
  { value: 'right', icon: 'alignRight', label: 'Align right' },
  { value: 'justify', icon: 'alignJustify', label: 'Justify' },
];

// translucent "marker" palette for per-character / per-word / per-line text highlighting
const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: 'rgba(250, 204, 21, 0.45)' },
  { name: 'Orange', value: 'rgba(251, 146, 60, 0.5)' },
  { name: 'Red', value: 'rgba(248, 113, 113, 0.5)' },
  { name: 'Pink', value: 'rgba(249, 168, 212, 0.6)' },
  { name: 'Purple', value: 'rgba(196, 181, 253, 0.55)' },
  { name: 'Blue', value: 'rgba(147, 197, 253, 0.55)' },
  { name: 'Cyan', value: 'rgba(103, 232, 249, 0.55)' },
  { name: 'Lime', value: 'rgba(190, 242, 100, 0.6)' },
];

// syntax-text colors that are bright enough on the dark code-editor background
const CODE_COLORS = [
  '#e6edf3', '#ff7b72', '#ffa657', '#f2cc60', '#7ee787',
  '#79c0ff', '#d2a8ff', '#f778ba', '#67e8f9', '#7d8590',
];

/** Row of alignment buttons; the active one is highlighted. */
function AlignRow({ value = 'left', onPick }) {
  return (
    <div className="flex gap-1.5">
      {ALIGNMENTS.map((a) => (
        <button key={a.value} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(a.value)}
          className={`tool-btn border border-panel ${value === a.value ? 'bg-accent text-white' : ''}`}
          title={a.label}
        >
          <Icon name={a.icon} size={15} />
        </button>
      ))}
    </div>
  );
}

/* ---------------- fabric <-> elements[] mapping ---------------- */

/**
 * Make a text layer resizable by the cursor without it overflowing:
 * - corners rotate/zoom the whole box (font scales together, text stays inside)
 * - left/right edges change the wrap width (text re-flows to fit)
 * - top/bottom skew/stretch handles are hidden — they distort glyphs
 */
function resizableText(tb) {
  tb.set({
    lockSkewingX: true,
    lockSkewingY: true,
    lockScalingFlip: true,
    splitByGrapheme: false,
  });
  tb.setControlsVisibility({ mt: false, mb: false });
  return tb;
}

/** Build a Fabric object from one persisted element. */
async function buildObject(el) {
  // objectCaching:false → groups always repaint children, so a hidden/edited
  // label can never linger as a stale duplicated layer on the canvas
  const common = { left: el.x, top: el.y, angle: el.rotation || 0, el, objectCaching: false };

  switch (el.type) {
    case 'text':
      const tb = resizableText(
        new fabric.Textbox(el.content || 'Click to edit…', {
          ...common,
          width: el.width || 240,
          fontFamily: el.style?.fontFamily || 'Inter',
          fontSize: el.style?.fontSize || 18,
          textAlign: el.style?.textAlign || 'left',
          fill: el.style?.color || '#1f2937',
          fontWeight: el.style?.bold ? 'bold' : 'normal',
          fontStyle: el.style?.italic ? 'italic' : 'normal',
          underline: !!el.style?.underline,
        })
      );
      // restore per-character formatting (text highlight + per-char colours)
      if (el.style?.styles && Object.keys(el.style.styles).length) {
        tb.styles = el.style.styles;
        tb.dirty = true;
      }
      return tb;

    case 'shape': {
      const kind = el.content?.kind || 'rect';
      const w = el.width,
        h = el.height,
        color = el.style?.backgroundColor || '#93c5fd',
        stroke = el.style?.color || '#1f2937';

      if (kind === 'line') return new fabric.Line([0, 0, w, h], { ...common, strokeWidth: 3, stroke });
      if (kind === 'arrow') return new fabric.Path(arrowPath(w, h), { ...common, fill: stroke });

      // plain, lightweight shapes — text is added as its own movable element
      if (kind === 'circle') return new fabric.Circle({ left: 0, top: 0, radius: Math.min(w, h) / 2, fill: color, ...common });
      if (kind === 'triangle') return new fabric.Triangle({ left: 0, top: 0, width: w, height: h, fill: color, ...common });
      if (kind === 'star') return new fabric.Path(starPath(w, h), { left: 0, top: 0, fill: color, ...common });
      if (kind === 'heart') return new fabric.Path(heartPath(w, h), { left: 0, top: 0, fill: color, ...common });
      return new fabric.Rect({ left: 0, top: 0, width: w, height: h, fill: color, rx: el.style?.borderRadius || 0, ...common });
    }

    case 'image': {
      try {
        // crossOrigin:'anonymous' + a CORS header on /uploads keeps the canvas
        // untainted so thumbnails/exports still work with cross-origin images.
        let img;
        try {
          img = await fabric.Image.fromURL(el.content, { crossOrigin: 'anonymous' });
        } catch {
          // server doesn't send CORS headers yet: fall back to a plain load so
          // the image still renders (canvas will be tainted, but persist() is
          // safe — it never lets a thumbnail failure block the actual save).
          img = await fabric.Image.fromURL(el.content);
        }
        const s = Math.min(el.width / (img.width || 1), el.height / (img.height || 1));
        if (s && s < 1) img.scale(s);
        return Object.assign(img, common);
      } catch {
        toast.error('Image could not be loaded (it may have been deleted)');
        return null;
      }
    }

    case 'sticky': {
      const w = el.width,
        h = el.height,
        color = el.style?.backgroundColor || '#fde047';

      // classic sticky: solid pastel pad, soft rounded corners, subtle depth
      const paper = new fabric.Rect({ left: 0, top: 0, width: w, height: h, rx: 9, fill: color, stroke: darken(color), strokeWidth: 1.5 });
      paper.isBody = true; // fill color targets the paper, not the gloss
      // faint top gloss, like folded-over note paper
      const gloss = new fabric.Rect({ left: 6, top: 0, width: w - 12, height: 3, rx: 2, fill: 'rgba(255,255,255,0.5)' });
      gloss.isTape = true;
      const text = new fabric.Textbox(el.content || '', {
        left: 14, top: 16, width: w - 28, fontSize: el.style?.fontSize || 15,
        lineHeight: 1.35,
        textAlign: el.style?.textAlign || 'left',
        fontFamily: el.style?.fontFamily || 'Inter',
        fontWeight: el.style?.bold ? 'bold' : 'normal',
        fontStyle: el.style?.italic ? 'italic' : 'normal',
        underline: !!el.style?.underline,
        fill: el.style?.color || darken(color),
      });
      if (el.style?.styles && Object.keys(el.style.styles).length) {
        text.styles = el.style.styles;
        text.dirty = true;
      }

      const group = Object.assign(new fabric.Group([paper, gloss, text], { ...common }), { el });
      group.shadow = { color: 'rgba(0,0,0,0.18)', blur: 12, offsetX: 2, offsetY: 4 };
      // interactive: shadow deepens on hover so the note "lifts"
      group.on('mouseover', () => { group.shadow = { color: 'rgba(0,0,0,0.30)', blur: 16, offsetX: 4, offsetY: 6 }; });
      group.on('mouseout', () => { group.shadow = { color: 'rgba(0,0,0,0.18)', blur: 12, offsetX: 2, offsetY: 4 }; });
      return group;
    }

    case 'code': {
      // macOS-styled code window: dark editor theme + traffic-light dots
      const w = el.width,
        h = el.height;
      const kids = [];
      kids.push(new fabric.Rect({ left: 0, top: 0, width: w, height: h, rx: 10, fill: el.style?.backgroundColor || '#0d1117', stroke: '#30363d', strokeWidth: 1 }));
      // title bar + three mac-style dots (red / yellow / green)
      kids.push(new fabric.Rect({ left: 0, top: 0, width: w, height: 34, rx: 10, fill: 'rgba(255,255,255,0.05)' }));
      kids.push(new fabric.Rect({ left: 0, top: 33, width: w, height: 1, fill: 'rgba(255,255,255,0.08)' }));
      [['#ff5f56', 14], ['#ffbd2e', 30], ['#27c93f', 46]].forEach(([c, x]) => {
        kids.push(new fabric.Circle({ left: x, top: 17 - 5, radius: 5, fill: c }));
      });
      const code = new fabric.Textbox(el.content || 'console.log("Hello, world!");', {
        left: 22,
        top: 46,
        width: w - 44,
        fontSize: el.style?.fontSize || 13,
        fontFamily: el.style?.fontFamily || 'Menlo',
        fill: el.style?.color || '#e6edf3',
        lineHeight: 1.5,
      });
      if (el.style?.styles && Object.keys(el.style.styles).length) {
        code.styles = el.style.styles;
        code.dirty = true;
      }
      kids.push(code);
      return Object.assign(new fabric.Group(kids, { ...common }), { el });
    }

    case 'table': {
      const { rows = 2, cols = 2, data = [] } = el.content || {};
      const cw = el.width / cols,
        ch = el.height / rows;
      const kids = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          kids.push(new fabric.Rect({ left: c * cw, top: r * ch, width: cw, height: ch, fill: r === 0 ? '#e2e8f0' : '#ffffff', stroke: '#94a3b8' }));
          kids.push(new fabric.Textbox(String(data?.[r]?.[c] ?? ''), { left: c * cw + 4, top: r * ch + 3, width: cw - 8, fontSize: 12 }));
        }
      }
      return Object.assign(new fabric.Group(kids, { ...common }), { el });
    }

    default:
      return null;
  }
}

/** Serialize canvas objects back into the persistence elements[] array. */
function serializeElements(canvas) {
  return canvas
    .getObjects()
    .map((raw, i) => {
      if (raw.el?.__label || raw.el?.__pen) return null; // temp editors & transient ink, never persisted
      const meta = raw.el || {};
      const pos = {
        x: Math.round(raw.left),
        y: Math.round(raw.top),
        width: Math.round((raw.width || 0) * (raw.scaleX || 1)),
        height: Math.round((raw.height || 0) * (raw.scaleY || 1)),
        rotation: raw.angle || 0,
        zIndex: i,
      };
      const o = raw;

      if (o instanceof fabric.Textbox) {
        const charStyles = o.styles && Object.keys(o.styles).length ? o.styles : undefined;
        return {
          id: meta.id || crypto.randomUUID(),
          type: 'text',
          content: o.text,
          style: {
            fontFamily: o.fontFamily,
            fontSize: o.fontSize,
            color: o.fill,
            bold: o.fontWeight === 'bold',
            italic: o.fontStyle === 'italic',
            underline: !!o.underline,
            textAlign: o.textAlign,
            ...(charStyles ? { styles: charStyles } : null),
          },
          ...pos,
        };
      }

      if (o instanceof fabric.Image)
        return { id: meta.id || crypto.randomUUID(), type: 'image', content: meta.content || o.getSrc(), style: meta.style || {}, ...pos };

      if (o instanceof fabric.Group) {
        const kids = o.getObjects();

        // sticky -> one text child; table -> grid of text children
        if (meta.type === 'sticky') {
          const label = kids.find((k) => k instanceof fabric.Textbox);
          return {
            id: meta.id || crypto.randomUUID(),
            type: 'sticky',
            content: label?.text || '',
            style: {
              ...(meta.style || {}),
              color: label?.fill,
              fontSize: label?.fontSize,
              textAlign: label?.textAlign,
              ...(label?.styles && Object.keys(label.styles).length ? { styles: label.styles } : null),
            },
            ...pos,
          };
        }

        if (meta.type === 'table') {
          const { rows = 2, cols = 2 } = meta.content || {};
          const cells = kids.filter((k) => k instanceof fabric.Textbox);
          const data = [];
          for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) row.push(cells[r * cols + c]?.text || '');
            data.push(row);
          }
          return { id: meta.id || crypto.randomUUID(), type: 'table', content: { rows, cols, data }, style: meta.style || {}, ...pos };
        }

if (meta.type === 'code') {
          const label = kids.find((k) => k instanceof fabric.Textbox);
          return {
            id: meta.id || crypto.randomUUID(),
            type: 'code',
            content: label?.text || '',
            style: {
              ...(meta.style || {}),
              color: label?.fill,
              fontSize: label?.fontSize,
              fontFamily: label?.fontFamily,
              ...(label?.styles && Object.keys(label.styles).length ? { styles: label.styles } : null),
            },
            ...pos,
          };
        }
      }

      // plain (non-group) shapes from older notes
      if (meta.type === 'shape') {
        const kind =
          o instanceof fabric.Circle ? 'circle'
          : o instanceof fabric.Triangle ? 'triangle'
          : o instanceof fabric.Line ? 'line'
          : o instanceof fabric.Path ? (meta.content?.kind === 'arrow' ? 'arrow' : meta.content?.kind || 'rect')
          : meta.content?.kind || 'rect';
        return { id: meta.id || crypto.randomUUID(), type: 'shape', content: { kind }, style: meta.style || {}, ...pos };
      }

      return null;
    })
    .filter(Boolean);
}

function arrowPath(w, h) {
  const head = 14;
  const a = Math.atan2(h, w);
  const x3 = (w - head * Math.cos(a - 0.35)).toFixed(1);
  const y3 = (h - head * Math.sin(a - 0.35)).toFixed(1);
  const x4 = (w - head * Math.cos(a + 0.35)).toFixed(1);
  const y4 = (h - head * Math.sin(a + 0.35)).toFixed(1);
  return `M 0 0 L ${w} ${h} L ${x3} ${y3} Z M 0 0 L ${w} ${h} L ${x4} ${y4} Z`;
}

function starPath(w, h) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, r = R * 0.45;
  let d = `M ${cx} ${cy - R}`;
  for (let i = 1; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    d += ` L ${(cx + rad * Math.cos(ang)).toFixed(1)} ${(cy + rad * Math.sin(ang)).toFixed(1)}`;
  }
  return d + ' Z';
}

function heartPath(w, h) {
  const cx = w / 2, cy = h * 0.32, r = Math.min(w, h) * 0.26, y = h * 0.88;
  return `M ${cx} ${y}
    C ${cx - w * 0.52} ${cy + r * 0.7} ${cx - w * 0.48} ${cy - r * 0.9} ${cx - r * 0.55} ${cy - r * 0.45}
    C ${cx - r * 0.38} ${cy - r * 1.15} ${cx + r * 0.38} ${cy - r * 1.15} ${cx + r * 0.55} ${cy - r * 0.45}
    C ${cx + w * 0.48} ${cy - r * 0.9} ${cx + w * 0.52} ${cy + r * 0.7} ${cx} ${y} Z`;
}

function darken(hex) {
  if (!hex || hex.length < 7) return '#d0a800';
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) & 255);
  const g = Math.max(0, (n >> 8) & 255);
  const b = Math.max(0, n & 255);
  const factor = 0.75;
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

/** snapshot the text styling of a fabric Textbox into a style map */
function styleFromText(t) {
  return {
    bold: t.fontWeight === 'bold',
    italic: t.fontStyle === 'italic',
    underline: !!t.underline,
    fontSize: t.fontSize,
    fontFamily: t.fontFamily,
    color: t.fill,
  };
}

/** the editable text inside a clicked fabric object (textbox, or sticky/code label). */
function textTargetOf(o) {
  if (o instanceof fabric.Textbox) return o;
  if (o instanceof fabric.Group) return o.getObjects().find((k) => k instanceof fabric.Textbox) || null;
  return null;
}

/* ------------------------------ component ------------------------------ */

/** Side panel section with a small heading. */
function SideSection({ title, children }) {
  return (
    <div className="space-y-2.5">
      <h4 className="prop-label">{title}</h4>
      {children}
    </div>
  );
}

/** Row of circular color swatches with the active one highlighted. */
function Swatches({ colors, value, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(c)}
          className={`h-6 w-6 rounded-full border shadow-sm ${value === c ? 'ring-2 ring-accent ring-offset-1' : 'border-panel'}`}
          style={{ backgroundColor: c }} title={c} />
      ))}
    </div>
  );
}

/** Owner UI to hand out an invite link and pick a role (edit | view). */
function SharePanel({ noteId, share, inviteUrl, busyRef, onChange, toast }) {
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const enable = (role) => run(async () => {
    const res = await notesApi.share(noteId, { role, regenerate: true });
    onChange({ enabled: true, code: res.share.code, role: res.share.role });
    toast.success(share ? 'Invite link regenerated' : 'Sharing turned on');
  });

  const setRole = (role) => run(async () => {
    const res = await notesApi.share(noteId, { role });
    onChange({ enabled: true, code: res.share.code, role: res.share.role });
    toast.success(role === 'viewer' ? 'Invite is now view-only' : 'Invite is now editable');
  });

  const stopSharing = () => run(async () => {
    await notesApi.unshare(noteId);
    onChange(null);
    toast.success('Sharing turned off');
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <div className="border-b border-panel bg-panel/80 px-3 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3">
        {!share ? (
          <>
            <span className="prop-label">Share this note with others</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => enable('editor')} disabled={busy} className="btn-brand rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60">
                Create invite (editable)
              </button>
              <button onClick={() => enable('viewer')} disabled={busy} className="tool-btn border border-panel disabled:opacity-60">
                Create invite (view only)
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-panel bg-canvas px-2 py-1.5 text-xs" />
              <button onClick={copyLink} className="tool-btn shrink-0 border border-panel" title="Copy invite link">Copy</button>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted">Role</span>
              <select
                value={share.role}
                disabled={busy}
                onChange={(e) => setRole(e.target.value === 'viewer' ? 'viewer' : 'editor')}
                className="rounded-md border border-panel bg-canvas px-2 py-1.5"
              >
                <option value="editor">Can edit</option>
                <option value="viewer">View only</option>
              </select>
              <button onClick={() => enable('editor')} disabled={busy} className="tool-btn border border-panel disabled:opacity-60" title="New link — the old one stops working">Regenerate</button>
              <button onClick={stopSharing} disabled={busy} className="tool-btn border border-panel text-red-600 disabled:opacity-60" title="Make link stop working">Stop sharing</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Paint live cursors from collaborators over the notebook (isolated re-render). */
function CursorLayer({ cursorsRef, members }) {
  const [, tick] = useReducer((s) => s + 1, 0);
  useEffect(() => {
    const t = setInterval(tick, 40);
    return () => clearInterval(t);
  }, []);

  const pointers = [];
  const map = cursorsRef.current;
  if (map) {
    for (const id of Object.keys(map)) {
      const c = map[id];
      if (members.some((m) => m.id === id)) pointers.push({ id, ...c });
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {pointers.map((c) => (
        <div key={c.id} className="fixed flex items-start" style={{ left: c.x, top: c.y, transform: 'translate(-2px, -3px)' }}>
          <span className="block h-4 w-4 rounded-full border-2 border-white shadow" style={{ backgroundColor: c.color }} />
          <span className="ml-1 whitespace-nowrap rounded px-1 py-px text-[10px] font-semibold text-white shadow" style={{ backgroundColor: c.color }}>
            {c.name || '…'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CanvasEditor({ note, code, access = 'owner' }) {
  const canvasEl = useRef(null);
  const imgInput = useRef(null);
  const fab = useRef(null);
  const saveTimer = useRef(null);
  const persistRef = useRef(null);
  const { updateActive, saveActive } = useNotes();
  const { theme } = useTheme();
  const toast = useToast();

  const [title, setTitle] = useState(note.title);
  const [hasSel, setHasSel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [obj, setObj] = useState(null); // selected fabric Textbox (style bar)
  const [sel, setSel] = useState(null); // active fabric object (context bar)
  const [editTarget, setEditTarget] = useState(null); // textbox currently in edit mode
  const [richMode, setRichMode] = useState('sel'); // rich-text scope: selection/word/line/all
  const [count, setCount] = useState(0);
  const [pages, setPages] = useState(note.pages || 3); // textbook pages in the notebook
  const [resizePct, setResizePct] = useState(100); // scale slider value
  const [, forceRender] = useState(0); // re-render the side panel after style changes
  const [dirty, setDirty] = useState(false); // unsaved edits → shows "Saving…" indicator
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  /* ---------- free pen / ephemeral highlighter ---------- */
  const [penMode, setPenMode] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [penWidth, setPenWidth] = useState(PEN_WIDTH);
  const penModeRef = useRef(penMode);
  useEffect(() => { penModeRef.current = penMode; }, [penMode]);

  /* ---------- text highlighter tool (marker over text boxes) ---------- */
  const [highlightMode, setHighlightMode] = useState(false);
  const [hlColor, setHlColor] = useState(HIGHLIGHT_COLORS[0].value);
  const highlightModeRef = useRef(highlightMode);
  useEffect(() => { highlightModeRef.current = highlightMode; }, [highlightMode]);
  const hlColorRef = useRef(hlColor);
  useEffect(() => { hlColorRef.current = hlColor; }, [hlColor]);

  /* ---------- sharing + realtime collaboration ---------- */
  const readOnly = access === 'viewer';
  const isOwner = access === 'owner';

  // switch the canvas into / out of freehand mode. Only the NEXT stroke uses a
  // new color — strokes already on the page keep their own.
  useEffect(() => {
    const canvas = fab.current;
    if (!canvas || readOnly) return;
    if (penMode) {
      canvas.discardActiveObject();
      const active = canvas.getActiveObject();
      if (active?.isEditing) { active.exitEditing(); canvas.requestRenderAll(); }
      if (!(canvas.freeDrawingBrush instanceof fabric.PencilBrush)) {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.width = PEN_WIDTH;
      }
      canvas.freeDrawingBrush.color = penColor;
      canvas.freeDrawingBrush.width = penWidth;
      canvas.isDrawingMode = true;
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.defaultCursor = 'default';
    }
    canvas.requestRenderAll();
  }, [penMode, penColor, penWidth, readOnly]);

  // switch the canvas into / out of "text highlighter" mode
  useEffect(() => {
    const canvas = fab.current;
    if (!canvas || readOnly) return;
    if (highlightMode) {
      canvas.discardActiveObject();
      const active = canvas.getActiveObject();
      if (active?.isEditing) { active.exitEditing(); canvas.requestRenderAll(); }
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'copy';
    } else {
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
    }
    canvas.requestRenderAll();
  }, [highlightMode, readOnly]);

  const realtime = useRealtime(note?.id, isOwner ? null : code, access);
  const pendingRemoteRef = useRef(null); // incoming edits waiting until local typing stops
  const cursorsRef = useRef({});
  const lastCursorRef = useRef(0);
  const [share, setShare] = useState(() => (note?.share?.enabled && note.share.code ? note.share : null));
  const [shareOpen, setShareOpen] = useState(false);
  const shareBusy = useRef(false);
  const inviteUrl = share ? `${window.location.origin}/s/${share.code}` : '';

  // undo / redo / clipboard (element snapshots or cloned fabric objects)
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const clipboardRef = useRef([]);
  const lastSnapshotRef = useRef(null); // dedupe identical snapshots
  const objRef = useRef(null); // latest selected text, readable inside the keydown closure
  objRef.current = obj;
  const editLabelRef = useRef(null); // set by the canvas init → "Edit" button in the panel
  const penTimersRef = useRef([]); // pending fade-out timers for freehand strokes

  /** serialize the whole canvas as an element snapshot (JSON string) */
  const snap = () => JSON.stringify(serializeElements(fab.current));

  /** record the current state onto the undo stack (called BEFORE a change) */
  const recordHistory = () => {
    const s = snap();
    if (lastSnapshotRef.current === s) return;
    lastSnapshotRef.current = s;
    undoRef.current.push(s);
    if (undoRef.current.length > 50) undoRef.current.shift();
    redoRef.current = [];
    setDirty(true);
    setCanUndo(true);
    setCanRedo(false);
  };

  const addPage = () => setPages((p) => p + 1);
  const removePage = () => setPages((p) => Math.max(1, p - 1));

  const refreshPanel = () => forceRender((s) => s + 1);

  /** resize the selected object by a % (uses current scale as the base) */
  const scaleSel = (pct) => {
    const o = fab.current.getActiveObject();
    if (!o) return;
    recordHistory();
    const factor = pct / resizePct;
    o.set({ scaleX: (o.scaleX || 1) * factor, scaleY: (o.scaleY || 1) * factor });
    setResizePct(pct);
    fab.current.requestRenderAll();
    scheduleSave();
    refreshPanel();
  };

  const newElement = (partial) => ({
    id: crypto.randomUUID(),
    x: 60 + Math.random() * 260,
    y: 40 + Math.random() * 200,
    width: 200,
    height: 100,
    rotation: 0,
    zIndex: 0,
    style: {},
    ...partial,
  });

  /** cheap thumbnail: downscale the existing pixel buffer instead of re-rendering the full notebook */
  const thumbnail = () => {
    const canvas = fab.current;
    const src = canvas.getElement();
    const maxW = 360;
    const scale = Math.min(1, maxW / (src.width || 1));
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round((src.width || 1) * scale));
    off.height = Math.max(1, Math.round((src.height || 1) * scale));
    off.getContext('2d').drawImage(src, 0, 0, off.width, off.height);
    return off.toDataURL('image/jpeg', 0.6);
  };

  const persist = useCallback(async () => {
    const canvas = fab.current;
    if (!canvas || readOnly) return;
    const elements = serializeElements(canvas);
    // A canvas with a cross-origin image becomes "tainted" and toDataURL()
    // throws a SecurityError. Never let that block the actual save — the
    // thumbnail is only a dashboard preview.
    let snapThumb;
    try {
      snapThumb = thumbnail();
    } catch {
      snapThumb = undefined;
    }
    setSaving(true);
    if (code && access === 'editor') {
      // collaborator: persist through the invite link
      try {
        await notesApi.shareUpdate(code, { title, elements, thumbnail: snapThumb });
      } catch {
        /* dirty stays true so the next autosave retries */
      }
    } else {
      updateActive({ title, pages, elements, ...(snapThumb !== undefined && { thumbnail: snapThumb }) });
      await saveActive();
    }
    setSaving(false);
    setDirty(false);
    lastSnapshotRef.current = snap(); // history base == saved state
    realtime.sendEdit(elements); // live-collab push
  }, [title, pages, updateActive, saveActive, code, access, readOnly, realtime]);

  persistRef.current = persist;
  const scheduleSave = useCallback(() => {
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistRef.current(), 1200);
  }, []);

  /** enforce the "text overlays everything" rule: every text element renders above every non-text element */
  const keepTextOnTop = useCallback(() => {
    const c = fab.current;
    if (!c) return;
    const arr = c.getObjects();
    let firstText = -1;
    let lastNonText = -1;
    arr.forEach((o, i) => {
      if (o.el?.type === 'text' && !o.el?.__label) { if (firstText === -1) firstText = i; }
      else lastNonText = i;
    });
    if (firstText > -1 && lastNonText > firstText) {
      c._objects = [
        ...arr.filter((o) => o.el?.type !== 'text' || o.el?.__label),
        ...arr.filter((o) => o.el?.type === 'text' && !o.el?.__label),
      ];
      c.requestRenderAll();
    }
  }, []);

  /** wipe the canvas and re-add objects from a serialized element snapshot */
  const rebuild = useCallback(async (elements) => {
    const canvas = fab.current;
    const bg = canvas.backgroundImage;
    canvas.clear();
    canvas.backgroundImage = bg;
    let n = 0;
    // text is an overlay layer: build everything else first, text always last
    const list = [...(elements || [])].sort((a, b) => Number(a.type === 'text') - Number(b.type === 'text'));
    const objects = await Promise.all(list.map((el) => buildObject(el).catch(() => null)));
    for (const o of objects) {
      if (!o) continue;
      canvas.add(o);
      n++;
    }
    setCount(n);
    canvas.requestRenderAll();
  }, []);

  /** rebuild from a remote collaborator's snapshot (no history/local save). */
  const applyRemote = useCallback(
    (elements) => {
      const c = fab.current;
      if (!c) return;
      c.discardActiveObject();
      rebuild(elements);
      if (readOnly) setReadOnlyMode(c);
    },
    [rebuild, readOnly]
  );

  // keep the readonly state on newly added objects (viewers only)
  const setReadOnlyMode = useCallback((c) => {
    c.selection = false;
    c.forEachObject((o) => {
      o.selectable = false;
      o.evented = false;
    });
    c.requestRenderAll();
  }, []);

  // subscribe to live edits + cursors from other people in this room
  useEffect(() => {
    realtime.onEdit((m) => {
      const editing = fab.current?.getActiveObject()?.isEditing;
      if (editing) {
        pendingRemoteRef.current = m.elements; // apply as soon as typing stops
        return;
      }
      applyRemote(m.elements);
    });
    realtime.onCursor((m) => {
      if (m?.user) cursorsRef.current[m.user.id] = { x: m.x, y: m.y, name: m.user.name, color: m.color };
    });
  }, [realtime, applyRemote]);

  const undo = useCallback(async () => {
    const stack = undoRef.current;
    if (!stack.length) { toast.info('Nothing to undo'); return; }
    const prev = stack.pop();
    redoRef.current.push(snap()); // current state goes forward for redo
    lastSnapshotRef.current = prev;
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(true);
    await rebuild(JSON.parse(prev));
    persistRef.current();
  }, [rebuild, toast]);

  const redo = useCallback(async () => {
    const stack = redoRef.current;
    if (!stack.length) { toast.info('Nothing to redo'); return; }
    const next = stack.pop();
    undoRef.current.push(snap());
    lastSnapshotRef.current = next;
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
    await rebuild(JSON.parse(next));
    persistRef.current();
  }, [rebuild, toast]);

  /** apply zoom to the canvas and keep the status in sync */
  const applyZoom = (z) => {
    const canvas = fab.current;
    if (!canvas) return;
    const next = Math.min(4, Math.max(0.25, z));
    setZoom(next);
    canvas.setZoom(next);
    canvas.requestRenderAll();
  };

  const zoomIn = () => applyZoom(zoom * 1.2);
  const zoomOut = () => applyZoom(zoom / 1.2);
  const zoomFit = () => {
    const canvas = fab.current;
    if (!canvas) return;
    // the scroll container that holds the page, NOT the canvas itself
    const el = canvasEl.current?.closest('.overflow-auto');
    const fit = el ? Math.min((el.clientWidth - 48) / PAGE_W, (el.clientHeight - 48) / (PAGE_H * pages)) : 1;
    applyZoom(Math.min(2, Math.max(0.25, fit || 1)));
  };

  /* -------- clipboard (copy / cut / paste / duplicate) -------- */

  const copySelected = useCallback(() => {
    const c = fab.current;
    const act = c.getActiveObjects();
    if (!act.length) { toast.info('Select something to copy'); return; }
    clipboardRef.current = act.map((o) => ({ json: o.toObject(), meta: { ...o.el } }));
    toast.success(`${act.length} copied`);
  }, [toast]);

  const cutSelected = () => {
    const c = fab.current;
    const act = c.getActiveObjects();
    if (!act.length) return;
    copySelected();
    act.forEach((o) => c.remove(o));
    setCount(c.getObjects().length);
    recordHistory();
    scheduleSave();
  };

  const pasteClipboard = async () => {
    const c = fab.current;
    if (!clipboardRef.current.length) { toast.info('Nothing to paste'); return; }
    recordHistory();
    for (const item of clipboardRef.current) {
      try {
        const o = await fabric.util.enlivenObjects([item.json]);
        const copy = o[0];
        copy.set({ left: (copy.left || 0) + 24, top: (copy.top || 0) + 24, el: { ...item.meta, id: crypto.randomUUID() } });
        c.add(copy);
        c.setActiveObject(copy);
      } catch { /* skip */ }
    }
    c.requestRenderAll();
    keepTextOnTop();
    scheduleSave();
  };

  const saveNow = useCallback(() => {
    clearTimeout(saveTimer.current);
    persistRef.current().then(() => toast.success('Note saved')).catch(() => toast.error('Failed to save note'));
  }, []);

  /* ---------- initialize canvas + load note's elements ---------- */
  useEffect(() => {
    const canvas = new fabric.Canvas(canvasEl.current, { width: PAGE_W, height: PAGE_H * pages, preserveObjectStacking: true });
    fab.current = canvas;
applyNotebook(canvas, notebookSvg(pages, theme === 'dark'));

    (async () => {
      // parallel build (image loading runs concurrently) with text kept on top
      await rebuild(note.elements || []);
      if (readOnly) setReadOnlyMode(canvas);
    })();

    const syncSel = () => {
      const active = canvas.getActiveObject();
      setSel(active);
      setHasSel(!!active);
      setObj(active instanceof fabric.Textbox ? active : null);
      setResizePct(100); // reset the scale slider for a fresh selection
    };
    canvas.on('selection:created', () => {
      syncSel();
      // on small screens the property panel starts hidden — surface it on selection
      if (window.innerWidth < 1024) setPanelOpen(true);
    });
    canvas.on('selection:updated', syncSel);
    canvas.on('selection:cleared', () => { setSel(null); setObj(null); setHasSel(false); });
    canvas.on('object:modified', scheduleSave);
    // refresh the element count at most once a frame (rebuilds add many objects at once)
    let countRaf = 0;
    const bumpCount = () => {
      cancelAnimationFrame(countRaf);
      countRaf = requestAnimationFrame(() => setCount(canvas.getObjects().length));
    };
    canvas.on('object:added', bumpCount);
    canvas.on('object:removed', bumpCount);

    // record the pre-gesture state once per drag/resize so it can be undone
    let gesture = false;
    canvas.on('object:moving object:scaling object:rotating', () => {
      if (!gesture) { gesture = true; recordHistory(); }
    });
canvas.on('mouse:up', () => { gesture = false; });

    // freehand pen strokes: they're temporary annotations — drawn on the page,
    // fade out a few seconds later, and are NEVER saved or put into undo history
    canvas.on('path:created', (e) => {
      const p = e.path;
      if (!(p instanceof fabric.Path)) return;
      p.set({ strokeLineCap: 'round', strokeLineJoin: 'round' });
      p.set({ selectable: false, evented: false }); // transient ink, not an object
      p.el = { __pen: true };
      p.dirty = true;
      canvas.requestRenderAll();
      penTimersRef.current.push(
        setTimeout(() => {
          const start = performance.now();
          const step = (now) => {
            if (canvas.disposed) return;
            const t = Math.min(1, (now - start) / PEN_FADE);
            // easeOutCubic: start fast, relax as it fades away
            const eased = 1 - Math.pow(1 - t, 3);
            // set() (not direct assignment) so Fabric invalidates its cache and
            // actually repaints on every frame — otherwise the stroke pops away
            p.set('opacity', Math.max(0, 1 - eased));
            canvas.requestRenderAll();
            if (t < 1) requestAnimationFrame(step);
            else canvas.remove(p);
          };
          requestAnimationFrame(step);
        }, PEN_LIFE)
      );
    });

    // share our pointer position for live cursor overlays (throttled)
    canvas.on('mouse:move', (opt) => {
      const now = Date.now();
      if (now - lastCursorRef.current < 60) return;
      lastCursorRef.current = now;
      const rect = canvasEl.current?.parentElement?.getBoundingClientRect();
      if (!rect || !opt.pointer) return;
      const z = canvas.getZoom() || 1;
      realtime.sendCursor(rect.left + opt.pointer.x * z, rect.top + opt.pointer.y * z);
    });

    // text highlighter tool: click a text box (or sticky/code label) to paint it
    canvas.on('mouse:down', (opt) => {
      if (!highlightModeRef.current) return;
      const t = textTargetOf(opt.target);
      if (!t) return;
      opt.e?.preventDefault?.();
      paintHighlight(t, hlColorRef.current);
    });

    // double-click a shape / sticky → edit its label IN PLACE (no popup).
    // Editing fabric text *inside* a group is unreliable, so we lift the label
    // into a temporary top-level Textbox (same editing path as the text tool),
    // type there, then fold the result back into the group.
    const foldLabel = (editor) => {
      const meta = editor.el?.__label;
      if (!meta || !meta.group) { canvas.remove(editor); return; }
      recordHistory();
const { group, gs = 1 } = meta;
      const real = group.getObjects().find((k) => k instanceof fabric.Textbox);
      // the temporary editor rendered the label at gs × its own size so it
      // would match the group's pixels — fold back the BASE size, because the
      // group (and its scale) is what actually applies the ×gs on screen.
      // Folding the already-scaled figure back grows the text on every edit.
      const baseFontSize = (editor.fontSize || 0) / gs;
      const charStyles = editor.styles && Object.keys(editor.styles).length ? editor.styles : undefined;
      if (real) {
        // fold back BOTH the text and whatever styling was applied while typing
      // reuse the per-char styles when folding the label back so highlights survive
      real.set({
        text: editor.text,
        fontFamily: editor.fontFamily,
        fontSize: baseFontSize,
        fontWeight: editor.fontWeight,
        fontStyle: editor.fontStyle,
        underline: editor.underline,
        fill: editor.fill,
        lineHeight: editor.lineHeight,
        textAlign: editor.textAlign,
      });
      if (charStyles) real.styles = charStyles;
        real.dirty = true;
        real.visible = true; // bring the real text back now that editing finished
      }
      const prev = group.el || {};
      const folded = {
        ...(prev || {}),
        style: {
          ...(prev.style || {}),
          bold: editor.fontWeight === 'bold',
          italic: editor.fontStyle === 'italic',
          underline: !!editor.underline,
          fontSize: baseFontSize,
          fontFamily: editor.fontFamily,
          color: editor.fill,
          textAlign: editor.textAlign,
          ...(charStyles ? { styles: charStyles } : null),
        },
      };
      // sticky/code keep plain text
      folded.content = editor.text;
      group.el = folded;
      canvas.remove(editor);
      canvas.setActiveObject(group);
      group.dirty = true;
      canvas.requestRenderAll();
      // save immediately so the text + its colors/styles never revert
      persistRef.current();
    };
    const openLabelEditor = (t) => {
      const text = t.getObjects().find((k) => k instanceof fabric.Textbox);
      if (!text) return;
      // never let temporary label editors stack: fold/destroy any that are
      // already live so repeated double-clicks can't pile up extra text boxes
      canvas
        .getObjects()
        .filter((o) => o.el?.__label)
        .forEach((o) => {
          const real = o.el?.__label?.group?.getObjects?.().find((k) => k instanceof fabric.Textbox);
          if (real) { real.visible = true; real.dirty = true; }
          o.el = null;
          canvas.remove(o);
        });
      const gs = Math.abs(t.scaleX) || 1;
      // scene (canvas) coordinates of the label's top-left corner. The label
      // lives inside the group's own coordinate plane, so getXY pushes it
      // through the group's full transform — this keeps the editor exactly
      // where the text sits even when the sticky/code is resized or rotated
      // instead of nudging it to a rotated axis-aligned box.
      const sceneTL = text.getXY();
      // hide the original label while editing so there's never a double layer
      text.visible = false;
      text.dirty = true;
      t.dirty = true; // force the group to repaint without the label
      // temporary editor object covering the label area of the group. The child
      // already carries the group's scale/rotation, so we mirror it onto the
      // editor (gs multiply the glyph size) without also scaling its box.
      const editor = new fabric.Textbox(text.text || '', {
        left: sceneTL.x,
        top: sceneTL.y,
        angle: (t.angle || 0) + (text.angle || 0),
        width: (text.width || 200) * gs,
        fontSize: (text.fontSize || 16) * gs,
        lineHeight: text.lineHeight || 1.2,
        fontFamily: text.fontFamily || 'Inter',
        fontWeight: text.fontWeight || 'normal',
        fontStyle: text.fontStyle || 'normal',
        underline: !!text.underline,
        fill: text.fill || (t.el?.type === 'sticky' ? '#422006' : '#1f2937'),
        textAlign: text.textAlign || (t.el?.type === 'sticky' ? 'left' : 'center'),
        el: { __label: { group: t, gs } },
      });
      // carry the label's per-char highlights into the editor so they survive
      if (text.styles && Object.keys(text.styles).length) editor.styles = text.styles;
      text.dirty = true;
      canvas.add(resizableText(editor));
      canvas.setActiveObject(editor);
      editor.enterEditing();
      editor.selectAll();
      canvas.requestRenderAll();
    };
    canvas.on('mouse:dblclick', (opt) => {
      const t = opt.target;
      // double/triple click INSIDE an editing text box → select word / line
      if (t instanceof fabric.Textbox && t.isEditing) {
        const idx = t.getSelectionStartFromPointer(opt.e);
        if (typeof idx === 'number') {
          if (opt.e?.detail >= 3) t.selectLine(idx);
          else t.selectWord(idx);
          t.initDimensions?.();
          canvas.requestRenderAll();
          return;
        }
      }
      if (!t || !['sticky', 'code'].includes(t.el?.type)) return;
      openLabelEditor(t);
    });
    // also exposed to the side panel's "Edit" button
    editLabelRef.current = openLabelEditor;
    // keep the format bar informed about which text box is being edited
    canvas.on('text:editing:entered', (e) => setEditTarget(e.target));
    // safety: on ANY exit, make sure the group label isn't left hidden
    canvas.on('text:editing:exited', (e) => {
      setEditTarget(null);
      const editor = e.target;
      if (editor?.el?.__label?.group) {
        const real = editor.el.__label.group.getObjects().find((k) => k instanceof fabric.Textbox);
        if (real) real.visible = true;
      }
      if (editor?.el?.__label) foldLabel(editor);
      else scheduleSave();
      // if a collaborator pushed edits while we were typing, show them now
      if (pendingRemoteRef.current) {
        applyRemote(pendingRemoteRef.current);
        pendingRemoteRef.current = null;
      }
    });

    // keyboard shortcuts: undo/redo, copy/paste, formatting, delete, nudge
    const onKey = (e) => {
      if (readOnly) return; // viewers can look, zoom, and hover — not type
      // stop drawing with the escape key
      if (e.key === 'Escape') { if (penModeRef.current) setPenMode(false); if (highlightModeRef.current) setHighlightMode(false); return; }
      const t = e.target;
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      const active = canvas.getActiveObject();
      const k = e.key.toLowerCase();

      // bold / italic / underline — when editing with a selection, format only
      // the selected characters; otherwise style the whole object
      if (mod && k === 'b') {
        e.preventDefault();
        const editing = active?.isEditing ? active : null;
        const b = editing || objRef.current;
        if (b) {
          if (editing && editing.selectionStart !== editing.selectionEnd) {
            applyRichStyle({ fontWeight: b.fontWeight === 'bold' ? 'normal' : 'bold' }, 'sel');
          } else {
            b.set({ fontWeight: b.fontWeight === 'bold' ? 'normal' : 'bold' });
            canvas.requestRenderAll(); scheduleSave(); refreshPanel();
          }
        }
        return;
      }
      if (mod && k === 'i') {
        e.preventDefault();
        const editing = active?.isEditing ? active : null;
        const b = editing || objRef.current;
        if (b) {
          if (editing && editing.selectionStart !== editing.selectionEnd) {
            applyRichStyle({ fontStyle: b.fontStyle === 'italic' ? 'normal' : 'italic' }, 'sel');
          } else {
            b.set({ fontStyle: b.fontStyle === 'italic' ? 'normal' : 'italic' });
            canvas.requestRenderAll(); scheduleSave(); refreshPanel();
          }
        }
        return;
      }
      if (mod && k === 'u') {
        e.preventDefault();
        const editing = active?.isEditing ? active : null;
        const b = editing || objRef.current;
        if (b) {
          if (editing && editing.selectionStart !== editing.selectionEnd) {
            applyRichStyle({ underline: !b.underline }, 'sel');
          } else {
            b.set({ underline: !b.underline });
            canvas.requestRenderAll(); scheduleSave(); refreshPanel();
          }
        }
        return;
      }

      // undo / redo — let native undo work while typing in a text field
      if (mod && !inField && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && !inField && k === 'y') { e.preventDefault(); redo(); return; }

      // save
      if (mod && k === 's') { e.preventDefault(); saveNow(); return; }

      // clipboard (skip inside real text fields so copy/paste there works natively)
      if (mod && !inField && k === 'c') { e.preventDefault(); copySelected(); return; }
      if (mod && !inField && k === 'x') { e.preventDefault(); cutSelected(); return; }
      if (mod && !inField && k === 'v') { e.preventDefault(); pasteClipboard(); return; }
      if (mod && !inField && k === 'd') { e.preventDefault(); duplicate(); return; }

      // select everything on the canvas
      if (mod && !inField && k === 'a') {
        e.preventDefault();
        const all = canvas.getObjects().filter((o) => o.selectable && !o.el?.__label);
        canvas.discardActiveObject();
        if (all.length > 1) canvas.setActiveObject(new fabric.ActiveSelection(all, { canvas }));
        canvas.requestRenderAll();
        return;
      }

      // delete a selected object, never while typing text
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inField && active && !active.isEditing) {
        e.preventDefault();
        recordHistory();
        canvas.remove(active);
        setCount(canvas.getObjects().length);
        scheduleSave();
        return;
      }

      // arrow keys nudge the selection (shift = 10px)
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (dir && !inField && active && !active.isEditing) {
        e.preventDefault();
        recordHistory();
        const step = e.shiftKey ? 10 : 1;
        active.set({ left: (active.left || 0) + dir[0] * step, top: (active.top || 0) + dir[1] * step });
        active.setCoords();
        canvas.requestRenderAll();
        scheduleSave();
        refreshPanel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      penTimersRef.current.forEach(clearTimeout);
      penTimersRef.current = [];
      canvas.dispose();
    };
  }, []);

  // resize the notebook + repaint pages whenever page count OR theme changes
  useEffect(() => {
    const canvas = fab.current;
    if (!canvas) return;
    canvas.setDimensions({ width: PAGE_W, height: PAGE_H * pages });
    applyNotebook(canvas, notebookSvg(pages, theme === 'dark'));
    canvas.requestRenderAll();
  }, [pages, theme]);

  /* ---------- adding elements ---------- */

  const addElement = async (el) => {
    const canvas = fab.current;
    setPenMode(false);
    setHighlightMode(false);
    recordHistory();
    const o = await buildObject(el);
    canvas.add(o);
    canvas.setActiveObject(o);
    keepTextOnTop();
    canvas.requestRenderAll();
    // a fresh Textbox jumps straight into edit mode so typing just works
    if (el.type === 'text') {
      o.enterEditing();
      o.selectAll();
      canvas.requestRenderAll();
    }
    scheduleSave();
  };

  const addText = () =>
    addElement(newElement({ type: 'text', content: 'Your text', style: { fontSize: 20, color: getComputedStyle(document.body).color, fontFamily: 'Inter' } }));

  const addSticky = () =>
    addElement(newElement({ type: 'sticky', width: 220, height: 160, content: 'Double-click to write…', style: { backgroundColor: '#fde047', fontSize: 16 } }));

  const addCode = () =>
    addElement(newElement({ type: 'code', width: 440, height: 240, content: 'console.log("Hello, world!");\nconst answer = 42;\nconsole.log(answer);', style: { fontSize: 13, color: '#e6edf3', fontFamily: 'Menlo' } }));

  const addShape = (kind) => {
    addElement(
      newElement({
        type: 'shape',
        width: 140,
        height: 100,
        content: { kind },
        style: { backgroundColor: '#93c5fd' },
      })
    );
  };

  const addTable = () => {
    const rows = 3,
      cols = 3; // started as a popup; default 3×3, cells are editable on canvas
    const data = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
    addElement(newElement({ type: 'table', width: 320, height: 150, content: { rows, cols, data } }));
  };

  const openImagePicker = () => imgInput.current?.click();
  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { url } = await upload.image(file);
      addElement(newElement({ type: 'image', width: 300, height: 220, content: url }));
      toast.success('Image added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Image upload failed.');
    }
  };

  /* ---------------- context-bar actions (selection) ---------------- */

  const deleteSelected = () => {
    const canvas = fab.current;
    const active = canvas.getActiveObject();
    if (active) {
      recordHistory();
      canvas.remove(active);
      setCount(canvas.getObjects().length);
      scheduleSave();
    }
  };

  const duplicate = async () => {
    const active = fab.current.getActiveObject();
    if (!active) return;
    recordHistory();
    const copy = await active.clone();
    copy.set({ left: active.left + 40, top: active.top + 40, el: { ...active.el, id: crypto.randomUUID() } });
    fab.current.add(copy);
    fab.current.setActiveObject(copy);
    keepTextOnTop();
    fab.current.requestRenderAll();
    scheduleSave();
  };

  const bringForward = () => { const c = fab.current; const o = c.getActiveObject(); if (o) { recordHistory(); c.bringObjectForward(o); keepTextOnTop(); c.requestRenderAll(); scheduleSave(); } };
  const sendBackwards = () => { const c = fab.current; const o = c.getActiveObject(); if (o) { recordHistory(); c.sendObjectBackwards(o); keepTextOnTop(); c.requestRenderAll(); scheduleSave(); } };

  /** repaint the selected shape / sticky group body */
  const paintSelection = (color) => {
    const o = fab.current.getActiveObject();
    if (!o) return;
    recordHistory();
    o.el = { ...(o.el || {}), style: { ...(o.el.style || {}), backgroundColor: color } };
    if (o instanceof fabric.Group) {
      // the "body" is the flagged paper, else first non-text child (shape)
      const body = o.getObjects().find((k) => !(k instanceof fabric.Text) && !k.isTape);
      if (body) body.set('fill', color);
      if (o.el.type === 'sticky' && body) body.set('stroke', darken(color));
    } else {
      // plain shapes: repaint the fill directly
      o.set('fill', color);
    }
    o.dirty = true;
    fab.current.requestRenderAll();
    scheduleSave();
    refreshPanel();
  };

  const styleText = (patch) => {
    if (!obj) return;
    recordHistory();
    obj.set(patch);
    // when styling happens while the temporary label editor is active,
    // mirror it onto the real group label so it survives folding
    const group = obj.el?.__label?.group;
    if (group) {
      const real = group.getObjects().find((k) => k instanceof fabric.Textbox);
      if (real) real.set(patch);
      group.el = {
        ...(group.el || {}),
        style: {
          ...(group.el?.style || {}),
          bold: obj.fontWeight === 'bold',
          italic: obj.fontStyle === 'italic',
          underline: !!obj.underline,
          fontSize: obj.fontSize,
          fontFamily: obj.fontFamily,
          color: obj.fill,
          textAlign: obj.textAlign,
        },
      };
      if (real) real.dirty = true;
    }
    fab.current.requestRenderAll();
    scheduleSave();
    refreshPanel();
  };

  const toggleStyle = (key, value) => styleText({ [key]: obj?.[key] === value ? '' : value });

  /* ---------------- per-character / per-word / per-line rich styling ---------------- */

  /**
   * Resolve the character range [start, end) a rich-text edit should affect.
   *  - sel:  the exact dragged selection (falls back to the caret word)
   *  - word: the word(s) at/under the caret (whole-word)
   *  - line: the rendered line(s) at the caret
   *  - all:  the whole text box
   */
  const richRange = (t, mode) => {
    const len = (t.text || '').length;
    let s = Math.min(t.selectionStart ?? 0, t.selectionEnd ?? 0);
    let e = Math.max(t.selectionStart ?? 0, t.selectionEnd ?? 0);
    s = Math.min(s, len);
    e = Math.min(e, len);

    if (mode === 'all') return [0, len];
    if (mode === 'sel') {
      if (e > s) return [s, e];
      mode = 'word'; // nothing dragged → the word under the caret
    }
    if (mode === 'word') {
      const a = t.searchWordBoundary(s, -1);
      const b = Math.max(e, t.searchWordBoundary(s, 1));
      return [Math.min(a, b), Math.max(a, b)];
    }
    if (mode === 'line') {
      const a = t.findLineBoundaryLeft(s);
      const b = Math.max(e, t.findLineBoundaryRight(e));
      return [a, Math.max(a, b)];
    }
    return [0, len];
  };

  /** apply a per-character style patch (fill/backgroundColor/weight…) to a rich range */
  const applyRichStyle = (patch, mode) => {
    const t = objRef.current;
    if (!t || !(t instanceof fabric.Textbox)) return;
    recordHistory();
    const [s, e] = richRange(t, mode);
    if (e <= s) return;
    t.setSelectionStyles(patch, s, e);
    t.dirty = true;
    t.initDimensions?.();
    fab.current.requestRenderAll();
    scheduleSave();
    refreshPanel();
  };

  /** strip all per-character formatting from the resolved range */
  const clearRichRange = (mode) => {
    const t = objRef.current;
    if (!t || !(t instanceof fabric.Textbox)) return;
    recordHistory();
    const [s, e] = richRange(t, mode);
    if (e <= s) return;
    // walk the chars and drop per-char fill / background / weight / etc.
    for (let i = s; i < e; i++) {
      const { lineIndex, charIndex } = t.get2DCursorLocation(i);
      const line = t.styles?.[lineIndex];
      if (line?.[charIndex]) {
        const st = line[charIndex];
        ['fill', 'textBackgroundColor', 'fontWeight', 'fontStyle', 'underline', 'fontSize', 'fontFamily'].forEach((k) => {
          delete st[k];
        });
        if (Object.keys(st).length === 0) delete line[charIndex];
        if (Object.keys(line).length === 0) delete t.styles[lineIndex];
      }
    }
    t.dirty = true;
    t.initDimensions?.();
    fab.current.requestRenderAll();
    scheduleSave();
    refreshPanel();
  };

  /* ---------------- text highlighter tool ---------------- */

  /** find the editable text inside a clicked object (top-level textbox or a label in a sticky/code group) */
  const paintHighlight = (t, color) => {
    const len = (t.text || '').length;
    if (len === 0) return;
    recordHistory();
    // click again with the same marker → remove; otherwise paint the whole box.
    // fabric stores per-character backgrounds as `textBackgroundColor`
    const allSame = t
      .getSelectionStyles(0, len, true)
      .every((s) => s && s.textBackgroundColor && s.textBackgroundColor.replace(/\s/g, '') === color.replace(/\s/g, ''));
    t.setSelectionStyles(allSame ? { textBackgroundColor: '' } : { textBackgroundColor: color }, 0, len);
    t.dirty = true;
    t.initDimensions?.();
    fab.current.requestRenderAll();
    scheduleSave();
    refreshPanel();
  };

  /* ---------------- label styling for shapes / sticky notes ---------------- */

  /** the inner Textbox of the currently selected group (shape/sticky) */
  const labelText = () => (sel instanceof fabric.Group ? sel.getObjects().find((k) => k instanceof fabric.Textbox) : null);

  /** style + persist the label of a selected group */
  const styleLabel = (patch) => {
    const t = labelText();
    if (!t || !sel) return;
    recordHistory();
    t.set(patch);
    const style = {
      ...(sel.el?.style || {}),
      bold: t.fontWeight === 'bold',
      italic: t.fontStyle === 'italic',
      underline: !!t.underline,
      fontSize: t.fontSize,
      fontFamily: t.fontFamily,
      color: t.fill,
      textAlign: t.textAlign,
    };
    sel.el = { ...(sel.el || {}), style };
    t.dirty = true;
    fab.current.requestRenderAll();
    scheduleSave();
    refreshPanel();
  };

  const toggleLabelStyle = (key, value) => {
    const t = labelText();
    if (!t) return;
    const active = value === 'bold' ? t.fontWeight === 'bold' : value === 'italic' ? t.fontStyle === 'italic' : t.underline;
    styleLabel({ [key]: active ? (value === 'underline' ? false : 'normal') : value === 'underline' ? true : value });
  };

  /* ---------------- highlight / pen tool toggles ---------------- */
  const togglePen = () => {
    if (readOnly) return;
    setHighlightMode(false);
    setPenMode((v) => !v);
  };
  const toggleHighlight = () => {
    if (readOnly) return;
    setPenMode(false);
    setHighlightMode((v) => !v);
  };

  const exportPdf = async () => {
    const canvas = fab.current;
    if (!canvas) return;
    try {
      const { jsPDF } = await import('jspdf'); // lazy: this lib is only needed for export
      const data = canvas.toDataURL({ format: 'png', multiplier: 2 });
      const orientation = canvas.getWidth() > canvas.getHeight() ? 'l' : 'p';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.getWidth(), canvas.getHeight()] });
      pdf.addImage(data, 'PNG', 0, 0, canvas.getWidth(), canvas.getHeight());
      pdf.save(`${title || 'note'}.pdf`);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Could not export PDF');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        hasSelection={hasSel}
        pages={pages}
        onAddPage={addPage}
        onRemovePage={removePage}
        onCreateText={addText}
        onCreateCode={addCode}
        onCreateSticky={addSticky}
        onCreateTable={addTable}
        onCreateShape={addShape}
        onAddImage={openImagePicker}
        onDelete={deleteSelected}
        onDuplicate={duplicate}
        onForward={bringForward}
        onBackward={sendBackwards}
        onBack={() => (window.location.href = '/')}
        onExport={exportPdf}
        onSaveNow={saveNow}
        saving={saving}
        dirty={dirty}
        zoom={zoom}
        onUndo={undo}
        onRedo={redo}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomFit={zoomFit}
        canUndo={canUndo}
        canRedo={canRedo}
        readOnly={readOnly}
        members={realtime.members}
        isOwner={isOwner}
        shareOpen={shareOpen}
        onShare={() => setShareOpen((v) => !v)}
        penMode={penMode}
        onTogglePen={togglePen}
        highlightMode={highlightMode}
        onToggleHighlight={toggleHighlight}
      />

      {/* free-pen color strip — only visible while drawing */}
      {penMode && !readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-b border-panel bg-panel/70 px-3 py-2 backdrop-blur">
          <span className="prop-label !m-0">Pen</span>
          {PEN_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPenColor(c.value)}
              className={`h-6 w-6 rounded-full border-2 shadow-sm ${penColor === c.value ? 'ring-2 ring-accent ring-offset-1' : 'border-black/20'}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <span className="prop-label !m-0 pl-2">Size</span>
          <input
            type="range"
            min={PEN_WIDTH_MIN}
            max={PEN_WIDTH_MAX}
            value={penWidth}
            onChange={(e) => setPenWidth(+e.target.value)}
            className="w-28 accent-[color:rgb(var(--accent))]"
            title="Marker thickness"
          />
          <span className="w-9 text-[11px] tabular-nums text-muted">{penWidth}px</span>
          <span className="ml-auto text-[11px] text-muted">Draw — strokes fade in {PEN_LIFE / 1000}s · Esc to stop</span>
        </div>
      )}

      {/* text highlighter color strip — only visible while marking */}
      {highlightMode && !readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-b border-panel bg-panel/70 px-3 py-2 backdrop-blur">
          <span className="prop-label !m-0 flex items-center gap-1">
            <Icon name="highlighter" size={14} /> Mark
          </span>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setHlColor(c.value)}
              className={`h-6 w-6 rounded-full border-2 shadow-sm ${hlColor === c.value ? 'ring-2 ring-accent ring-offset-1' : 'border-black/20'}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <span className="ml-auto text-[11px] text-muted">Click a text box to highlight · click again to remove · Esc to stop</span>
        </div>
      )}

      {!readOnly && isOwner && shareOpen && (
        <SharePanel
          noteId={note.id}
          share={share}
          inviteUrl={inviteUrl}
          busyRef={shareBusy}
          onChange={setShare}
          toast={toast}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 sm:px-4">
        <input
          value={title}
          readOnly={readOnly}
          onChange={(e) => { setTitle(e.target.value); scheduleSave(); }}
          className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none sm:text-lg"
        />
        <span className="text-[11px] text-muted sm:text-xs">
          {access === 'editor' ? `Editing via invite · ${realtime.members.length} online` : readOnly ? `Viewing shared note · ${realtime.members.length} online` : 'Autosaves · drag to move · double-click to edit'}
        </span>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-auto bg-canvas">
          <div className="note-canvas relative w-fit p-3 sm:p-4">
            <canvas ref={canvasEl} />
          </div>

          {/* other people's live cursors */}
          <CursorLayer cursorsRef={cursorsRef} members={realtime.members} />

          {/* floating format bar — appears while editing any text box */}
          {editTarget && !readOnly && !penMode && (
            <FormatBar
              text={editTarget}
              mode={richMode}
              onMode={setRichMode}
              textColors={TEXT_COLORS}
              highlightColors={HIGHLIGHT_COLORS}
              onStyle={(patch) => applyRichStyle(patch, richMode)}
              onClear={() => clearRichRange(richMode)}
            />
          )}
        </div>

        {/* drawer backdrop (mobile/tablet only) */}
        {panelOpen && (
          <div className="absolute inset-0 z-20 bg-black/25 lg:hidden" onClick={() => setPanelOpen(false)} />
        )}

        {/* side panel: contextual properties for the selected object.
            Stacked row on ≥lg, slide-over drawer below that. */}
        <aside
          className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-xs flex-col gap-4 overflow-y-auto border-l border-panel bg-panel/95 p-4 shadow-2xl backdrop-blur transition-transform duration-200 lg:static lg:z-auto lg:w-72 lg:max-w-none lg:translate-x-0 lg:border-l-0 lg:bg-panel/70 lg:shadow-none ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex items-center justify-between lg:hidden">
            <span className="prop-label">Properties</span>
            <button onClick={() => setPanelOpen(false)} className="tool-btn icon-only border border-panel" title="Close panel">✕</button>
          </div>
          {sel ? (
            <>
              <SideSection title="Transform">
                <div className="flex items-center gap-2 text-sm">
                  <span>Rotation</span>
                  <input
                    type="number" min={-360} max={360} value={Math.round(sel.angle || 0)}
                    onChange={(e) => {
                      const o = fab.current.getActiveObject();
                      if (o) { o.set('angle', (+e.target.value || 0) % 360); fab.current.requestRenderAll(); scheduleSave(); refreshPanel(); }
                    }}
                    className="w-full rounded-md border border-panel bg-canvas px-2 py-1.5 text-center"
                  />
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-12 shrink-0">Scale</span>
                  <input
                    type="range" min={25} max={300} value={resizePct}
                    onChange={(e) => scaleSel(+e.target.value)}
                    className="w-full accent-[color:rgb(var(--accent))]"
                  />
                  <span className="w-10 text-right text-xs text-muted">{resizePct}%</span>
                </div>
              </SideSection>

              {obj && (
                <SideSection title="Text">
                  <div className="flex flex-col gap-2">
                    <select onMouseDown={(e) => e.stopPropagation()} className="w-full rounded-md border border-panel bg-canvas px-2 py-1.5" value={obj.fontFamily} onChange={(e) => styleText({ fontFamily: e.target.value })}>
                      {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input type="number" min={8} max={96} value={obj.fontSize} onChange={(e) => styleText({ fontSize: +e.target.value || 18 })} className="w-full rounded-md border border-panel bg-canvas px-2 py-1.5" title="Font size" />
                    <span className="prop-label">Color</span>
                    <Swatches colors={TEXT_COLORS} value={obj.fill} onPick={(c) => styleText({ fill: c })} />
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(obj.fill) ? obj.fill : '#111827'} onChange={(e) => styleText({ fill: e.target.value })} className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-panel bg-transparent p-0" title="Custom color" />
                    <div className="flex gap-1.5">
                      <button onMouseDown={(e) => e.preventDefault()} className={`tool-btn border border-panel ${obj.fontWeight === 'bold' ? 'bg-accent text-white' : ''}`} title="Bold">B</button>
                      <button onMouseDown={(e) => e.preventDefault()} className={`tool-btn border border-panel italic ${obj.fontStyle === 'italic' ? 'bg-accent text-white' : ''}`} title="Italic">I</button>
                      <button onMouseDown={(e) => e.preventDefault()} className={`tool-btn border border-panel underline ${obj.underline ? 'bg-accent text-white' : ''}`} title="Underline">U</button>
                    </div>
                    <span className="prop-label">Align</span>
                    <AlignRow value={obj.textAlign} onPick={(v) => styleText({ textAlign: v })} />
                  </div>
                </SideSection>
              )}

              {sel.el?.type === 'shape' ? (
                <SideSection title="Fill">
                  <span className="prop-label mb-1.5 block">Background</span>
                  <Swatches colors={FILL_COLORS} value={sel.el?.style?.backgroundColor || '#93c5fd'} onPick={(c) => paintSelection(c)} />
                  <input type="color" value={sel.el?.style?.backgroundColor || '#93c5fd'} onChange={(e) => paintSelection(e.target.value)} className="mt-1.5 h-8 w-12 cursor-pointer rounded-md border border-panel bg-transparent p-0" title="Custom fill" />
                </SideSection>
              ) : (['sticky', 'code'].includes(sel.el?.type) && labelText() && (
                <SideSection title="Fill">
                  <span className="prop-label mb-1.5 block">Background</span>
                  <Swatches colors={FILL_COLORS} value={sel.el?.style?.backgroundColor || '#93c5fd'} onPick={(c) => paintSelection(c)} />
                  <input type="color" value={sel.el?.style?.backgroundColor || '#93c5fd'} onChange={(e) => paintSelection(e.target.value)} className="mt-1.5 h-8 w-12 cursor-pointer rounded-md border border-panel bg-transparent p-0" title="Custom fill" />
                </SideSection>
              ))}

              {(['sticky', 'code'].includes(sel.el?.type)) && labelText() && (
                <SideSection title="Text">
                  <div className="flex flex-col gap-2">
                    <button onClick={() => editLabelRef.current?.(sel)} onMouseDown={(e) => e.stopPropagation()}
                      className="tool-btn w-full border border-panel justify-center py-1.5" title="Edit text right on the page">
                      ✎ Edit text on page
                    </button>
                    <select value={labelText().fontFamily} onChange={(e) => styleLabel({ fontFamily: e.target.value })} className="w-full rounded-md border border-panel bg-canvas px-2 py-1.5">
                      {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input type="number" min={8} max={96} value={labelText().fontSize} onChange={(e) => styleLabel({ fontSize: +e.target.value || 16 })} className="w-full rounded-md border border-panel bg-canvas px-2 py-1.5" title="Label size" />
                    <div className="flex gap-1.5">
                      <button onMouseDown={(e) => e.preventDefault()} className={`tool-btn border border-panel ${labelText().fontWeight === 'bold' ? 'bg-accent text-white' : ''}`} title="Bold">B</button>
                      <button onMouseDown={(e) => e.preventDefault()} className={`tool-btn border border-panel italic ${labelText().fontStyle === 'italic' ? 'bg-accent text-white' : ''}`} title="Italic">I</button>
                      <button onMouseDown={(e) => e.preventDefault()} className={`tool-btn border border-panel underline ${labelText().underline ? 'bg-accent text-white' : ''}`} title="Underline">U</button>
                    </div>
                    <span className="prop-label">Align</span>
                    <AlignRow value={labelText().textAlign} onPick={(v) => styleLabel({ textAlign: v })} />
                    <span className="prop-label">Label color</span>
                    <Swatches
                      colors={sel.el?.type === 'code' ? CODE_COLORS : TEXT_COLORS}
                      value={labelText().fill}
                      onPick={(c) => styleLabel({ fill: c })}
                    />
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(labelText().fill) ? labelText().fill : '#111827'} onChange={(e) => styleLabel({ fill: e.target.value })} className="h-8 w-12 cursor-pointer rounded-md border border-panel bg-transparent p-0" title="Custom label color" />
                  </div>
                </SideSection>
              )}
            </>
          ) : (
            <div className="flex flex-col items-start gap-2 text-sm text-muted">
              <span className="prop-label">Properties</span>
              <p>Nothing selected — click any element on the page to style it here.</p>
              <p className="text-xs">Tip: double-click a sticky note or code window to edit its text right on the page.</p>
            </div>
          )}
        </aside>

        {/* floating toggle to reopen the properties drawer on small screens */}
        {!panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            className="absolute bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-lg text-white shadow-lg transition hover:scale-105 lg:hidden"
            title="Open properties"
          >
            ⚙️
          </button>
        )}
      </div>

      <input ref={imgInput} type="file" accept="image/*" onChange={handleImage} className="hidden" />
    </div>
  );
}
