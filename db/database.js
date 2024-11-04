const mongoose = require ('mongoose');
require('dotenv').config();
const express = require('express');
const app = express();
const startServer = () => {
  app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });
};
module.exports= async ()=>{
  try {
    await mongoose.connect(process.env.MONGODB_API, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ssl: true,
      serverSelectionTimeoutMS: 20000
    });
    console.log('Connected to MongoDB');
    startServer();
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}
mongoose.connection.once('open', () => {
 console.log('Mongodb connection is open')
}); 