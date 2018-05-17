//点赞、踩
const mongoose = require('mongoose');
const config = require('../config');
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;



/*
mood:
    0:赞
    1：踩
type:
    feed
    comment 

 */
let LikeSchema = new Schema({
    user_id: {type: ObjectId},
    type: {type: String, default: 'comment'},
    target_id: {type: ObjectId},//reply_id
    mood: {type: Number, default: 0},
    deleted: {type: Boolean, default: false},
    create_at: {type: Date, default: Date}
});


LikeSchema.index({user_id: 1, type: 1, target_id: 1, mood: 1 },{unique: true});

module.exports = LikeSchema;