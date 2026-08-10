import { Router } from 'express';
import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  shareNote,
  unshareNote,
  getSharedNote,
  updateSharedNote,
} from '../controllers/noteController.js';
import { importPdf } from '../controllers/uploadController.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// every note route requires login
router.use(authRequired);

router.get('/', listNotes);
router.post('/', createNote);
router.post('/import-pdf', importPdf);

// sharing via invite link (declared before /:id so "share" isn't read as an id)
router.get('/share/:code', getSharedNote);
router.patch('/share/:code', updateSharedNote);

router.get('/:id', getNote);
router.patch('/:id', updateNote);
router.delete('/:id', deleteNote);

// sharing via invite link (owner actions)
router.post('/:id/share', shareNote);
router.delete('/:id/share', unshareNote);

export default router;