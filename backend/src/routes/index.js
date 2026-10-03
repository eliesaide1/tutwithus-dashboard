import { Router } from 'express';
import authRoutes from './authRoutes.js';
import leadRoutes from './leadRoutes.js';
import trialRoutes from './trialRoutes.js';
import followupRoutes from './followupRoutes.js';
import studentRoutes from './studentRoutes.js';
import { protect, restrict } from '../middleware/auth.js';
import { getDashboard, getToday } from '../controllers/dashboardController.js';
import * as reports from '../controllers/reportController.js';
import { getLists } from '../controllers/listController.js';
import { listActivity } from '../controllers/activityController.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date() }));

router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/trials', trialRoutes);
router.use('/followups', followupRoutes);
router.use('/students', studentRoutes);

router.get('/dashboard', protect, getDashboard);
router.get('/dashboard/today', protect, getToday);

router.get('/reports/weekly', protect, reports.getWeeklyReport);
router.get('/reports/weekly/history', protect, reports.listWeeklyReports);
router.get('/reports/weekly/:weekKey/export', protect, reports.exportWeeklyReport);
router.put('/reports/weekly/:weekKey', protect, restrict(['admin', 'manager']), reports.saveWeeklyReport);

router.get('/lists', protect, getLists);
router.get('/activity', protect, listActivity);

export default router;
