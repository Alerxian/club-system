const router = require('koa-router')();
const config = require('../config');
const validator = require('validator');
const tools = require('../common/tools');
const markdown = require('markdown-it');
const upload = require('../common/upload');
const Promise = require('promise');
const sign = require('../middlewares/sign');
const path = require('path')

//用户注册页
router.get('/register', async (ctx, next) => {
  await ctx.render('user/register', {
    title: '用户注册'
  });
});

//提取注册信息
router.post('/register', async (ctx, next) => {
  let body = tools.trimObjectValue(ctx.request.body);
  if (!validator.isEmail(body.email)) {
    return ctx.error('email格式不正确，请检查后重试!');
  }

  if (!body.username || !body.password || !body.email) {
    return ctx.error('您请求的参数不完整!');
  }

  let User = ctx.model('user');
  //验证用户名是否重复
  let user = await User.findOneQ({
    username: body.username
  });
  if (user) {
    return ctx.error('用户名已经注册过啦!')
  }
  //验证邮箱
  user = await User.findOneQ({
    email: body.eamil
  });

  if (user) {
    return ctx.error('此邮箱已经注册过啦!');
  }

  user = new User(body);
  let result = await user.saveQ(); //保存进数据库
  if (result) {
    return ctx.success();
  } else {
    return ctx.error('注册失败!');
  }
});

//登录页面
router.get('/login', async (ctx, next) => {
  await ctx.render('user/login', {
    title: '用户登录'
  });
});

//登录操作
router.post('/login', async (ctx, next) => {
  let body = tools.trimObjectValue(ctx.request.body);
  if (!body.username || !body.password) {
    return ctx.error('请填写完整!');
  }
  let User = ctx.model('user');
  // 验证用户名密码
  let user = await User.check_password(body.username, body.password);
  if (!user) {
    return ctx.error('用户名不存在或密码错误!');
  }
  //用户名密码正确
  ctx.session.user = user.toObject();

  return ctx.success();
});

//退出登录
router.get('/logout', async (ctx, next) => {
  ctx.session.user = null;
  ctx.redirect('/');
});

// 用户设置页
router.get('/setting', sign.isLogin, async (ctx, next) => {
  let username = ctx.state.current_user.username;
  let User = ctx.model('user');
  let user = await User.findOneQ({
    username: username
  });
  await ctx.render('user/setting', {
    title: '用户中心',
    user: user
  });
});

//修改个人设置
router.post('/', sign.isLogin, async (ctx, next) => {
  let user = await ctx.model('user').findOneQ({
    username: ctx.state.current_user.username
  });
  let body = ctx.request.body;
  if (!validator.isEmail(body.email)) {
    return ctx.error('邮箱格式不正确，请重新填写!');
  }

  Object.assign(user, body);
  let result = await user.saveQ();
  console.log(user)
  if (result) {
    // 更新session
    ctx.session.user = user.toObject();
    return ctx.success()
  } else {
    return ctx.error('保存失败，请重试!');
  }
});

//设置头像
router.post('/setavatar', sign.isLogin, async (ctx, next) => {
  let file;
  try {
    file = await upload(ctx.req, 'avatar')
  } catch (e) {
    return ctx.error(e.message);
  }

  if (!file)
    return ctx.error('发生错误，请检查后重试！');

  let User = ctx.model('user');
  let user = await User.findById(ctx.session.user._id);

  user.avatar = file.filename;
  await user.saveQ()

  ctx.session.user = user.toObject();
  ctx.redirect('/user/setting#setavatar');
});

// 修改密码
router.post('/setpass', sign.isLogin, async(ctx, next) => {
  let body = tools.trimObjectValue(ctx.request.body);
  let oldpass = body.oldpass;
  let newpass = body.newpass;

  //检验oldpass是否正确
  if(!oldpass || !newpass) {
    return ctx.error('您请求的参数不完整!');
  }
  let user = await ctx.model('user').check_password(ctx.state.current_user.username,oldpass);
  if(!user) {
    return ctx.error('您输入的密码不正确，请重新输入!');
  }
  user.password = newpass;
  let result = await user.saveQ();
  if(result) {
    //重新登陆
    ctx.session.user = null;
    return ctx.success('修改成功,请重新登陆!');
  }else {
    return ctx.error('保存失败，请重试!');
  }
});

