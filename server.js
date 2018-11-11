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
mongoose.connect(process.env.MONGOLAB_URI, {useMongoClient: true});

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function() {
  console.log('Notice: db connected!');
});


var Schema = mongoose.Schema;

// Reference: Based on auto-increment counter from
// https://stackoverflow.com/questions/28357965/mongoose-auto-increment#30164636
var CounterSchema = Schema({
    _id: {type: String, required: true},
    seq: { type: Number, default: 0 }
});
var Counter = mongoose.model('Counter', CounterSchema);

var UrlSchema = new Schema({
  original_url: {type: String, unique: true},
  short_url: Number
});

UrlSchema.pre('save', function(next) {
    var doc = this;
    // Use option upsert to create when non-existent and new to return seq value when created
    Counter.findByIdAndUpdate({_id: 'urlId'}, {$inc: { seq: 1} }, {upsert: true, new: true}, function(error, counter)   {
        if(error)
            return next(error);
        doc.short_url = counter.seq;
        next();
    });
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
  var query = {original_url: originalUrl};
  
  // If URL has already been created, return it
  Url.findOne(query, function(err, data) {
    if (err) next(err);
    if (data) {
      res.json({original_url: data.original_url, short_url: data.short_url});
    } else {
  
      // Validate provided URL
      // TODO

      // Create new URL doc
      var url = new Url({original_url: originalUrl});
      url.save(function(err, data) {
        if (err) {
          if (err.message.startsWith('E11000 duplicate key error')) {
            console.log("URL already in collection");
          } else {
            console.log(err);
            return next(err);
          }
        }

        // Retrieve newly-added URL for response
        Url.findOne(query, function(err, data) {
          if (err) next(err);
          if (data) {
            res.json({original_url: data.original_url, short_url: data.short_url});
          }
        });       
      });
    }
  });
});


// Redirect from short URL to original
// TODO


app.listen(port, function () {
  console.log('Node.js listening ...');
});