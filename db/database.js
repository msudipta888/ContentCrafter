const mongoose = require ('mongoose');
require('dotenv').config();
const express = require('express');
const app = express();
module.exports= ()=>{
  return  mongoose.connect(process.env.MONGODB_API,{
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ssl: true, 
    serverSelectionTimeoutMS: 20000
  })
    .then(()=>{
        console.log('Connected to MongoDB')
    }).catch((error)=>{
      console.error('MongoDB connection error:', error);

    })
}
mongoose.connection.once('open', () => {
  app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });
}); 