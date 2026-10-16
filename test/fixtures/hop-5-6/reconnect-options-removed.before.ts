import mongoose from 'mongoose';

await mongoose.connect(url, {
  reconnectTries: 30,
  reconnectInterval: 500,
  serverSelectionTimeoutMS: 5000,
});
