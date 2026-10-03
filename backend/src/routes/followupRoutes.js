import { Router } from 'express';
import * as c from '../controllers/followupController.js';
import { protect, canWrite, restrict } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(protect);

router.get('/', c.listFollowups);
router.get('/export', c.exportFollowups);
router.post('/', canWrite, validate(c.followupSchema), c.createFollowup);
router.patch('/:id', canWrite, validate(c.followupUpdateSchema), c.updateFollowup);
router.post('/:id/attempt', canWrite, c.logAttempt);
router.post('/:id/complete', canWrite, c.completeFollowup);
router.delete('/:id', restrict(['admin', 'manager']), c.deleteFollowup);

export default router;
