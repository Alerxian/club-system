const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
const page = require('../common/page');

let CollectSchema = new Schema({
  topic_id: {
    type: ObjectId,
    required: true
  },
  //收藏人id
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
  is_collected: {
    type: Boolean,
    default: false
  }
});

CollectSchema.index({
  create_time: -1
});
CollectSchema.index({
  topic_id: 1,
  create_time: -1
});

page.addFindPageForQuery(CollectSchema, 'getCollectForPage');

module.exports = CollectSchema;