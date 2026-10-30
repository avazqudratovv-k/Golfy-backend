import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import adminApp from './appAdmin';


const ADMIN_PORT = process.env.ADMIN_PORT ?? 3012;

mongoose
  .connect(process.env.MONGO_URL as string)
  .then(() => {
    console.log("MONGODB successful connection (admin)");
    adminApp.listen(ADMIN_PORT, () => {
      console.log(`Admin server running on: ${ADMIN_PORT}`);
    });
  })
  .catch((err) => {
    console.log("MongoDB connection error:", err);
    process.exit(1);
  });