// 消息列表
router.get('/message', sign.isLogin, async (ctx, next) => {
  let User = ctx.model('user');
  let user = await User.findOneQ({
    username: ctx.state.current_user.username
  });

  let Message = ctx.model('message');
  let messages = await Message.find({
    master_id: user._id
  }, null, {
    sort: 'is_read -create_time',
    limit: 10
  });
  // 根据是否已读，倒叙排列即最近的在最上面

  messages = await Promise.all(messages.map(async (msg) => {
    msg.topic = await ctx.model('topic').findById(msg.topic_id);
    msg.author = await User.findById(msg.author_id);
    return msg;
  }));

  await ctx.render('user/message', {
    title: '个人消息',
    messages: messages,
    user: user
  });
});


//已读消息
router.get('/message/:msg_id', sign.isLogin, async (ctx, next) => {
  let msg_id = ctx.params.msg_id;
  if(!validator.isMongoId(msg_id)) {
    return ctx.error('您请求的参数有误，请重试!');
  }

  let message = await ctx.model('message').findById(msg_id);
  if(!message) {
    return ctx.error('该消息已被删除！无法查看');
  }
  if(!message.is_read) {
    message.is_read = true;
    await message.saveQ();
  }
  await ctx.redirect(`/topic/${message.topic_id}#${message.reply_id}`);
})

//用户首页
router.get('/:username', async (ctx, next) => {
  /**
   * 1.到用户数据库里查询
   * 2.查找该用户相应的帖子和回复
   */
  let username = ctx.params.username;
  let User = ctx.model('user');
  let user = await User.findOneQ({
    username: username
  });
  if (!user) {
    return ctx.error('该用户不存在!');
  }

  //查询topic和reply的参数
  let options = {
    sort: 'create_time',
    'limit': 5
  };
  let query = {
    author_id: user._id,
    deleted: false
  };

  let Topic = ctx.model('topic');
  let [topics, replys] = await Promise.all([
    Topic.find(query, null, options),
    ctx.model('reply').find(query, null, options)
  ]);
  replys = await Promise.all(replys.map(async (reply) => {
    reply.topic = await Topic.findById(reply.topic_id);
    return reply;
  }));

  await ctx.render('user/home', {
    title: username + '个人主页',
    topics: topics,
    replys: replys,
    user: user,
    md: new markdown()
  });
});

//用户回复内容列表页
router.get('/:username/reply', async (ctx, next) => {
  let username = validator.trim(ctx.params.username);
  let User = ctx.model('user');
  let user = await User.findOneQ({
    username: username
  });
  if (!user) {
    return ctx.error('该用户不存在!');
  }

  let currentPage = +ctx.query.page || 1;
  let Topic = ctx.model('topic');
  let result = await ctx.model('reply').getReplyForPage({
    author_id: user._id,
    deleted: false
  }, null, {
    sort: '-update_time'
  }, currentPage, config.pageSize, config.showPageNum);
  let replys = result.data;
  replys = await Promise.all(replys.map(async (reply) => {
    reply.topic = await Topic.findById(reply.topic_id);
    return reply;
  }));

  await ctx.render('user/replys', {
    title: username　 + '个人主页',
    replys: replys,
    page: result.page,
    user: user,
    md: new markdown()
  });
});


// 用户话题列表页
router.get('/:username/topic', async (ctx, next) => {
  let username = validator.trim(ctx.params.username);
  let user = await ctx.model('user').findOneQ({
    username: username
  });
  if (!user) {
    return ctx.error('该用户不存在!');
  }

  let currentPage = +ctx.query.page || 1;
  let Topic = ctx.model('topic');
  let query = {
    author_id: user._id,
    deleted: false
  };
  let result = await Topic.getTopicForPage(query, null, {
      sort: '-update_time'
    },
    currentPage, config.pageSize, config.showPageNum);
  let topics = result.data;

  await ctx.render('user/topics', {
    title: username + '个人主页',
    topics: topics,
    user: user,
    page: result.page,
    md: new markdown()
  });
});

module.exports = router;