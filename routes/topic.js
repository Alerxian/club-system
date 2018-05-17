const router = require('koa-router')();
const config = require('../config');
const validator = require('validator');
const tools = require('../common/tools');
const markdown = require('markdown-it');
const Promise = require('promise');
const sign = require('../middlewares/sign');
const at = require('../common/at');

//发表主题页面
router.get('/create', sign.isLogin, async (ctx, next) => {
  await ctx.render('topic/edit', {
    title: '发表话题',
    tags: config.tags
  });
});

// 发表主题
router.post('/',sign.isLogin, async (ctx, next) => {
  let body = tools.trimObjectValue(ctx.request.body);

  if (!body.title || !body.tag || !body.content) {
    return ctx.error('您请求的参数不完整！');
  }
  // 获取用户id
  let user_id = ctx.state.current_user._id;
  let Topic = ctx.model('topic');
  //添加文章
  let topic = new Topic({
    title: body.title,
    tag: body.tag,
    content: body.content,
    author_id: user_id
  });

  let result = await topic.saveQ();
  if (result) {
    //更新用户话题数
    let User = ctx.model('user');
    let user = await User.updateTopicCount(user_id, 1);
    //更新session
    ctx.session.user = user.toObject();
    ctx.success({
      topic_id: result._id
    });
  } else {
    ctx.error('发表失败!');
  }
});

//查看主题
router.get('/:topic_id', async (ctx, next) => {
  let topic_id = ctx.params.topic_id;
  let Topic = ctx.model('topic');
  let topic = await Topic.get_topic(topic_id);
  let isAdmin = ctx.state.current_user && ctx.state.current_user.isAdmin;
  if (!topic || (!isAdmin && topic.deleted)) {
    return ctx.error('您要查看的文章不存在或已删除！', {
      jump: '/'
    });
  }

  let md = new markdown({
    html: true
  });
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
  let is_follow = current_user && current_user.follow_people.indexOf(String(topic.author_id)) > -1;
  await ctx.render('topic/show', {
    title: topic.title,
    topic: topic,
    replys: replys,
    is_follow: is_follow,
    md: md
  });
});

//收藏帖子
router.get('/:topic_id/collect',sign.isLogin, async (ctx, next) => {
  let topic_id = ctx.params.topic_id;
  let user = ctx.state.current_user;
  let Topic = ctx.model('topic');
  let Collect = ctx.model('collect');
  let collect = await Collect.findOneQ({
    topic_id: topic_id,
    author_id: user._id
  });

  if(!collect){
    let _collect = new Collect({
      topic_id: topic_id,
      author_id: ctx.state.current_user._id,
      is_collected: true
    });
    let result = await _collect.saveQ();
    if(result) {
      return ctx.success({
        is_collected: true
      });
    }
  }
  collect.is_collected = !collect.is_collected;
  let result_collect = await collect.saveQ();
  if(result_collect) {
    return ctx.success({
      is_collected: collect.is_collected
    });
  }

});


//编辑主题页面
router.get('/:topic_id/edit', sign.isLogin, async (ctx, next) => {

  /**
   * 1.验证topic_id是否是正确的格式，通过topic_id查表，得到相应的topic数据
   * 2.验证当前登录用户是否是管理员或者该话题的发表者
   * 3.判断当前帖子是否删除或不存在该话题，
   * 4.渲染编辑页面
   */

  let topic_id = ctx.params.topic_id;
  if (!validator.isMongoId(String(topic_id))) {
    return ctx.error('您请求的参数有误，请重试!');
  }
  let Topic = ctx.model('topic');
  let topic = await Topic.findById(topic_id);
  if (!topic || topic.deleted) {
    return ctx.error('您要编辑的话题不存在或已删除!');
  }
  if (!(ctx.session.user.isAdmin || ctx.session.user._id.toString() === topic.author_id.toString())) {
    return ctx.error('您没有权限编辑此话题！');
  }

  await ctx.render('topic/edit', {
    topic: topic,
    title: '编辑话题',
    tags: config.tags
  });
});

// 更新修改主题
router.post('/:topic_id/edit', sign.isLogin, async (ctx, next) => {
  let topic_id = ctx.params.topic_id;
  if (!validator.isMongoId(String(topic_id))) {
    return ctx.error('您请求的参数有误，请重试!');
  }
  let Topic = ctx.model('topic');
  let topic = await Topic.findById(topic_id);
  if (!topic || topic.deleted) {
    return ctx.error('您要编辑的话题不存在或已删除!');
  }
  if (!(ctx.session.user.isAdmin || ctx.session.user._id.toString() === topic.author_id.toString())) {
    return ctx.error('您没有权限编辑此话题');
  }
  let body = tools.trimObjectValue(ctx.request.body);
  if (!body.title || !body.content || !body.tag) return ctx.error('您请求的参数不完整！');

  topic.title = body.title;
  topic.content = body.content;
  topic.tag = body.tag;
  topic.update_time = Date.now();

  let result = await topic.saveQ();
  if (result) {
    return ctx.success({
      topic_id: topic._id
    });
  } else {
    return ctx.error('更新话题失败!');
  }
});

//回复主题
router.post('/:topic_id/reply', sign.isLogin, async (ctx, next) => {
  /**
   * 1.获取topic_id，验证是否是mongodbid
   * 2.获取前台传过来的内容
   * 3.写入reply数据库
   * 4.更新用户回复数和评论数
   */

  let topic_id = ctx.params.topic_id;
  if (!validator.isMongoId(topic_id)) {
    return ctx.error('您请求的参数有误，请检查后重试！');
  }

  let content = ctx.request.body.content;
  if (!content) {
    return ctx.error('您尚未填写评论!请检查后再试');
  }

  let Reply = ctx.model('reply');
  let user_id = ctx.state.current_user._id;
  let reply = new Reply({
    content: content,
    author_id: user_id,
    topic_id: topic_id
  });
  let result = await reply.saveQ();
  if (result) {
    //更新用户回复数和评论数
    let [user, res] = await Promise.all([
      ctx.model('user').updateReplyCount(user_id, 1),
      ctx.model('topic').reply(topic_id, result._id),
      at.sendMessageToUser(content, topic_id, user_id, result._id)
    ]);
    //更新用户session
    // console.log(ctx.state.current_user);
    ctx.session.user = user.toObject();
    // console.log(ctx.session.user)
    if (res.ok) {
      ctx.redirect(`/topic/${topic_id}#${result._id}`);
    } else {
      return ctx.error('回复失败，请重试!');
    }
  }
});

// 置頂帖子
router.get('/:topic_id/top', sign.isAdmin, async (ctx, next) => {
  let topic_id = ctx.params.topic_id;
  if (!validator.isMongoId(topic_id)) {
    return ctx.error('您请求的参数有误，请检查后重试!');
  }

  let Topic = ctx.model('topic');
  let topic = await Topic.findById(topic_id);
  topic.top = !topic.top;
  let result = await topic.saveQ();
  if (result) {
    // let msg = topic.top ? '置顶帖子成功！' : '取消置顶成功！'
    ctx.success({
      top: topic.top
    });
  } else {
    return ctx.error('操作失败，请重试!');
  }
});

// 删除帖子
router.get('/:topic_id/delete', sign.isAdmin, async (ctx, next) => {
  let topic_id = ctx.params.topic_id;
  if(!validator.isMongoId(topic_id)) {
    return ctx.error('您请求的参数有误，请重试!');
  }

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
    return ctx.success('操作成功！话题已被删除', {
      deleted: true
    });
  }else {
    return ctx.success('操作成功！话题已被恢复', {
      deleted: false
    });
  }
});


module.exports = router;