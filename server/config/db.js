import mongoose from 'mongoose';

/** Connect to MongoDB. Fails fast so you notice config mistakes early. */
export default async function connectDB() {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

