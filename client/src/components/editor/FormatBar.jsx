import { useEffect, useState } from 'react';
import Icon from './icons';

/** Range targets the format bar can resolve a colour/style to. */
export const RICH_MODES = [
  { key: 'sel', label: 'Selection', tip: 'Exactly the characters you drag over, from one letter to many lines' },
  { key: 'word', label: 'Word', tip: 'The word at the caret (whole-word highlighting)' },
  { key: 'line', label: 'Line', tip: 'The whole rendered line at the caret' },
  { key: 'all', label: 'All', tip: 'Every character in this text box' },
];

/**
 * Floating format bar shown while a text box is being edited inline.
 *
 * Lets you format text at exactly the granularity you want — character, word,
 * line or whole block:
 *  - drag over some characters/words/lines, then pick a colour → only that run
 *    changes (characters / words / multiple lines).
 *  - target chip (Selection / Word / Line / All) resolves the neighbour chunk
 *    around the caret when nothing is dragged yet.
 *
 * The bar re-positions & re-reads the caret style every animation frame so the
 * active-swatch rings follow you while typing.
 */
export default function FormatBar({
  text, // fabric.Textbox currently in edit mode
  mode,
  onMode,
  onStyle,
  onClear,
  textColors,
  highlightColors,
}) {
  const [box, setBox] = useState({ show: false, x: 0, y: 0 });
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!text) return;
    let raf;
    const step = () => {
      const canvas = text.canvas;
      if (canvas && !canvas.disposed) {
        const wr = canvas.wrapperEl?.getBoundingClientRect();
        if (wr) {
          const z = canvas.getZoom() || 1;
          const b = text.getBoundingRect(true, true);
          const cx = wr.left + (b.left || 0) * z + (b.width || 0) * z * 0.5;
          const cy = wr.top + (b.top || 0) * z;
          const x = Math.max(4, Math.min(cx, window.innerWidth * 0.55 - 90));
          const y = Math.max(8, cy);
          setBox((prev) => {
            if (prev.show && Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5) return prev;
            return { show: true, x, y };
          });
        }
      }
      setTick((t) => (t + 1) % 10000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text]);

  useEffect(() => {
    if (!text) setBox((b) => ({ ...b, show: false }));
  }, [text]);

  if (!text || !box.show) return null;

  // live caret/decorative accent positions for the "Format" panel
  const caretStyle = readCaretStyle(text);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <div
        className="pointer-events-auto relative"
        style={{ position: 'absolute', left: box.x, top: box.y - 10, transform: 'translate(-50%, -100%)' }}
      >
        <div className="rounded-xl border border-panel bg-canvas/95 px-2 py-1.5 shadow-2xl backdrop-blur">
          {/* typography */}
          <div className="flex items-center gap-0.5 border-b border-panel pb-1.5">
            <FormatBtn active={caretStyle.bold} title="Bold" onClick={() => onStyle({ fontWeight: caretStyle.bold ? 'normal' : 'bold' })}>
              <Icon name="bold" />
            </FormatBtn>
            <FormatBtn active={caretStyle.italic} title="Italic" onClick={() => onStyle({ fontStyle: caretStyle.italic ? 'normal' : 'italic' })}>
              <Icon name="italic" />
            </FormatBtn>
            <FormatBtn active={caretStyle.underline} title="Underline" onClick={() => onStyle({ underline: !caretStyle.underline })}>
              <Icon name="underline" />
            </FormatBtn>
            <span className="mx-1 h-4 w-px bg-panel" />
            <FormatBtn title="Remove highlight from this target" onClick={() => onStyle({ textBackgroundColor: '' })}>
              <Icon name="highlighterOff" />
            </FormatBtn>
            <button
              onClick={onClear}
              onMouseDown={(e) => e.preventDefault()}
              className="ml-0.5 rounded-md border border-panel px-1.5 py-0.5 text-[10px] text-muted transition hover:bg-canvas hover:text-ink"
              title="Clear formatting on this target"
            >
              ✕
            </button>
          </div>

          {/* highlight palette */}
          <div className="flex items-center gap-1 border-b border-panel py-1.5">
            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted" title="Marker highlight — applies to the active target">
              <Icon name="highlighter" size={13} />
            </span>
            <div className="flex gap-1">
              {highlightColors.map((c) => (
                <button
                  key={c.value}
                  title={c.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onStyle({ textBackgroundColor: c.value })}
                  className={`h-5 w-5 shrink-0 rounded-full border shadow-sm transition hover:scale-110 ${
                    same(c.value, caretStyle.hl) ? 'ring-2 ring-accent ring-offset-1 ring-offset-canvas' : ''
                  }`}
                  style={{ backgroundColor: c.value, borderColor: 'rgba(0,0,0,0.15)' }}
                />
              ))}
            </div>
            {caretStyle.hl && (
              <button
                onClick={() => onStyle({ textBackgroundColor: '' })}
                onMouseDown={(e) => e.preventDefault()}
                className="ml-auto text-[10px] text-muted underline-offset-2 hover:text-red-500 hover:underline"
                title="Remove the highlight colour from this target"
              >
                Remove
              </button>
            )}
          </div>

          {/* text colour palette */}
          <div className="flex items-center gap-1 pt-1.5">
            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Text</span>
            <div className="flex gap-1">
              {textColors.slice(0, 10).map((c) => (
                <button
                  key={c}
                  title={c}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onStyle({ fill: c })}
                  className={`h-5 w-5 shrink-0 rounded-full border shadow-sm transition hover:scale-110 ${
                    same(c, caretStyle.fill) ? 'ring-2 ring-accent ring-offset-1 ring-offset-canvas' : ''
                  }`}
                  style={{ backgroundColor: c, borderColor: 'rgba(0,0,0,0.15)' }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* target scope */}
        <div className="relative mt-1.5 flex justify-center gap-1">
          {RICH_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => onMode(m.key)}
              onMouseDown={(e) => e.preventDefault()}
              title={m.tip}
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                mode === m.key
                  ? 'border-accent bg-accent text-white'
                  : 'border-panel bg-panel/80 text-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* little connector arrow */}
        <div className="pointer-events-none absolute bottom-[-6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-panel bg-canvas/95" />
      </div>
    </div>
  );
}

/** Read fill/background/bold/italic at the caret, always merged with base. */
function readCaretStyle(t) {
  try {
    const i = Math.min(t.selectionStart ?? 0, (t.text || '').length);
    const styles = t.getSelectionStyles(Math.max(0, i - 1), Math.min(i + 1, (t.text || '').length), true) || [];
    const st = styles.find(Boolean) || {};
    return {
      fill: st.fill || t.fill || '',
      hl: st.textBackgroundColor || '',
      bold: st.fontWeight === 'bold' || t.fontWeight === 'bold',
      italic: st.fontStyle === 'italic' || t.fontStyle === 'italic',
      underline: !!st.underline || !!t.underline,
    };
  } catch {
    return { fill: '', hl: '', bold: false, italic: false, underline: false };
  }
}

/** eq of two colour values (ignores whitespace). */
function same(a, b) {
  return !!a && a.replace(/\s/g, '') === (b || '').replace(/\s/g, '');
}

function FormatBtn({ children, title, onClick, active }) {
  return (
    <button
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 text-[13px] transition ${
        active ? 'border-accent bg-accent/15 text-accent' : 'border-panel text-muted hover:bg-canvas hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}