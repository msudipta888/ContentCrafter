const mongoose = require('mongoose');
const eventModel = new mongoose.Schema({
    id:{
    type:String,
    required:true
    },
    prompt:{
        type:String,
        required:true
    },
   
},
{timestamps:true},
{collection:'Events'}
)
module.exports = mongoose.model('Events',eventModel);