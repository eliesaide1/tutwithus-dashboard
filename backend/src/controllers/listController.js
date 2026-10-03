import { ALL_LISTS, OPERATING_RULES } from '../config/constants.js';
import { Lead, Trial, Student } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** GET /api/lists — every dropdown the UI needs, in one round-trip. */
export const getLists = asyncHandler(async (_req, res) => {
  // Tutors and subjects in real use are free text; surface what is actually used.
  const [tutors, subjects] = await Promise.all([
    Trial.distinct('tutor').then((t) => t.filter(Boolean).sort()),
    Lead.distinct('subject').then((s) => s.filter(Boolean).sort()),
  ]);
  const studentTutors = await Student.distinct('tutor').then((t) => t.filter(Boolean));

  res.json({
    success: true,
    data: {
      ...ALL_LISTS,
      tutorsInUse: [...new Set([...tutors, ...studentTutors])].sort(),
      subjectsInUse: subjects,
      operatingRules: OPERATING_RULES,
    },
  });
});
