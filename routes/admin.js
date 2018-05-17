const router = require('koa-router')();
const config = require('../config');
const Promise = require('promise');
const sign = require('../middlewares/sign');
const tools = require('../common/tools');
const validator = require('validator');
const markdown = require('markdown-it');
const fs = require('fs');
var path=require('path'); 

let md = new markdown({
  html: true
});
//跳转到后台登录页面
router.get('/', async (ctx, next) => {
  if (ctx.state.current_user && ctx.state.current_user.isAdmin) {
    return ctx.redirect('/admin/index');
  }
  await ctx.render('admin/page-login', {
        title: '管理员登录'
    });
});

//处理登录
router.post('/login',  async (ctx, next) => {
    let body = tools.trimObjectValue(ctx.request.body);
  if (!body.username || !body.password) {
    return ctx.error('请填写完整!');
  }
  let User = ctx.model('user');
  // 验证用户名密码
  let user = await User.check_password(body.username, body.password);
  if (!user) {
    return ctx.error('没有此用户或密码错误！');
  }
  if(config.admins.indexOf(user.username) != -1){
    ctx.session.user = user.toObject();
    return await ctx.success({})
  }else {
    return ctx.error('您不是管理员，无法执行该操作！');
  }
});


//后台管理首页
router.get('/index', sign.isAdmin, async (ctx, next) => {
  let user = ctx.state.current_user;
  let User = ctx.model('user');
  let Topic = ctx.model('topic');
  let Reply = ctx.model('reply');
  user.count = await User.countQ({});
  let topics = {},replies = {};
  topics.count = await Topic.countQ({});
  replies.count = await Reply.countQ({});

  await ctx.render('admin/index', {
        title: '后台管理首页',
        user: user,
        topics: topics,
        replies: replies
    });
});
  
router.get('/user', sign.isAdmin, async (ctx, next) => {
  let User = ctx.model('user');
  let current_page = +ctx.query.page || 1;
  // let result = await User.getUserForPage({}, null, {
  //   sort:''
  // }, current_page);
  let users = await User.findQ({}, null, {sort:'-score -role _id' });
  users = await Promise.all(users.map(async function(user) {
    user.is_deleted = user.is_deleted || 'true';
    user.is_Admin = user.role === 100 ? '超级管理员' : '普通用户';
    return user;
  }));
  return ctx.render('admin/page-user', {
    title: '后台管理首页',
    user: ctx.state.current_user,
    users: users,
  })
});

//修改用户
router.post('/user/setting', sign.isAdmin, async (ctx, next) => {
  let body = ctx.request.body;
  let user = await ctx.model('user').findOneQ({
    username: body.username
  });
  
  if (!validator.isEmail(body.email)) {
    return ctx.error('email格式不正确，请检查后重试！');
  }

  Object.assign(user, body);
  let result = await user.saveQ();
  if (result) {
    return ctx.body = user.toObject();
  } else {
    return ctx.body = '保存失败，请重试!';
  }
});

// 删除用户
router.get('/user/delete', sign.isAdmin, async (ctx, next) => {
  let username = ctx.query.username;
  if(!username) return;
  let user = await ctx.model('user').findOneQ({
    username: username
  });
  if(!user) {
    return ctx.body = {error:'该用户不存在'};
  }
  let result = await user.removeQ();
  //删除该用户的评论和发表的话题
  let [topics, replies]= await Promise.all([
     ctx.model('topic').findQ({
      author_id: user._id
    }),
     ctx.modal('reply').findQ({
      author_id:user.id
    })
  ]);
 
  await topics.removeQ();
  await replies.removeQ();
  if(result) {
    return ctx.body = {success:'删除成功'}
  }else {
    return ctx.body = {error: '删除失败，请重试！'};
  }
});

