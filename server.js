'use strict'
require('dotenv').config() // since we don't have Glitch doing this for us

const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const cors = require('cors')
const dns = require('dns')
const { promisify } = require('util')
const url = require('url')

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

UrlSchema.pre('save', function (next) {
  const doc = this
  // Use option upsert to create when non-existent and new to return seq value when created
  Counter.findByIdAndUpdate({ _id: 'urlId' }, { $inc: { seq: 1 } }, { upsert: true, new: true })
    .then(counter => {
      doc.short_url = counter.seq
      next()
    })
    .catch(next)
})

const Url = mongoose.model('Url', UrlSchema)

const lookupAsync = promisify(dns.lookup)

app.use(cors())

app.use(bodyParser.urlencoded({ extended: false }))

app.use('/public', express.static(process.cwd() + '/public'))

// Default error handler for express handlers
// Wes Bos: https://www.youtube.com/watch?v=DwQJ_NPQWWo
const catchErrors = fn => (req, res, next) => fn(req, res, next).catch(next)

// Catch unhandled promise rejections
// Wes Bos: https://www.youtube.com/watch?v=DwQJ_NPQWWo
process.on('unhandledRejection', error => {
  console.log('unhandledRejection', error)
})

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html')
})

// Respond with existing short and long URL if long is found
const respondWithExisting = async (req, res, next) => {
  const query = { original_url: req.body.url }
  const data = await Url.findOne(query)
  if (data) {
    return res.json({
      original_url: data.original_url,
      short_url: data.short_url
    })
  }
  next()
}

const validateUrl = async (req, res, next) => {
  // Validate provided URL
  const urlParsed = url.parse(req.body.url)

  // Check for valid protocol and that it has a hostname
  if (!['http:', 'https:'].includes(urlParsed.protocol) ||
    !urlParsed.hostname) {
    return res.json({ 'error': 'invalid URL' })
  }

  // Check hostname can be resolved
  try {
    await lookupAsync(urlParsed.hostname)
  } catch (err) {
    if (err.message.startsWith('getaddrinfo ENOTFOUND')) {
      return res.json({ error: 'invalid Hostname' })
    }
    next(err)
  }

  next()
}

// Add long URL to database
const addUrl = async (req, res, next) => {
  const query = { original_url: req.body.url }

  // Create new URL doc
  await new Url(query)
    .save()

  next()
}

// Redirect from short URL to original
const redirectFromShortURL = async (req, res, next) => {
  const data = await Url.findOne(
    { short_url: req.params.short_url },
    'original_url'
  )
  if (!data) {
    return res.json({ error: 'No short url found for given input' })
  }
  return res.redirect(data.original_url)
}

// Short URL creation
app.post(
  '/api/shorturl/new',
  catchErrors(respondWithExisting),
  catchErrors(validateUrl),
  catchErrors(addUrl),
  catchErrors(respondWithExisting)
)

// Redirect from short URL to original
app.get('/api/shorturl/:short_url', catchErrors(redirectFromShortURL))

app.listen(port, () => {
  console.log('Node.js listening ...')
})
