import mongoose from 'mongoose';

await mongoose.connect(url, {
  maxPoolSize: 10,
});
