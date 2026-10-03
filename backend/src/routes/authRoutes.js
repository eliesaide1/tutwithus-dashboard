import { Router } from 'express';
import * as c from '../controllers/authController.js';
import { protect, restrict } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/login', validate(c.loginSchema), c.login);

router.use(protect);
router.get('/me', c.me);
router.patch('/me', c.updateMe);
router.post('/change-password', c.changePassword);

router.post('/register', restrict(['admin']), validate(c.registerSchema), c.register);
router.get('/users', restrict(['admin', 'manager']), c.listUsers);
router.patch('/users/:id', restrict(['admin']), c.updateUser);
router.delete('/users/:id', restrict(['admin']), c.deleteUser);

export default router;
