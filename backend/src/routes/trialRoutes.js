import { Router } from 'express';
import * as c from '../controllers/trialController.js';
import { protect, canWrite, restrict } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(protect);

router.get('/', c.listTrials);
router.get('/export', c.exportTrials);
router.post('/', canWrite, validate(c.trialSchema), c.createTrial);
router.get('/:id', c.getTrial);
router.patch('/:id', canWrite, validate(c.trialUpdateSchema), c.updateTrial);
router.post('/:id/review', canWrite, c.reviewTrial);
router.delete('/:id', restrict(['admin', 'manager']), c.deleteTrial);

export default router;
