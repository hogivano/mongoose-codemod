import mongoose from 'mongoose';

export async function load(doc) {
  await doc.populate('author');
  await doc.populate('comments').populate('author');
  await doc.execPopulate();
}
