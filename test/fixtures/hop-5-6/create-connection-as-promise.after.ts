import mongoose from 'mongoose';

export async function open(url) {
  const connection = await mongoose.createConnection(url).asPromise();
  return connection;
}

// Multi-line options: the rewrite must not re-indent the object literal.
export async function openWithOptions(url) {
  return await mongoose.createConnection(url, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  }).asPromise();
}
