import mongoose from 'mongoose';

await mongoose.connect(url);

export async function clean(User, doc) {
  await User.remove({ active: false });
  await doc.remove();
  await User.mapReduce({ map, reduce });
  User.find({ active: true }, (err, users) => console.log(users));
}
