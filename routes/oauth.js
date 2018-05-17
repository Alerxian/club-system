const router = require('koa-router')();
const config = require('../config');
const validator = require('validator');
const Promise = require('promise');
const sign = require('../middlewares/sign');
const path = require('path');
const request = require('request');
const qs = require('querystring')


let githubConf = {
    client_id: '76cacf9c0362e785d774',
    client_secret: '34d5b9c8747a56b76921edce4981b94546f8d85e'
};

let token = ''

//处理第三方请求
router.get('/login', (ctx, next) => {
    ctx.redirect(`https://github.com/login/oauth/authorize?client_id=${githubConf.client_id}`);
    next();
});

//接收github返回的信息
router.get('/oauth', async (ctx, next) => {
    let userInfo = await getUserInfo(ctx.query.code);
    //将用户信息存入session并重定向会首页
    console.log(userInfo)
    // ctx.session.user = {
    //     username: userInfo.login,
    //     avatar: userInfo.avatar_url,
    //     userId: userInfo.id
    // };
    /*
    获取用户名去数据库中查找，若存在，则直接登录
    若不存在则跳转到注册页面，绑定注册
     */
    let user = await ctx.model('user').findOneQ({
        username: userInfo.login
    });
    if (user) {
        //若user存在
        //验证oauth中access_token是否有
        let oauth = await ctx.model('oauth').findOneQ({
            openid: userInfo.id
        });
        console.log(oauth);
        if (oauth) {
            ctx.session.user = ctx.state.current_user = user.toObject(); //存储session
            return ctx.redirect('/');
        }
    }else {
        //若用户不存在，则跳转到注册页面
    let user_info = {
        username: userInfo.login,
        email: userInfo.email,
        openid: userInfo.id,
        access_token: token,
        avatar_url: userInfo.avatar_url
    }; // 存储access_token
    return ctx.render('user/register', {
        title: 'github用户注册',
        user_info: user_info
    });
    // return ctx.redirect('/');
    } 
});


function getUserInfo(code) {
    return new Promise((resolve, reject) => {
        request.get({
            url: `https://github.com/login/oauth/access_token?client_id=${githubConf.client_id}&client_secret=${githubConf.client_secret}&code=${code}`,
        }, (err, res, body) => {
            token = qs.parse(body).access_token;
            resolve(token);
        })
    }).then((token) => {
        console.log(token);
        return new Promise((resolve, reject) => {
            request.get({
                url: `https://api.github.com/user?access_token=${token}`,
                headers: {
                    'User-Agent': 'Awesome-Octocat-App'
                }
            }, (err, res, body) => {
                resolve(JSON.parse(body));
            })
        })
    })
}


module.exports = router;