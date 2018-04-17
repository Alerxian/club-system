/**
 * 用户模块测试用例
 */
const should = require('should');
const support = require('./support/support');


const request = support.request;
const shouldError = support.shouldError;


describe('User', () => {

  var user = support.createUser();
  user.home = 'http://k-dylan.github.io';
  user.github = 'https://github.com/k-dylan/';

  describe('register and login test user', () => {

    it('#register page', (done) => {
      request
        .get('/user/register')
        .set('Cookie', '')
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql('用户注册');
          done();
        })
    });

    it('#should error when no username or password or email', (done) => {
      request
        .ajax('post','/user/register')
        .send({
          username: user.username,
          password: '',
          email: user.email
        })
        .expect(200, shouldError('您请求的参数不完整!', done));
    })

    it('#should error when email was error', (done) => {
      request
        .ajax('post','/user/register')
        .send({
          username: user.username,
          password: user.password,
          email: 'asdfasf'
        })
        .expect(200, shouldError('email格式不正确，请检查后重试！', done));
    })

    it('#register', (done) => {
      request
        .ajax('post', '/user/register')
        .send(user)
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.body.status.should.equal(0);
          done();
        })
    });

    it('#repeat register', (done) => {
      request
        .ajax('post','/user/register')
        .send(user)
        .expect(200, shouldError('用户名已注册过啦！', done))
    })

    it('#repeat email', (done) => {
      request
        .ajax('post','/user/register')
        .send({
          username: 'testawelsdasdfv',
          password: '123123123',
          email: user.email
        })
        .expect(200, shouldError('此邮箱已经注册过啦！', done))
    })

    it('#login page', (done) => {
      request
        .get('/user/login')
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql('用户登录');
          done();
        });
    });

    it('#should error when wrong passord', (done) => {
      request
        .ajax('post','/user/login')
        .send({
          username: user.username,
          password: '123123'
        })
        .expect(200, shouldError('没有此用户或密码错误！', done))
    })

    it('#login', login(user));

    it('#user home index', (done) => {
      request
        .get('/user/' + user.username)
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql('基本信息');
          res.text.should.containEql('创建的话题');
          res.text.should.containEql('最近的回复');   
          done();       
        })
    });

    it('#user topic page', (done) => {
      request
        .get('/user/' + user.username + '/topic')
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql(user.username + ' 创建的话题');
          done();       
        })
    });

    it('#user reply page', (done) => {
      request
        .get('/user/' + user.username + '/reply')
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql(user.username + ' 最近的回复');
          done();       
        })
    });
  });


  describe('show admin login', () => {
    it('#check', (done) => {
      request
        .get('/')
        .set('Cookie', support.getUserCookie(user, true))
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql('(管理员)');
          done();
        })
    })
  })

  describe('show error when not login', () => {
    it('#request', async () => {
      let arr = [
        verifyNotLogin('get', '/user/setting'),
        verifyNotLogin('post', '/user'),
        verifyNotLogin('post', '/user/setpass')
      ]
      return await Promise.all(arr);
    })
  })


  describe('setting user', () => {
    it('#setting page', (done) => {
      request
        .get('/user/setting')
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql(user.email);
          done();
        })
    });

    it('#show error for error email', (done) => {
      let email = user.email;
      user.email = 'kdylanqq.com';
      request
        .ajax('post', '/user')
        .send(user)
        .expect(200, shouldError('email格式不正确，请检查后重试！', () => {
          user.email = email;
          done();
        }))
    })

    it('#setting signature', (done) => {
      user.signature = '个性签名,gexingqianming!';
      request
        .ajax('post','/user')
        .send(user)
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.body.status.should.equal(0);
          done();
        });
    })

    it('#verify signature', (done) => {
      request
        .get('/user/setting')
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.text.should.containEql(user.signature);
          done();
        })
    })
  })

  describe('setting user passord', () => {

    it('#show error when no oldpass or no newpass', (done) => {
      request
        .ajax('post','/user/setpass')
        .send({
          oldpass: '',
          newpass: '121asdf'
        })
        .expect(200, shouldError('请求参数不完整！', done))
    })

    it('#show error when the error oldpass', (done) => {
      request
        .ajax('post','/user/setpass')
        .send({
          oldpass: '123123',
          newpass: '121asdf'
        })
        .expect(200, shouldError('当前密码输入错误，请检查后重试！', done))
    });


    it('#setting password', (done) => {
      let newPass = support.createPass();
      request
        .ajax('post','/user/setpass')
        .send({
          oldpass: user.password,
          newpass: newPass
        })
        .expect(200, (err, res) => {
          should.not.exist(err);
          res.body.status.should.equal(0);
          user.password = newPass;
          done();
        });
    })

    it('#login for new password', login(user));

    it('#verify login', verify(user));

  })

  describe('delete test user', () => {
    it('#delete the user', async () => {
      let data = await support.removeUser(user);
      data.result.ok.should.equal(1);
    });
  });
});

function login(user) {
  return (done) => {
    request
      .ajax('post','/user/login')
      .send({
        username: user.username,
        password: user.password
      })
      .expect(200, (err, res) => {
        should.not.exist(err);
        res.body.status.should.equal(0);
        done();
      });
  }
}

function verify(user) {
  return (done) => {
    request
      .get('/')
      .expect(200, (err, res) => {
        should.not.exist(err);
        res.text.should.containEql(user.username);
        done();
      })
  }
}

function verifyNotLogin (method, url) {
  return new Promise((resolve, reject) => {
    request.ajax(method, url)
      .set('Cookie','')
      .expect(200, (err, res) => {
        if(err) reject(err);

        res.body.status.should.equal(1);
        res.body.message.should.equal('您还未登录，请登录后重试！');

        resolve();
      })
  });
}