// 话题管理
router.get('/topic', sign.isAdmin, async (ctx, next) => {
  let current_page = +ctx.query.page || 1;

  // 读取主题列表
  let Topic = ctx.model('topic');
  let User = ctx.model("user");
  let Reply = ctx.model('reply');
  // 组合查询对象
  let query = {
    deleted: false
  };
  let count = await Topic.countQ(query);
  // 查询数据 // 查询分页数据
  let result = await Topic.getTopicForPage(query, null, {
      sort: '-top -last_reply_at'
    }, current_page);

  let topics = result.data;
  //  读取发帖及回帖用户信息
  topics = await Promise.all(topics.map(async (topic) => {
    topic.author = await User.findById(topic.author_id, 'username avatar');
    if (topic.last_reply) {
      topic.reply = await Reply.findById(topic.last_reply, 'author_id');
      if(topic.reply){
        topic.reply.author = await User.findById(topic.reply.author_id, 'username');
      }
    }
    return topic;
  }));
  return ctx.render('admin/topic-cards', {
    title: '话题管理页',
    user: ctx.state.current_user,
    topics: topics,
    page: result.page,
    md: md,
    count: count,
  })
});
// 查看话题
router.get('/topic/:topic_id', sign.isAdmin, async (ctx, next) => {
  let topic_id = ctx.params.topic_id;
  let Topic = ctx.model('topic');
  let topic = await Topic.get_topic(topic_id);

  if (!topic) {
    return ctx.body = {error:'您要查看的文章不存在或已删除！'}
  }

  //读取回复内容
  let Reply = ctx.model('reply');
  let replys = await Reply.findQ({
    topic_id: topic_id,
    deleted: false
  }, null, {
    sort: 'create_time'
  });
  //读取回复用户
  let User = ctx.model('user');
  replys = await Promise.all(replys.map(async (reply) => {
    //读取用户表，查找出username和头像
    reply.author = await User.findById(reply.author_id, 'username avatar');
    return reply;
  }));

  [topic.author, topic.author_topic_list] = await Promise.all([
    User.findById(topic.author_id), //读取主题作者，
    Topic.find({ //读取作者其他主题
      author_id: topic.author_id,
      deleted: false
    }, 'title', {
      sort: '-create_time', //倒序排列
      limit: 10
    })
  ]);
  //是否收藏
  let Collect = ctx.model('collect');
  let collect = await Collect.findOneQ({
    topic_id:topic_id
  });
  topic.collect = collect;
  let current_user = ctx.state.current_user;
  await ctx.render('admin/topic_detail', {
    title: topic.title,
    topic: topic,
    replys: replys,
    md: md,
    user: current_user
  });
});

router.get('/topic/:topic_id/edit', sign.isAdmin, async (ctx, next) => {
  
  let topic_id = ctx.params.topic_id;
  if (!validator.isMongoId(String(topic_id))) {
    return ctx.error('您请求的参数有误，请重试!');
  }
  let Topic = ctx.model('topic');
  let topic = await Topic.findById(topic_id);
  if (!topic || topic.deleted) {
    return ctx.error('您要编辑的话题不存在或已删除!');
  }
  await ctx.render('admin/topic_edit', {
    topic: topic,
    title: '编辑话题',
    tags: config.tags,
    user: ctx.state.current_user,
  });
});
//删除话题
router.get('/topic/:topic_id/delete', sign.isAdmin, async (ctx, next) => {
  let topic_id = ctx.params.topic_id;
  let Topic = ctx.model('topic');
  let topic = await Topic.findById(topic_id);
  if(!topic) {
    return ctx.error('您要查看的文章不存在或已删除！');
  }
  topic.deleted = !topic.deleted;
  await topic.saveQ();

  //更新用户话题数
  let count = topic.deleted ? -1 : 1;
  let user = await ctx.model('user').updateTopicCount(topic.author_id, count);
  // 如果被删除帖子的用户是正在登录的用户，则更新该用户的session数据
  if(ctx.state.current_user && ctx.state.current_user._id.toString() === user._id.toString()){
    ctx.session.user = user.toObject();
  }
  // // 删除该帖子下相应的评论回复
  // let Reply = ctx.model('reply');
  // let reply = await Reply.findById(topic_id);
  // reply.deleted = !reply.deleted;
  // await reply.saveQ();

  if(topic.deleted) {
    return ctx.redirect('/admin/topic')
  }
});

