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

// SQS 메시지 삭제
function deleteMessage(ReceiptHandle) {
  sqs.deleteMessage({
    QueueUrl: sqsQueueUrl,
    ReceiptHandle: ReceiptHandle
  }, function (err, data) {
    if (err)
      console.log(err, err.stack);
    else
      console.log(data);
  });
}

// MySQL에 데이터 저장
function insertPhoto(filename) {
  sequelize.sync().success(function () {
    Photo.create({
      filename: filename
    });
  });
}

// SQS 메시지 받기
function receiveMessage() {
  sqs.receiveMessage({
    QueueUrl: sqsQueueUrl,
    MaxNumberOfMessages: 1,
    VisibilityTimeout: 10,
    WaitTimeSeconds: 10
  }, function (err, data) {
    if (!err && data.Messages && data.Messages.length > 0)
      resizeImage(data.Messages[0]);
    else if (err)
      console.log(err, err.stack);
    receiveMessage();
  });
}

// 이미지 해상도 변환
function resizeImage(Message) {
  var filename = Message.Body;
  s3.getObject({
    Bucket: s3Bucket,
    Key: 'original/' + filename
  }, function (err, data) {
    im.resize({
      srcData: data.Body,
      width: 800
    }, function (err, stdout, stderr) {
      s3.putObject({
        Bucket: s3Bucket,
        Key: 'resized/' + filename,
        Body: new Buffer(stdout, 'binary'),
        ACL: 'public-read',
        ContentType: mime.lookup(filename)
      }, function (err, data) {
        console.log('Complete resize ' + filename);
        deleteMessage(Message.ReceiptHandle);
        insertPhoto(filename);
      });
    });
  });
}

receiveMessage();