import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../store/noteStore';
import { notes as notesApi } from '../api/client';
import NoteGrid from '../components/dashboard/NoteGrid';
import { useToast } from '../components/common/Toast';

export default function Dashboard() {
  const { list, fetchList, create, remove, togglePin } = useNotes();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  // load the history view on mount
  useEffect(() => {
    fetchList();
    // warm up the editor's lazy chunk (fabric + jspdf) while the user browses,
    // so opening a note never waits on a big download
    const load = () => import('../pages/Editor').catch(() => {});
    if (typeof requestIdleCallback === 'function') {
      const pid = requestIdleCallback(load, { timeout: 2000 });
      return () => cancelIdleCallback(pid);
    }
    const pid = setTimeout(load, 2000);
    return () => clearTimeout(pid);
  }, []);

  // debounce search input so we don't hit the API per keystroke
  useEffect(() => {
    const t = setTimeout(() => fetchList({ q }), 300);
    return () => clearTimeout(t);
  }, [q]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const note = await create('Untitled');
      navigate(`/notes/${note.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    const note = list.find((n) => n.id === id);
    if (!note) return;
    try {
      await remove(id);
      toast.success(`"${note.title}" deleted`);
    } catch {
      toast.error('Could not delete note');
    }
  };

  // upload a PDF → backend rasterizes pages into a new note → open it.
  // `res.note` = new flow (backend creates the note); fallback covers older servers.
  const handlePdf = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('pdf', file);
    fd.append('title', file.name.replace(/\.pdf$/i, '') || 'Imported PDF');
    try {
      toast.info('Importing PDF…');
      const res = await notesApi.importPdf(fd);
      let note = res.note;
      if (!note) {
        note = await create(res.title || 'Imported PDF');
        await notesApi.update(note.id, { elements: res.elements || [] });
      }
      await fetchList();
      navigate(`/notes/${note.id}`);
      toast.success('PDF imported');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not import that PDF.');
    }
    e.target.value = '';
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold sm:text-2xl">Your notes</h1>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or tag…"
          className="w-full rounded-lg border border-panel bg-canvas px-3 py-2 text-sm sm:w-auto"
        />

        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-panel px-3 py-2 text-sm hover:bg-panel"
        >
          📥 Import PDF
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          onChange={handlePdf}
          className="hidden"
        />

        <button
          onClick={handleCreate}
          disabled={creating}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-70"
        >
          {creating ? 'Creating…' : '+ New note'}
        </button>
      </div>

      <NoteGrid onDelete={handleDelete} onTogglePin={togglePin} />
    </div>
  );
}