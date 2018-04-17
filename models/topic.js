/**
 * 主题模型
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
const validator = require('validator');
const page = require('../common/page');
const config = require('../config');

let TopicSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  author_id: {
    type: ObjectId,
    required: true
  },
  reply_count: {
    type: Number,
    default: 0
  },
  visit_count: {
    type: Number,
    default: 0
  },
  last_reply: {
    type: ObjectId
  },
  last_reply_at: {
    type: Date,
    default: Date.now
  },
  tag: {
    type: String
  },
  create_time: {
    type: Date,
    default: Date.now
  },
  update_time: {
    type: Date,
    default: Date.now
  },
  deleted: {
    type: Boolean,
    default: false
  },
  top: {
    type: Boolean,
    default: false
  }, //置顶帖
  good: {
    type: Boolean,
    default: false
  } //精华帖
});

TopicSchema.index({
  create_time: -1
}); //按照创建时间排序
TopicSchema.index({
  author_id: 1,
  create_time: -1
});

/**
 * 回复主题
 */
TopicSchema.statics.reply = async function (topic_id, reply_id) {
  if (!validator.isMongoId(topic_id + '') || !validator.isMongoId(reply_id + '')) {
    return false;
  }

  let result = await this.updateQ({
    _id: topic_id
  }, {
    '$inc': {
      'reply_count': 1
    },
    '$set': {
      last_reply: reply_id,
      last_reply_at: Date.now()
    }
  });
  return result;
}

/**
 * 获取主题信息
 * 更新浏览数
 */

TopicSchema.statics.get_topic = async function (topic_id) {
  if (!validator.isMongoId(topic_id + '')) {
    return false;
  }
  let result = await this.findByIdAndUpdateQ(topic_id, {
    '$inc': {
      'visit_count': 1
    }
  });
  return result;
}

/**
 * 根据分页获取主题
 */
page.addFindPageForQuery(TopicSchema, 'getTopicForPage');

module.exports = TopicSchema;