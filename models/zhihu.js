/**
 * 爬取cnodejs网站的数据
 */

const mongoose = require('mongoose');
const Topic = require('./topic');
const url = require('url');
const superagent = require('superagent');
const cheerio = require('cheerio');
const eventproxy = require('eventproxy');
const cnodeUrl = 'https://cnodejs.org/?tab=good&page=3';

module.exports = (ctx, next) => {
  superagent.get(cnodeUrl)
    .end(function(err, res) {
      if (err) {
        return console.error(err);
      }
      var topicUrls = [];
      var $ = cheerio.load(res.text);
      $('#topic_list .topic_title').each(function(idx, element) {
        var $element = $(element);
        var href = url.resolve(cnodeUrl, $element.attr('href'));
        topicUrls.push(href);
      });

      var ep = new eventproxy();

      ep.after('topic_html', topicUrls.length, function(topics) {
        topics = topics.map(function(topicPair) {
          var topicUrl = topicPair[0];
          var topicHtml = topicPair[1];
          var $ = cheerio.load(topicHtml);
          var comments = get_comment($);
          return ({
            title: $('.topic_full_title').text().trim(),
            href: topicUrl,
            top: $('.put_top').text() ? true : false,
            content: $('.topic_content .markdown-text').html(),
            author: $('.user_name').text().trim(),
            comments: comments,
          });
        });
        console.log('final:');

        topics.forEach(async (topic, i) => {
          let title = topic.title;
          let tag = '提问';
          let content = topic.content;
          let top = topic.top;
          let author_name = 'admin';
          let comments = topic.comments
          let User = ctx.model('user');
          let Topic = ctx.model('topic');

          let user = await User.findOneQ({
            username: author_name
          });
          if (!user) {
            return ctx.error('找不到该用户')
          }

          let _topic = await new Topic({
            title: title,
            tag: tag,
            content: content,
            top: top,
            author_id: user._id,
            reply_count: comments.length,
            good: cnodeUrl.indexOf('good') > -1 ? true : false
          });
          let result = await _topic.saveQ();
          if (!result) {
            console.log('保存出错！');
          }


          let Reply = ctx.model('reply');
          let reply_user;
          let user_avatar_url;
          let comment_text;
          for (let i = 0, len = comments.length; i < len; i++) {
            reply_user = comments[i].reply_user;
            user_avatar_url = comments[i].user_avatar_url;
            comment_text = comments[i].comment_text;

            user = await User.findOneQ({
              username: reply_user
            });
            if (!user) {
              user = new User({
                username: reply_user,
                password: '123456',
                email: reply_user + '@club.com',
                avatar: user_avatar_url
              });
              result = await user.saveQ();
              if (!result) {
                throw new Error('用户名创建失败!');
              }
            }
            let reply = new Reply({
              topic_id: _topic._id,
              author_id: user._id,
              content: comment_text
            });
            result = await reply.saveQ();
            if (!result) {
              throw new Error('评论创建失败')
            }
          }

        })
      });

      function get_comment($) {
        var comments = [];
        $('.reply_area.reply_item').each(function(i, item) {
          if (i >= 40) return;
          try {
            var $item = $(item);
            var comment_text = $item.find('.reply_content .markdown-text').html();
            var reply_user = $item.find('.reply_author').text().trim();
            var reply_last_at = $item.find('.reply_time').text().trim();
            var user_avatar_url = $item.find('.user_avatar').find('img').attr('src');
            comments.push({
              comment_text: comment_text,
              reply_user: reply_user,
              reply_last_at: reply_last_at,
              user_avatar_url: user_avatar_url
            });
          } catch (e) {}

        });
        return comments;
      }

      topicUrls.forEach(function(topicUrl) {
        superagent.get(topicUrl)
          .end(function(err, res) {
            ep.emit('topic_html', [topicUrl, res.text]);
          });
      });
    });
}