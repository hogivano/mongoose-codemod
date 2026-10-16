import mongoose from 'mongoose';

export function toId(raw) {
  const a = new mongoose.Types.ObjectId(raw);
  const b = new mongoose.Types.ObjectId(raw);
  return [a, b];
}
