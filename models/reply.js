const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
const page = require('../common/page');
const markdown = require('markdown-it');

let ReplySchema = new Schema({
  topic_id: {
    type: ObjectId,
    required: true
  },
  author_id: {
    type: ObjectId,
    required: true
  },
  create_time: {
    type: Date,
    default: Date.now
  },
  update_time: {
    type: Date,
    default: Date.now
  },
  content: {
    type: String,
    required: true
  },
  like_count: {
    type: Number,
    default: 0,
  },
  dislike_count: {
    type: Number,
    default: 0
  },
  deleted: {
    type: Boolean,
    default: false
  }
});

ReplySchema.index({
  create_time: -1
});
ReplySchema.index({
  topic_id: 1,
  create_time: -1
});

ReplySchema.virtual('abstract').get(function(){
  let md = new markdown({html: true});
  let content = md.render(this.content);
  content = content.replace(/\s+/g,'').replace(/<[^>]+>/ig,'').replace(/&nbsp;|\r|\t/ig, "");
  if(content.length <= 100){
    return content;
  }else{
    return content.slice(0,100);
  }
});

page.addFindPageForQuery(ReplySchema, 'getReplyForPage');

// //更新点赞和踩数
// ReplySchema.statics.updateLike = async function(like) {
//   let reply_id = like.target_id;
//   let user_id = like.user_id;
//   let mood = like.mood;
//   let reply = await ctx.model('reply').findById(reply_id);
//   //更新reply
//   if (reply) { //若存在
//     mood === 0 ? reply.like_count-- : reply.dislike_count--;
//     await reply.saveQ();
//     return reply;
//   }
//   //若不存在
//   mood === 0 ? reply.like_count


// }

module.exports = ReplySchema;