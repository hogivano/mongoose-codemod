import mongoose from 'mongoose';

await mongoose.connect(url, {
  keepAlive: true,
  keepAliveInitialDelay: 300000,
  maxPoolSize: 10,
});
