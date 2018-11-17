'use strict';
require('dotenv').config()  // since we don't have Glitch doing this for us

const express = require('express')
const bodyParser = require('body-parser')
const mongo = require('mongodb')
const mongoose = require('mongoose')
const cors = require('cors')
const dns = require('dns')
const { promisify } = require('util');

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

UrlSchema.pre('save', function(next) {
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

const lookupAsync = promisify(dns.lookup)

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }))

app.use("/public", express.static(process.cwd() + "/public"))


// Default error handler 
// from Wes Bos' talk https://www.youtube.com/watch?v=DwQJ_NPQWWo
const catchErrors = fn => (req, res, next) => fn(req, res, next).catch(next)

// Catch unhandled promise rejections
// from Wes Bos' talk https://www.youtube.com/watch?v=DwQJ_NPQWWo
process.on('unhandledRejection', error => {
  console.log('unhandledRejection', error)
})

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});


// Short URL creation
app.post("/api/shorturl/new", respondWithExisting, megaHandler, respondWithExisting)

function respondWithExisting(req, res, next) {
  const query = { original_url: req.body.url }
  Url.findOne(query)
    .then(data => {
      if (data)
        return res.json({ original_url: data.original_url, short_url: data.short_url })
      next()
    })
    .catch(next)
}

function megaHandler(req, res, next) {
  const { url: originalUrl } = req.body
  const query = { original_url: originalUrl }

  // Validate provided URL
  var url = require('url');
  var url_parsed = url.parse(originalUrl);

  // Check for valid protocol and that it has a hostname
  if (!['http:', 'https:'].includes(url_parsed.protocol)
    || !url_parsed.hostname) {
    return res.json({ "error": "invalid URL" });
  }

  // Try to resolve hostname
  lookupAsync(url_parsed.hostname)
    .then(() => {

      // Create new URL doc
      new Url(query).save()
        .catch(err => {
          // if (err.message.startsWith('E11000 duplicate key error')) {
          //   console.log("URL already in collection")
          // }
          // else
            next(err)
        })

        // Retrieve newly-added URL for response
        .then(Url.findOne(query))
        .then(data => {
          if (!data) return res.json({ error: "Couldn't retrieve URL" })
          return res.json({ original_url: data.original_url, short_url: data.short_url })
        })
        //.then(()=> next('route'))
        .catch(next)
    })
    //.then(next)

    // Handle resolution errors
    .catch(err => {
      if (err.message.startsWith('getaddrinfo ENOTFOUND')) {
        return res.json({ "error": "invalid Hostname" })
      }
      next(err)
    })
  //})
}


// Redirect from short URL to original
const redirectFromShortURL = async (req, res, next) => {
  const data = await Url.findOne({ short_url: req.params.short_url }, 'original_url')
  if (!data)
    return res.json({ error: "No short url found for given input" })
  return res.redirect(data.original_url)
};


// Redirect from short URL to original
app.get('/api/shorturl/:short_url', catchErrors(redirectFromShortURL))


app.listen(port, () => {
  console.log('Node.js listening ...');
});
