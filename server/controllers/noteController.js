import Note from '../models/Note.js';
import crypto from 'crypto';

/**
 * List notes for the current user — history view.
 * Sorted by most-recently-updated, paginated to keep payloads small.
 */
export async function listNotes(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const query = { userId: req.user.id };

    // optional title/tag search for the dashboard
    if (req.query.q) {
      const rx = new RegExp(req.query.q, 'i');
      query.$or = [{ title: rx }, { tags: rx }];
    }

    const [notes, total] = await Promise.all([
      Note.find(query)
        .select('-elements') // history view doesn't need full element payloads
        .sort({ isPinned: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Note.countDocuments(query),
    ]);

    res.json({ notes, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

/** Get one note with its full elements[] payload. */
export async function getNote(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ note });
  } catch (err) {
    next(err);
  }
}

/** Create a blank note. */
export async function createNote(req, res, next) {
  try {
    const note = await Note.create({ userId: req.user.id, title: req.body.title || 'Untitled' });
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
}

/** Update / autosave a note. Accepts any subset of the note fields. */
export async function updateNote(req, res, next) {
  try {
    const { title, elements, thumbnail, background, isPinned, tags } = req.body;
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        ...(title !== undefined && { title }),
        ...(elements !== undefined && { elements }),
        ...(thumbnail !== undefined && { thumbnail }),
        ...(background !== undefined && { background }),
        ...(isPinned !== undefined && { isPinned }),
        ...(tags !== undefined && { tags }),
      },
      { new: true, runValidators: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ note });
  } catch (err) {
    next(err);
  }
}

/** Delete a note. */
export async function deleteNote(req, res, next) {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    next(err);
  }
}

/* ---------------- sharing (invite link) ---------------- */

/** Owner: enable sharing and (re)generate an invite code with a role. */
export async function shareNote(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    const role = req.body.role === 'viewer' ? 'viewer' : 'editor';
    if (!note.share?.enabled || req.body.regenerate) {
      note.share.code = crypto.randomBytes(9).toString('base64url');
    }
    note.share.role = role;
    note.share.enabled = true;
    note.share.enabledAt = new Date();
    await note.save();

    res.json({ share: note.share });
  } catch (err) {
    next(err);
  }
}

/** Owner: disable sharing (the invite link dies). */
export async function unshareNote(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    note.share = { code: '', role: 'editor', enabled: false, enabledAt: null };
    await note.save();
    res.json({ note });
  } catch (err) {
    next(err);
  }
}

/** anyone logged in: open a shared note via its invite code. */
export async function getSharedNote(req, res, next) {
  try {
    const note = await Note.findOne({ 'share.code': req.params.code, 'share.enabled': true });
    if (!note) return res.status(404).json({ message: 'Invite link is invalid or was taken down' });
    const access = note.share.role;
    res.json({ note, access, owner: { name: req.user.name } });
  } catch (err) {
    next(err);
  }
}

/** Collaborator (editor role): persist edits to a shared note. */
export async function updateSharedNote(req, res, next) {
  try {
    const { title, elements, thumbnail } = req.body;
    const note = await Note.findOne({ 'share.code': req.params.code, 'share.enabled': true });
    if (!note) return res.status(404).json({ message: 'Invite link is invalid or was taken down' });
    if (note.share.role !== 'editor') return res.status(403).json({ message: 'This link is view-only' });

    if (title !== undefined) note.title = title;
    if (elements !== undefined) note.elements = elements;
    if (thumbnail !== undefined) note.thumbnail = thumbnail;
    await note.save();
    res.json({ note });
  } catch (err) {
    next(err);
  }
}