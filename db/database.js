const mongoose = require ('mongoose');

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