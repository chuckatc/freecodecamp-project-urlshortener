'use strict';
require('dotenv').config()  // since we don't have Glitch doing this for us

const express = require('express')
const bodyParser = require('body-parser')
const mongo = require('mongodb')
const mongoose = require('mongoose')
const cors = require('cors')
const dns = require('dns')

const app = express()

// Basic Configuration 
const port = process.env.PORT || 3000

// Connect to database
mongoose.connect(process.env.MONGOLAB_URI, { useMongoClient: true })
const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', function () {
  console.log('Notice: db connected!')
})

const Schema = mongoose.Schema

// Reference: Based on auto-increment counter from
// https://stackoverflow.com/questions/28357965/mongoose-auto-increment#30164636
const CounterSchema = Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
})
const Counter = mongoose.model('Counter', CounterSchema)

const UrlSchema = new Schema({
  original_url: { type: String, unique: true },
  short_url: Number
})

UrlSchema.pre('save', next => {
  const doc = this;
  // Use option upsert to create when non-existent and new to return seq value when created
  Counter.findByIdAndUpdate({ _id: 'urlId' }, { $inc: { seq: 1 } }, { upsert: true, new: true })
    .then(counter => {
      doc.short_url = counter.seq
      next()
    })
    .catch(next)
});

const Url = mongoose.model('Url', UrlSchema)


app.use(cors());

/** this project needs to parse POST bodies **/
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});


// Short URL creation
app.post("/api/shorturl/new", function (req, res, next) {
  var originalUrl = req.body.url;
  var query = { original_url: originalUrl };

  // If URL has already been created, return it
  Url.findOne(query, function (err, data) {
    if (err) next(err);
    if (data) {
      return res.json({ original_url: data.original_url, short_url: data.short_url });
    }

    // Validate provided URL
    var url = require('url');
    var url_parsed = url.parse(originalUrl);

    // Check for valid protocol and that it has a hostname
    if (!['http:', 'https:'].includes(url_parsed.protocol)
      || !url_parsed.hostname) {
      res.json({ "error": "invalid URL" });
    } else {

      // Check hostname resolves
      dns.lookup(url_parsed.hostname, function (err, addresses) {
        if (err) {
          if (err.message.startsWith('getaddrinfo ENOTFOUND')) {
            res.json({ error: "invalid Hostname" });
          } else {
            next(err);
          }
        } else {

          // Create new URL doc
          var url = new Url({ original_url: originalUrl });
          url.save(function (err, data) {
            if (err) {
              if (err.message.startsWith('E11000 duplicate key error')) {
                console.log("URL already in collection");
              } else {
                return next(err);
              }
            }

            // Retrieve newly-added URL for response
            Url.findOne(query)
              .then(data => {
                if (!data) return res.json({ error: "Couldn't retrieve URL" })
                res.json({ original_url: data.original_url, short_url: data.short_url })
              })
              .catch(next)
          });
        }
      });
    }
  });
});


// Redirect from short URL to original
app.get('/api/shorturl/:short_url', (req, res, next) => {
  Url.findOne({ short_url: req.params.short_url }, 'original_url')
    .then(data => {
      if (!data) return res.json({ error: "No short url found for given input" })
      return res.redirect(data.original_url)
    })
    .catch(next)
});


app.listen(port, () => {
  console.log('Node.js listening ...');
});
