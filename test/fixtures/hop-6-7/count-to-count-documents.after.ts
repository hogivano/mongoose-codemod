import mongoose from 'mongoose';

const User = mongoose.model('User', new mongoose.Schema({ active: Boolean }));

// Not Mongoose: the codebase's own data-access object. Must not be rewritten.
const userDb = { count: async (_filter: unknown) => 0 };

export async function total() {
  const mine = await User.countDocuments({ active: true });
  const theirs = await userDb.count({ active: true });
  return mine + theirs;
}
