import mongoose from 'mongoose';

await mongoose.connect(url, {
  serverSelectionTimeoutMS: 5000,
});
