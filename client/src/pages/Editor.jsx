import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CanvasEditor from '../components/editor/CanvasEditor';
import { useNotes } from '../store/noteStore';
import { notes as notesApi } from '../api/client';

export default function Editor() {
  const { id } = useParams();
  const { setActive } = useNotes();
  const [note, setNote] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { note: loaded } = await notesApi.get(id);
        setActive(loaded);
        setNote(loaded);
      } catch {
        setError('Note not found.');
      }
    })();
  }, [id]);

  if (error) return <p className="p-8 text-center text-muted">{error}</p>;
  if (!note) return <p className="p-8 text-center text-muted">Loading note…</p>;

  return <CanvasEditor note={note} />;
}