import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
  maxPoolSize: 10,
});

// Built in a function, not passed inline — the shape most real codebases use.
export function makeDatabaseOptions() {
  const options = {
    useNewUrlParser: true,
    connectTimeoutMS: 120000,
    useCreateIndex: true,
    autoIndex: true,
  };
  return options;
}
