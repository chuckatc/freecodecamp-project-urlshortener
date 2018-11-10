'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var mongo = require('mongodb');
var mongoose = require('mongoose');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGOLAB_URI);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function() {
  console.log('Notice: db connected!');
});

var Schema = mongoose.Schema;
var UrlSchema = new Schema({
  original_url: {type: String, required: true},
  short_url: Number
});
var Person = mongoose.model('Person', personSchema);


app.use(cors());

/** this project needs to parse POST bodies **/
app.use(bodyParser.urlencoded({extended: false}));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

  
// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});


// Short URL creation
app.post("/api/shorturl/new", function (req, res) {
  var shortUrl = 1;
  res.json({"original_url": req.body.url, "short_url": shortUrl});
});


app.listen(port, function () {
  console.log('Node.js listening ...');
});