'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var autoIncrement = require('mongoose-auto-increment');

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


// Auto-increment based on examples here
// https://www.npmjs.com/package/mongoose-auto-increment
autoIncrement.initialize(db);
var Schema = mongoose.Schema;

// URL schema and model
var urlSchema = new Schema({
  original_url: {type: String, unique: true}
});
urlSchema.plugin(autoIncrement.plugin, 'Url');
var Url = mongoose.model('Url', urlSchema);


app.use(cors());

/** this project needs to parse POST bodies **/
app.use(bodyParser.urlencoded({extended: false}));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});


// Short URL creation
app.post("/api/shorturl/new", function (req, res, next) {
  var originalUrl = req.body.url;
  
  // Validate provided URL
  // TODO
  
  // Upsert URL
  var query = {"original_url": originalUrl};
  Url.findOneAndUpdate(query, query, {upsert: true}, function(err, data) {
    if (err) next(err);
    console.log(data);
  });
  
  var shortUrl = 1;
  res.json({"original_url": originalUrl, "short_url": shortUrl});
});


// Redirect from short URL to original
// TODO


app.listen(port, function () {
  console.log('Node.js listening ...');
});