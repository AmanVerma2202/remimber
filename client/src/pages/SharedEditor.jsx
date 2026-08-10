import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CanvasEditor from '../components/editor/CanvasEditor';
import { notes as notesApi } from '../api/client';

/**
 * Opened from an invite link (/s/:code). Fetches the shared note and renders
 * the same canvas editor, but in the role the invite grants (editor|viewer).
 */
export default function SharedEditor() {
  const { code } = useParams();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await notesApi.shared(code);
        setPayload(res);
      } catch (err) {
        setError(err?.response?.data?.message || 'This invite link is invalid or was taken down.');
      }
    })();
  }, [code]);

  if (error) return <div className="p-10 text-center text-muted">{error}</div>;
  if (!payload) return <div className="p-10 text-center text-muted">Opening shared note…</div>;

  return <CanvasEditor note={payload.note} code={code} access={payload.access} />;
}