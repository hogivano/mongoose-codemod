import mongoose from 'mongoose';

await mongoose.connect(url, { poolSize: 20 });
await mongoose.createConnection(url, { 'poolSize': 5 });
