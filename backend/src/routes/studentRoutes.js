import { Router } from 'express';
import * as c from '../controllers/studentController.js';
import { protect, canWrite, restrict } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(protect);

router.get('/', c.listStudents);
router.get('/export', c.exportStudents);
router.post('/', canWrite, validate(c.studentSchema), c.createStudent);
router.get('/:id', c.getStudent);
router.patch('/:id', canWrite, validate(c.studentUpdateSchema), c.updateStudent);
router.post('/:id/log-session', canWrite, c.logSession);
router.post('/:id/renew', canWrite, c.renewPackage);
router.delete('/:id', restrict(['admin', 'manager']), c.deleteStudent);

export default router;
