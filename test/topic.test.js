/**
 * 主题模块测试用例
 */
const should = require('should');
const support = require('./support/support');
const config = require('../config');

const request = support.request;
const shouldError = support.shouldError;

describe('Topic', () => {
  let user = {};
  let user2 = {};
  let cookie = '';
  let topic = {};
  let topic2 = {};

  before(async () => {
    user = await support.createAndSaveUser();
    user2 = await support.createAndSaveUser();
    cookie = support.getUserCookie(user);
    topic = support.createTopic();
    topic2 = await support.createAndSaveTopic(user);
  });


  after(async () => {
    await Promise.all([
      support.removeUser(user),
      support.removeUser(user2),
      support.removeTopic(topic),
      support.removeTopic(topic2)
    ]);
  });

  describe('Create Topic', () => {
    it('#show error when no login', async () => {
      return await Promise.all([
        notLogin('post', '/topic'),
        notLogin('get', '/topic/create')
      ]);
    });

    it('#show create topic page', (done) => {
      request
        .get('/topic/create')
        .set('Cookie', cookie)
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql('发表话题');
          done();
        })
    });

    it('#show error when no title or no content or no tag', (done) => {
      request
        .ajax('post', '/topic')
        .set('Cookie', cookie)
        .send({
          title: '',
          content: topic.content,
          tag: topic.tag  
        })
        .expect(200, shouldError('您请求的参数不完整！', done))
    });

    it('#create new topic', (done) => {
      request
        .ajax('post', '/topic')
        .set('Cookie', cookie)
        .send(topic)
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.body.status.should.equal(0);
          should.exist(res.body.topic_id);
          topic._id = res.body.topic_id;
          done();
        })
    });

    it('#show error for wrong topic_id', (done) => {
      request
        .get('/topic/12a0sdfasf12asdfasf12asdf')
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql('错误');
          res.text.should.containEql('您要查看的文章不存在或已删除！');
          done();
        })
    })
 
    it('#show new topic', (done) => {
      request
        .get('/topic/' + topic._id)
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql(topic.title);
          res.text.should.containEql(topic.content);
          // 显示作者其它主题
          res.text.should.containEql(topic2.title);
          // 显示作者主题数量
          res.text.should.containEql('<a href="/user/'+ user.username +'/topic">2</a>');
          // 显示作者积分
          res.text.should.containEql('积分：' + config.score.topic * 2);
          done();
        })
    });
  });

  describe('update topic', () => {
    it('#show error page when not author', (done) => {
      request
        .get('/topic/' + topic._id + '/edit')
        .set('Cookie', support.getUserCookie(user2))
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql('您没有权限编辑此话题！');
          done();
        })
    });
    it('#show update page when author', (done) => {
      request
        .get('/topic/' + topic._id + '/edit')
        .set('Cookie', cookie)
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql(topic.title);
          res.text.should.containEql(topic.content);
          done();
        })
    });

    it('#show update page when admin', (done) => {
      request
        .get('/topic/' + topic._id + '/edit')
        .set('Cookie', support.getUserCookie(user2, true))
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql(topic.title);
          res.text.should.containEql(topic.content);
          done();
        })
    });

    it('#update error when not author ', (done) => {
      request
        .ajax('post','/topic/' + topic._id + '/edit')
        .set('Cookie', support.getUserCookie(user2))
        .expect(200, shouldError('您没有权限编辑此话题！', done))
    });

    it('#should error when no title ', (done) => {
      request
        .ajax('post','/topic/' + topic._id + '/edit')
        .set('Cookie', cookie)
        .send({
          title: '',
          content: topic.content,
          tag: topic.tag  
        })
        .expect(200, shouldError('您请求的参数不完整！', done))
    })

    it('#update topic for author ', (done) => {
      request
        .ajax('post','/topic/' + topic._id + '/edit')
        .set('Cookie', cookie)
        .send({
          title: topic.title + 'update',
          content: topic.content,
          tag: topic.tag  
        })
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.body.status.should.equal(0);
          res.body.topic_id.should.equal(topic._id);
          topic.title = topic.title + 'update';
          done();
        })
    })

    it('#update topic for admin ', (done) => {
      request
        .ajax('post','/topic/' + topic._id + '/edit')
        .set('Cookie', support.getUserCookie(user2, true))
        .send({
          title: topic.title + 'admin',
          content: topic.content,
          tag: topic.tag  
        })
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.body.status.should.equal(0);
          res.body.topic_id.should.equal(topic._id);
          topic.title = topic.title + 'admin';
          done();
        })
    })
  });

  describe('topic of management', () => {
    it('#set top when not admin', (done) => {
      request
        .ajax('get','/topic/' + topic._id + '/top')
        .set('Cookie', cookie)
        .expect(200, shouldError('您不是管理员，无法执行该操作！', done));
    })

    it('#set top when admin', (done) => {
      request
        .ajax('get','/topic/' + topic._id + '/top')
        .set('Cookie', support.getUserCookie(user, true))
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.body.status.should.equal(0);
          done();
        });
    });

    it('#show the topic', (done) => {
      request
        .get('/topic/' + topic._id)
        .set('Cookie', cookie)
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql('<span class="small label label-primary interval-r">置顶</span>');
          done();
        })
    })

    it('#delete the topic when not admin', (done) => {
      request
        .ajax('get','/topic/' + topic._id + '/delete')
        .set('Cookie', cookie)
        .expect(200, shouldError('您不是管理员，无法执行该操作！', done));
    });

    it('#delete the topic when admin',(done) => {
      request
        .ajax('get','/topic/' + topic._id + '/delete')
        .set('Cookie', support.getUserCookie(user, true))
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.body.status.should.equal(0);
          done();
        });
    });

    it('#show deleted topic when user', (done) => {
      request
        .get('/topic/' + topic._id)
        .set('Cookie', cookie)
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql('错误');
          res.text.should.containEql('您要查看的文章不存在或已删除！');
          done();
        });
    });

    it('#show deleted topic when no login', (done) => {
      request
        .get('/topic/' + topic._id)
        .set('Cookie', '')
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql('错误');
          res.text.should.containEql('您要查看的文章不存在或已删除！');
          done();
        });
    });

    it('#show deleted topic when admin', (done) => {
      request
        .get('/topic/' + topic._id)
        .set('Cookie', support.getUserCookie(user, true))
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql(topic.title);
          done();
        });
    });
  });
})

function notLogin (method, url) {
  return new Promise((resolve, reject) => {
    request[method](url)
      .set('Cookie', '')
      .expect(200, (err, res) => {
        if(err) reject(err);
        res.text.should.containEql('您还未登录，请登录后重试！');
        resolve();
      });
  })
}