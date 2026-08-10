import { motion, AnimatePresence } from 'framer-motion';
import NoteCard from './NoteCard';
import { useNotes } from '../../store/noteStore';

export default function NoteGrid({ onDelete, onTogglePin }) {
  const { list, loading } = useNotes();

  if (loading && list.length === 0) {
    return <p className="py-16 text-center text-muted">Loading notes…</p>;
  }

  if (list.length === 0) {
    return (
      <p className="py-16 text-center text-muted">
        No notes yet — create one to get started.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AnimatePresence>
        {list.map((note) => (
          <NoteCard key={note.id} note={note} onDelete={onDelete} onTogglePin={onTogglePin} />
        ))}
      </AnimatePresence>
    </div>
  );
}