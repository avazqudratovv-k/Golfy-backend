import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import app from './app';

mongoose
  .connect(process.env.MONGO_URL as string, {})
  .then((data) => {
    console.log("MONGODB successful connection"); 
    const PORT = process.env.PORT ?? 3011;
    app.listen(PORT, function () {
        console.log(`Server is running on:${PORT}`)
    })
  })
  .catch((err) => {
    console.log("There is an ERROR on connection MONGDB", err);
    process.exit(1);
  });
