import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sbs:sbs123456@sbsranker.lh9n8xd.mongodb.net/ranker?appName=sbsRanker';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  // Let's get batches
  const batches = await mongoose.connection.db.collection('batches').find({}).toArray();
  console.log('Batches found:', batches.map(b => ({ id: b._id, name: b.name })));

  // Let's get users
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log('Users found:');
  console.dir(users.map(u => ({
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    batch: u.batch
  })), { depth: null });

  await mongoose.disconnect();
}

check();
