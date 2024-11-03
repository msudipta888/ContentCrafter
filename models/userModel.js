 const mongoose = require('mongoose')
 const userModel =new  mongoose.Schema({
    tgId:{
        type: String,
        unique:true,
        required:true
    },
    firstName:{
        type:String,
        required:true,
    },
    lastName:{
        type:String,
    },
    isBot:{
        type:Boolean,
        required:true,
    },
    userName:{
        type:String,
        unique:true
    },
    promtToken:{
        type:Number,
        required:false
    },
    completionToken:{
        type:Number,
        required:false
    },
 },
    {timeStamps:true},
    {collection:'userInfo'}
);
module.exports =mongoose.model('User',userModel);