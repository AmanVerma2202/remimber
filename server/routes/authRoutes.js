import { Router } from 'express';
import { signup, login, me, updateTheme, logout } from '../controllers/authController.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// ----- email + password auth -----
router.post('/signup', signup);
router.post('/login', login);

// ----- session -----
router.post('/logout', authRequired, logout);
router.get('/me', authRequired, me);
router.patch('/me/theme', authRequired, updateTheme);

export default router;