import mongoose from 'mongoose';

await mongoose.connect(url, { maxPoolSize: 20 });
await mongoose.createConnection(url, { 'maxPoolSize': 5 });
