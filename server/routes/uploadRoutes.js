import { Router } from 'express';
import { uploadImage } from '../controllers/uploadController.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.post('/upload/image', authRequired, uploadImage);

export default router;