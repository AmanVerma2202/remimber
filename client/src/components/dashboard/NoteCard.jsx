import { motion } from 'framer-motion';
import { useToast } from '../common/Toast';

/** Human-friendly "5 min ago / yesterday / 3 Aug" time for the note card. */
function relativeTime(iso) {
  if (!iso) return '';
  const t = +new Date(iso);
  if (!t) return '';
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

/** A single note card in the history grid; opens the editor on click. */
export default function NoteCard({ note, onDelete, onTogglePin }) {
  const toast = useToast();
  const pinned = !!note.isPinned;

  const handlePin = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onTogglePin) return;
    try {
      await onTogglePin(note.id);
      toast.success(pinned ? 'Note unpinned' : 'Note pinned to top');
    } catch {
      toast.error('Could not update pin');
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative overflow-hidden rounded-xl bg-panel shadow transition hover:shadow-lg"
    >
      <a href={`/notes/${note.id}`} className="block">
        {/* thumbnail: a small preview PNG generated from the canvas on save */}
        <div className="flex h-32 items-center justify-center bg-canvas">
          {note.thumbnail ? (
            <img src={note.thumbnail} alt={note.title} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl opacity-30">📄</span>
          )}
        </div>
        <div className="flex items-center justify-between p-3">
          <div className="min-w-0">
            <h3 className="truncate font-medium">{note.title}</h3>
            <p className="text-xs text-muted">Edited {relativeTime(note.updatedAt || note.createdAt)}</p>
          </div>
          {pinned && <span className="ml-2 text-sm">📌</span>}
        </div>
      </a>

      {/* pin + delete are revealed on hover so the canvas stays uncluttered */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={handlePin}
          className={`rounded-lg p-1.5 transition hover:scale-110 ${pinned ? 'bg-panel/90 text-amber-500' : 'bg-panel/80 text-muted hover:text-amber-500'}`}
          title={pinned ? 'Unpin note' : 'Pin note to top'}
        >
          {pinned ? '📌' : '📍'}
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(note.id);
          }}
          className="rounded-lg bg-panel/80 p-1.5 text-muted transition hover:text-red-500"
          title="Delete note"
        >
          🗑️
        </button>
      </div>
    </motion.div>
  );
}