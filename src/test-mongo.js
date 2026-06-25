import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: String,
    role: String
  }));

  const users = await User.find({}).limit(10);
  console.log('Users:', users);
  await mongoose.disconnect();
}

run().catch(console.error);
