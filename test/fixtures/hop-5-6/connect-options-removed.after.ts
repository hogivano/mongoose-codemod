import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URL, {
  maxPoolSize: 10,
});

// Built in a function, not passed inline — the shape most real codebases use.
export function makeDatabaseOptions() {
  const options = {
    connectTimeoutMS: 120000,
    autoIndex: true,
  };
  return options;
}