// 评论管理
router.get('/comment', sign.isAdmin, async (ctx, next) => {
  let current_page = +ctx.query.page || 1;

  // 读取主题列表
  let Topic = ctx.model('topic');
  let User = ctx.model("user");
  let Reply = ctx.model('reply');
  // 组合查询对象
  let query = {
  };
  let count = await Reply.countQ(query);
  // 查询数据 // 查询分页数据
  let result = await Reply.getReplyForPage(query, null, {
      sort: '-create_time -deleted'
    }, current_page);
  let comments = result.data;
  // let comments = await Reply.findQ(query, null, {sort: '-create_time'});
  //  读取发帖及回帖用户信息
  comments = await Promise.all(comments.map(async (comment) => {
    comment.topic = await Topic.findById(comment.topic_id);
    comment.author = await User.findById(comment.author_id);
    return comment;
  }));
  return ctx.render('admin/comment-table', {
    title: '评论管理',
    user: ctx.state.current_user,
    comments: comments,
    page: result.page,
    count: result.count,
    md: md,
  })
});

// 删除评论
router.get('/comment/delete', sign.isAdmin, async (ctx, next) => {
  let reply = await ctx.model('reply').findById(ctx.query.reply_id);
  try{
    //删除回复
    await reply.removeQ();
    //更新用户回复数
    let user = await ctx.model('user').updateReplyCount(reply.author_id, -1);
    //删除相应的like
    let Like = ctx.model('like');
    let like = await Like.findOneQ({
      target_id: reply._id
    });
    if(like) await like.removeQ();
    return ctx.body = {success:'删除成功！'};
  } catch(e) {
    console.log(e);
    return ctx.body = {error:'删除失败！'};
  }
});

//权限管理
router.get('/role', sign.isAdmin, async (ctx, next) => {
  let User = ctx.model('user');
  let current_page = +ctx.query.page || 1;
  let result = await User.getUserForPage({role: 100}, null, {
    sort:'-score'
  }, current_page);
  let users = result.data;
  // users = users.filter(function(user) {
  //   user.is_Admin = config.admins.indexOf(user.username) > -1;
  //   return user.is_Admin;
  // });
  return ctx.render('admin/role', {
    title: '权限管理',
    user: ctx.state.current_user,
    users: users,
    page: result.page,
    count: result.count
  })
});

router.post('/admin_user/add', sign.isAdmin, async (ctx, next) => {
  let body = ctx.request.body;
  if (!validator.isEmail(body.email)) {
    return ctx.error('email格式不正确，请检查后重试！');
  }

  if (!body.username || !body.password || !body.email) {
    return ctx.error('您请求的参数不完整!');
  }

  let User = ctx.model('user');
  // 验证用户名是否重复
  let user = await User.findOneQ({
    username: body.username
  });
  
  if(user) {
    user.role = 100;
    await user.saveQ();
    return ctx.body = {success: '添加管理员成功'};
  }; 
  
  user = new User(body);
  user.role = 100;
  let result = await user.saveQ(); //保存进数据库
  if(result) {
    ctx.body = {success: '添加管理员成功'}
  }else {
    ctx.body = {error: '添加失败！'};
  }
});

//站点管理
router.get('/setting/default', sign.isAdmin, async (ctx, next) => {
  return ctx.render('admin/default-setting', {
    config: config,
    title: '系统配置',
    user: ctx.state.current_user,
  });
});

//设置站点
router.post('/setting/default', sign.isAdmin, async (ctx, next) => {
  let body = tools.trimObjectValue(ctx.request.body);
  let mongodb = body.mongodb.split(':');
  var file1 = path.resolve('config.js');
  console.log(file1)
  fs.readFile(file1,{flag:'r+',encoding:'utf-8'}, function(err,data) {
    console.log(data);
    console.log(data.toString());
  })
  config.sitename = body.sitename;
  config.describute = body.describute;
  config.abstract = body.abstract;
  config.mongodb.host = mongodb[0];
  config.mongodb.port = mongodb[1];
  config.score.topic = body.topic_score;
  config.score.reply = body.reply_score;
  return ctx.body = {success: '设置成功'};
});

module.exports = router;
