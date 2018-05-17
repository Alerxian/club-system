const router = require('koa-router')();
const validator = require('validator');
const sign = require('../middlewares/sign');

// 编辑回复页面
router.get('/:reply_id/edit', sign.isLogin, Verify, async (ctx, next) => {
  return await ctx.render('reply/edit', {
    title: '编辑回复',
    reply: ctx.reply
  });
});

//更新回复内容
router.post('/:reply_id/edit', sign.isLogin, Verify, async (ctx, next) => {
  let reply = ctx.reply;
  let content = ctx.request.body.content;

  if(!content) {
    return ctx.error('您请求的参数有误，请检查后重试！');
  }

  reply.content = content;
  reply.update_time = Date.now();

  try{
    await reply.saveQ();
    return ctx.redirect(`/topic/${reply.topic_id}#${reply._id}`)
  } catch(e) {
    return ctx.error('保存失败，请重试!');
  }
})

//删除回复
router.get('/:reply_id/delete', sign.isLogin, Verify, async (ctx, next) => {
  let reply = ctx.reply;
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
    if(user._id.toString() === reply.author_id.toString()) {
      //如果删除回复的是本人
      ctx.session.user = user.toObject();
    }
    return ctx.success('删除成功！');
  } catch(e) {
    console.log(e);
    return ctx.error('删除失败，请重试!');
  }
})

//点赞或取消
router.get('/:reply_id/putup', sign.isLogin, async (ctx, next) => {
  let reply_id = ctx.params.reply_id;
  let num = Number(ctx.query.num);//获取num；
  let User = ctx.model('user');
  let Reply = ctx.model('reply');
  let reply = await Reply.findById(reply_id);

  if(!reply) {
    return ctx.error('未找到此回复')
  }

  let user = ctx.state.current_user;
  let Like = ctx.model('like');
 
  let like = await Like.findOneQ({
    target_id: reply_id,
    user_id: user._id
  });
  if(like) {
     //若已存在，则取消点赞
     let mood = Number(like.mood);
    if(mood === num) {
      //双击取消
      await like.removeQ();
      if(num === 0) reply.like_count--;
      if(num === 1) reply.dislike_count--;
    }else{
      like.mood = num;
      await like.saveQ();
      //更新reply
      if(num === 0){
        reply.like_count++;
        reply.dislike_count--;
      } 
      if(num === 1){
        reply.dislike_count++;
        reply.like_count--;
      } 
    }
    await reply.saveQ();//保存更新
    console.log(reply)
    return ctx.success({
      num: num,
      is_cancel: true,
      like_count: reply.like_count,
      unlike_count: reply.dislike_count
    });
  }
  // 不存在则创建
  like = new Like({
    user_id: user._id,
    target_id: reply_id,
    mood: num,
  });
  let result = await like.saveQ();

  if(result) {
    //更新reply
    num === 0 ? reply.like_count++ : reply.dislike_count++;
    await reply.saveQ();
    return ctx.success({
      num: num,
      is_cancel: false,
      like_count: reply.like_count,
      unlike_count: reply.dislike_count
    });
  }else {
    return ctx.error('操作失败，请重试！');
  }
});

// 验证用户是否有权限进行此操作
async function Verify(ctx, next) {
  let reply_id = ctx.params.reply_id;
  if (!validator.isMongoId(reply_id)) {
    return ctx.error('您请求的参数有误，请重试！');
  }

  let Reply = ctx.model('reply');
  let reply = await Reply.findById(reply_id);
  if(!reply) {
    return ctx.error('未找到此回复!');
  }
  if(!(ctx.state.current_user.isAdmin || ctx.state.current_user._id.toString() === reply.author_id.toString())) {
    return ctx.error('您没有权限执行此操作！');
  }

  ctx.reply = reply;
  return next();

}

module.exports = router;