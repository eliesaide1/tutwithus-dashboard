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
router.delete('/:id', restrict(['admin', 'manager']), c.deleteStudent);

// Per-subject enrollments
router.post('/:id/enrollments', canWrite, validate(c.enrollmentSchema), c.addEnrollment);
router.patch('/:id/enrollments/:enrollmentId', canWrite, validate(c.enrollmentSchema.partial()), c.updateEnrollment);
router.delete('/:id/enrollments/:enrollmentId', canWrite, c.removeEnrollment);
router.post('/:id/enrollments/:enrollmentId/log-session', canWrite, c.logSession);
router.post('/:id/enrollments/:enrollmentId/renew', canWrite, c.renewPackage);

// Kept so older links keep working; acts on the first active subject.
router.post('/:id/log-session', canWrite, c.logSession);
router.post('/:id/renew', canWrite, c.renewPackage);

// Fold a duplicate person into this one.
router.post('/:id/merge', restrict(['admin', 'manager']), c.mergeStudents);

export default router;
