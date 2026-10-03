import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

/**
 * Atomically produces human-readable business ids: LEAD-0001, TRL-0001, ...
 * The sheet used manual ids; here they are guaranteed unique and gap-free.
 */
export async function nextId(prefix, pad = 4) {
  const doc = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `${prefix}-${String(doc.seq).padStart(pad, '0')}`;
}

export async function resetSequences() {
  await Counter.deleteMany({});
}

export { Counter };
