import { Router } from 'express';
import * as c from '../controllers/leadController.js';
import { protect, canWrite, restrict } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(protect);

router.get('/', c.listLeads);
router.get('/export', c.exportLeads);
router.post('/', canWrite, validate(c.leadSchema), c.createLead);
router.patch('/bulk', canWrite, c.bulkUpdate);
router.get('/:id', c.getLead);
router.patch('/:id', canWrite, validate(c.leadUpdateSchema), c.updateLead);
router.patch('/:id/stage', canWrite, c.changeStage);
router.post('/:id/convert', canWrite, c.convertLead);
router.delete('/:id', restrict(['admin', 'manager']), c.deleteLead);

export default router;
