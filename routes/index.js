const router = require('koa-router')();
const config = require('../config');
const Promise = require('promise');
const Page = require('../common/page');
const sign = require('../middlewares/sign');
const upload = require('../common/upload');
const getData = require('../models/zhihu');
const markdown = require('markdown-it');
let md = new markdown({
    html: true
  });
// 获取首页内容
router.get('/', async (ctx, next) => {

  let current_tag = config.tags.indexOf(ctx.query.tag) > -1 ?
    ctx.query.tag : 'all';

  // +号让其转换为数字
  let current_page = +ctx.query.page || 1;

  // 读取主题列表
  let Topic = ctx.model('topic');
  let User = ctx.model("user");
  let Reply = ctx.model('reply');

  // 组合查询对象
  let query = {
    deleted: false
  };

  if (current_tag != 'all')
    query.tag = current_tag;
  // 查询数据
  let [result, scoreRank] = await Promise.all([
    // 查询分页数据
    Topic.getTopicForPage(query, null, {
      sort: '-top -last_reply_at'
    }, current_page),
    // 排行榜数据
    User.find({
      score: {
        $gt: 0
      }
    }, 'username score avatar', {
      sort: '-score',
      limit: 10
    })
  ]);

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
  let topic_none = topics.filter( async function(topic){
    topic.is_reply = await Reply.findById(topic._id);
    return topic.reply || topic.is_reply
  });
  await ctx.render('index', {
    title: '首页',
    topics: topics,
    tags: config.tags,
    scoreRank: scoreRank,
    current_tag: current_tag,
    page: result.page,
    md:md,
    topic_none: topic_none.slice(0,5)
  });
});

router.get('zhihu', async (ctx, next) => {
  getData(ctx, next);
  let User = ctx.model('user');
  let username = 'admin';
  let user = await User.findOneQ({
    username: username
  });
  let topic_num = await ctx.model('topic').countQ({
    author_id: user._id
  });
  user = await User.updateTopicCount(user._id, topic_num);
  ctx.session.user = user.toObject();
  ctx.response.body = 'success';
});

//上传
router.post('upload', sign.isLogin, async (ctx) => {
  let file;
  try {
    file = await upload(ctx.req, 'file')
  } catch (e) {
    return ctx.error(e.message);
  }

  if (file) {
    return ctx.body = {
      success: true,
      url: file.url
    };
  } else {
    return ctx.body = {
      success: false,
      msg: '上传失败!'
    }
  }
});

// search
router.get('search', async (ctx, next) => {
  let searchQuery = ctx.request.query.searchQuery;
  let User = ctx.model('user');
  let Topic = ctx.model('topic');
  let user;
  let topics;
  try {
    user = await User.findOneQ({
      username: searchQuery
    });
    if (user) {
      return await ctx.redirect(`/user/${user.username}`)
    }
  } catch (e) {
    console.log(e.message)
  }

  try {
    let current_page = +ctx.query.page || 1;
    let Reply = ctx.model('reply');
    let result = await Topic.getTopicForPage({
      title: eval("/.*" + searchQuery + ".*/i")
    }, null, {
      sort: '-top -last_reply_at -create_time'
    }, current_page);
    topics = result.data;
    console.log(topics)
    if (topics) {
      topics = await Promise.all(topics.map(async (topic) => {
        topic.author = await User.findById(topic.author_id, 'username avatar');
        if (topic.last_reply) {
          topic.reply = await Reply.findById(topic.last_reply, 'author_id');
          topic.reply.author = await User.findById(topic.reply.author_id, 'username');
        }
        return topic;
      }));
      return await ctx.render('topics', {
        title: '话题列表',
        topics: topics,
        page: result.page
      })
    }
  } catch (e) {
    console.log(e.message);
  }

  if (!topics || !user) {
    return ctx.error('找不到该话题或作者，请重试!', {
      jump: '/'
    });
  }
});

module.exports = router;