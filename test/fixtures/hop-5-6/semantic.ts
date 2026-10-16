import mongoose from 'mongoose';

await mongoose.connect(url);

export async function update(doc, User) {
  doc.set({ child: { age: 21 }, name: 'x' });
  const found = await User.exists({ email: 'a@b.c' });
  await User.updateOne({ _id: id }, { $set: { createdAt: new Date(), name: undefined } });
  return found;
}

const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, default: mongoose.Types.ObjectId },
  at: { type: Date, default: Date.now },
});
