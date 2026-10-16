import mongoose from 'mongoose';

const User = mongoose.model('User', new mongoose.Schema({ seen: Boolean }));

// Not Mongoose: the codebase's own data-access object. Must not be rewritten.
const userDb = { update: async (_patch: unknown) => null };

export async function touch(id: string) {
  await User.update({ _id: id }, { $set: { seen: true } });
  await User.update({ active: true }, { $set: { seen: true } }, { multi: true });
  await userDb.update({ _id: id });
}
