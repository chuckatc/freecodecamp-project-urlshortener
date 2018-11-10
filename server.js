'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var mongo = require('mongodb');
var mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGOLAB_URI, {useMongoClient: true});

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function() {
  console.log('Notice: db connected!');
});



var Schema = mongoose.Schema;
var UrlSchema = new Schema({
  original_url: String
});
var Url = mongoose.model('Url', UrlSchema);


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
    //console.log(Url.nextCount());
  });
  
  var shortUrl = 1;
  res.json({"original_url": originalUrl, "short_url": shortUrl});
});


// Redirect from short URL to original
// TODO


app.listen(port, function () {
  console.log('Node.js listening ...');
});