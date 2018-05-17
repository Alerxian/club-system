/**
 * 用户模型
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const config = require('../config');
const path = require('path');
const url = require('url');
const ObjectId = mongoose.Schema.ObjectId;
const page = require('../common/page');

let UserSchema = new mongoose.Schema({
  username: {type: String,required: true},
  password: {type: String, required: true },
  email: {type: String, required: true },
  role: {type: Number, default: 1},
  // 用户等级 1: 普通用户
  // 100 后台管理员
  follow_people: [{type: ObjectId, ref: 'User'}],
  follow_people_count: {type: Number, default: 0},
  follow_topic: [{type: ObjectId, ref: 'User'}],
  follow_topic_count: {type: Number, defualt: 0},
  home: {type: String}, //个人主页
  github: { type: String },
  avatar: {  type: String },
  score: {  type: Number,  default: 0 },
  signature: {  type: String,   default: "个性签名" },
  topic_count: {   type: Number,  default: 0},
  reply_count: {  type: Number,  default: 0 },
  create_time: { type: Date,  default: Date.now },
  //访问令牌
  access_token: {type: String},
});

//设置Schema初始化的参数
// toObject表示在提取数据的时候，把documents内容转化为Object
UserSchema.set('toObject', {
  getters: true,
  virtuals: true
});
UserSchema.index({
  username: 1
}, {
  unique: true
});
//设置username为索引
//为User模型设置一个虚拟属性Vritual property
UserSchema.virtual('avatar_url').get(function () {
  if (!this.avatar)
    return config.default_avatar;
  if (config.qiniu.origin && config.qiniu.origin !== 'http://your qiniu domain'){
    return url.resolve(config.qiniu.origin, this.avatar);
  }
  if(this.avatar.indexOf('https') > -1){
    return this.avatar;
  }
  return path.join(config.upload.url, this.avatar);
})

/**
 * password加密
 */

UserSchema.path('password').set(function (v) {
  return crypto.createHash('md5').update(v).digest('base64');
});

//验证用户名密码是否正确
UserSchema.statics.check_password = async function (username, password) {
  let user = await this.findOneQ({
    username: username,
    password: crypto.createHash('md5').update(password).digest('base64')
  });
  return user;
}

UserSchema.statics.updateTopicCount = async function (userId, num) {
  let user = await this.findOneQ({
    _id: userId
  });
  user.topic_count += num;
  //增加减少积分
  user.score += num > 0 ? num * config.score.topic : -num * config.score.topic;
  user.save();
  return user;
}


/**
 * 根据分页获取用户
 */
page.addFindPageForQuery(UserSchema, 'getUserForPage');

UserSchema.statics.updateReplyCount = async function (userId, num) {
  let user = await this.findOneQ({
    _id: userId
  });
  user.reply_count += num;
  // 增加减少积分
  user.score += num > 0 ? config.score.reply : -config.score.reply;
  user.save();
  return user;
}


module.exports = UserSchema;