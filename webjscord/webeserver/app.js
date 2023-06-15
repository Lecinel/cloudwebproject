const express = require('express')
  , multer = require('multer')
  , AWS = require('aws-sdk')
  , Sequelize = require('sequelize')
  , mime = require('mime')
  , http = require('http')
  , fs = require('fs')
  , app = express()
  , server = http.createServer(app)
  , s3 = new AWS.S3({ region: 'ap-northeast-1' })
  , sqs = new AWS.SQS({ region: 'ap-northeast-1' });

  const s3Bucket = 'lewebserver';
  const sqsQueueUrl = 'https://sqs.ap-northeast-2.amazonaws.com/649985784444/imgprocess';
  const rdsEndpoint = {
  host: 'lewebpro.ci61ayruhghx.ap-northeast-2.rds.amazonaws.com',
  port: 3306
};

// MySQL DB 이름, 계정, 암호
const sequelize = new Sequelize('photose', 'admin', '12345678', {
  host: rdsEndpoint.host,
  port: rdsEndpoint.port,
  dialect: 'mysql'
});

// MySQL DB 테이블 정의
const Photo = sequelize.define('Photo', {
  filename: { type: Sequelize.STRING, allowNull: false, unique: true }
});

// MySQL DB 테이블 생성
sequelize.sync();

app.use(multer({ dest: './uploads/' }));

app.get(['/', '/index.html'], function (req, res) {
  fs.readFile('./index.html', function (err, data) {
    res.contentType('text/html');
    res.send(data);
  });
});

// 이미지 목록 출력
app.get('/images', function (req, res) {
  Photo.findAll().success(function (photoes) {
    var data = [];
    photoes.map(function (photo) { return photo.values; }).forEach(function (e) {
      data.push(e.filename);
    });

    res.header('Cache-Control', 'max-age=0, s-maxage=0, public');
    res.send(data);
  });
});

// 웹 브라우저에서 이미지 받기
app.post('/images', function (req, res) {
  fs.readFile(req.files.images.path, function (err, data) {
    var filename = req.files.images.name;
    s3.putObject({
      Bucket: s3Bucket,
      Key: 'original/' + filename,
      Body: data,
      ContentType: mime.lookup(filename)
    }, function (err, data) {
      if (err)
        console.log(err, err.stack);
      else {
        console.log(data);
        
        sqs.sendMessage({
          MessageBody: filename,
          QueueUrl: sqsQueueUrl
        }, function (err, data) {
          if (err)
            console.log(err, err.stack);
          else
            console.log(data);
        });
      }
    });
  });

  res.send();
});

server.listen(80);



