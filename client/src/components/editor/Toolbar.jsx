import Icon from './icons';

/** Toolbar for the canvas editor. Fully controlled: renders buttons and
 *  fires callbacks; the editor component owns all Fabric state. */
export default function Toolbar({
  hasSelection,
  pages,
  onAddPage,
  onRemovePage,
  onCreateText,
  onCreateCode,
  onCreateSticky,
  onCreateTable,
  onCreateShape,
  onAddImage,
  onDelete,
  onDuplicate,
  onForward,
  onBackward,
  onBack,
  onExport,
  onSaveNow,
  saving,
  dirty,
  zoom,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  canUndo,
  canRedo,
  readOnly,
  members = [],
  isOwner,
  shareOpen,
  onShare,
  penMode,
  onTogglePen,
  highlightMode,
  onToggleHighlight,
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-panel bg-panel/70 px-3 py-2 backdrop-blur">
      {/* nav + undo / redo */}
      <div className="flex items-center gap-1">
        <button onClick={onBack} className="tool-btn icon-only" title="Back to notes">
          <Icon name="back" />
        </button>
        <Divider />
        <button onClick={onUndo} disabled={!canUndo || readOnly} className="tool-btn icon-only" title="Undo (⌘Z)">
          <Icon name="undo" />
        </button>
        <button onClick={onRedo} disabled={!canRedo || readOnly} className="tool-btn icon-only" title="Redo (⌘⇧Z)">
          <Icon name="redo" />
        </button>
      </div>

      {!readOnly && (
        <>
      {/* insertable content */}
      <div className="tool-group">
        <span className="tool-group-label hidden sm:inline">Add</span>
        <button onClick={onCreateText} className="tool-btn" title="Plain text (double-click to type)">
          <Icon name="text" />
        </button>
        <button onClick={onCreateCode} className="tool-btn" title="Code editor block">
          <Icon name="code" />
        </button>
        <button onClick={onCreateSticky} className="tool-btn" title="Sticky note">
          <Icon name="sticky" />
        </button>
        <button onClick={onCreateTable} className="tool-btn" title="Table">
          <Icon name="table" />
        </button>
        <button onClick={onAddImage} className="tool-btn" title="Upload image">
          <Icon name="image" />
        </button>
        <button onClick={onTogglePen} className={`tool-btn gap-1.5 ${penMode ? 'bg-accent text-white' : ''}`} title={penMode ? 'Done drawing (Esc)' : 'Free pen — draw, strokes fade after a few seconds'}>
          <Icon name="pen" />
          {penMode ? 'Pen ✓' : 'Pen'}
        </button>
        <button onClick={onToggleHighlight} className={`tool-btn gap-1.5 ${highlightMode ? 'bg-accent text-white' : ''}`} title={highlightMode ? 'Done highlighting (Esc)' : 'Text highlighter — click a text box to highlight it, click again to remove'}>
          <Icon name="highlighter" />
          {highlightMode ? 'Mark ✓' : 'Mark'}
        </button>
      </div>

      {/* shapes */}
      <div className="tool-group">
        <span className="tool-group-label hidden sm:inline">Shapes</span>
        {SHAPES.map((s) => (
          <button key={s.key} onClick={() => onCreateShape(s.key)} className="tool-btn" title={s.label}>
            <Icon name={s.icon} />
          </button>
        ))}
      </div>

      {/* pages */}
      <div className="tool-group">
        <span className="tool-group-label hidden sm:inline">Page {pages}</span>
        <button onClick={onAddPage} className="tool-btn icon-only" title="Add a page">
          <Icon name="plus" />
        </button>
        <button onClick={onRemovePage} disabled={pages <= 1} className="tool-btn icon-only" title="Remove last page">
          <Icon name="minus" />
        </button>
      </div>
        </>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-2">
        {/* zoom */}
        <div className="tool-group">
          <span className="tool-group-label hidden sm:inline">Zoom</span>
          <button onClick={onZoomOut} className="tool-btn icon-only" title="Zoom out">
            <Icon name="zoomOut" />
          </button>
          <button onClick={onZoomFit} className="tool-btn icon-only" title="Fit to screen">
            <Icon name="fit" />
          </button>
          <button onClick={onZoomIn} className="tool-btn icon-only" title="Zoom in">
            <Icon name="zoomIn" />
          </button>
          <span className="w-10 shrink-0 text-center text-[11px] font-medium tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
        </div>

        {/* selection actions */}
        {hasSelection && !readOnly && (
          <div className="tool-group">
            <span className="tool-group-label hidden sm:inline">Selected</span>
            <button onClick={onDuplicate} className="tool-btn icon-only" title="Duplicate (⌘D)">
              <Icon name="duplicate" />
            </button>
            <button onClick={onForward} className="tool-btn icon-only" title="Bring forward">
              <Icon name="forward" />
            </button>
            <button onClick={onBackward} className="tool-btn icon-only" title="Send backward">
              <Icon name="backward" />
            </button>
            <button onClick={onDelete} className="tool-btn icon-only hover:!border-red-200 hover:!bg-red-50 hover:!text-red-600" title="Delete selection (Del)">
              <Icon name="trash" />
            </button>
          </div>
        )}

        {/* collaborators in this note */}
        {members.length > 0 && (
          <div className="flex items-center gap-1" title={members.map((m) => `${m.name} (${m.access})`).join(', ')}>
            {members.map((m) => (
              <span
                key={m.id}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-panel text-[10px] font-bold text-white shadow"
                style={{ backgroundColor: m.color }}
                title={`${m.name} · ${m.access === 'viewer' ? 'view only' : 'editing'}`}
              >
                {(m.name || '?').slice(0, 2).toUpperCase()}
              </span>
            ))}
            <span className="ml-0.5 text-[11px] text-muted">{members.length}</span>
          </div>
        )}

        {readOnly ? (
          <span className="tool-group-label !mx-0">View only</span>
        ) : (
          isOwner && (
            <button onClick={onShare} className={`tool-btn gap-1.5 border border-panel ${shareOpen ? 'bg-accent text-white' : ''}`} title="Invite people with a link">
              <Icon name="link" />
              Share
            </button>
          )
        )}

        {/* save status */}
        <span className={`flex items-center gap-1.5 text-xs ${dirty ? 'text-muted' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {saving ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Saving…
            </>
          ) : dirty ? 'Unsaved' : '✓ Saved'}
        </span>

        <Divider />

        <button onClick={onSaveNow} disabled={saving || !dirty} className="btn-brand rounded-lg px-3 py-1.5 text-sm font-medium transition" title={dirty ? 'Save now (⌘S)' : 'All changes saved'}>
          Save
        </button>
        <button onClick={onExport} className="tool-btn" title="Export as PDF">
          <Icon name="download" />
          PDF
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return <span className="h-5 w-px bg-panel shadow-sm" />;
}

const SHAPES = [
  { key: 'rect', icon: 'rect', label: 'Rectangle' },
  { key: 'circle', icon: 'circle', label: 'Circle' },
  { key: 'triangle', icon: 'triangle', label: 'Triangle' },
  { key: 'line', icon: 'line', label: 'Line' },
  { key: 'arrow', icon: 'arrow', label: 'Arrow' },
  { key: 'star', icon: 'star', label: 'Star' },
  { key: 'heart', icon: 'heart', label: 'Heart' },
];