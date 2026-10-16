import mongoose from 'mongoose';

export async function load(doc) {
  await doc.populate('author').execPopulate();
  await doc.populate('comments').populate('author').execPopulate();
  await doc.execPopulate();
}
