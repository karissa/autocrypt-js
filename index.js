var debug = require('debug')('autocrypt')
var path = require('path')
var level = require('level')

module.exports = Autocrypt

function Autocrypt (opts) {
  if (!(this instanceof Autocrypt)) return new Autocrypt(opts)
  if (!opts) opts = {}
  this.storage = opts.storage || defaultStorage(opts.dir)
}

/**
 * Process an incoming Autocrypt header and add it to the internal log.
 * @param  {Object}   header     The parsed 'Autocrypt' email header.
 * @param  {String}   fromEmail  The email the header was sent from.
 * @param  {Integer}   dateSent  Unix timestamp of date sent.
 * @param  {Function} cb         Callback function
 */
Autocrypt.prototype.processHeader = function (header, fromEmail, dateSent, cb) {
  var self = this
  debug('getting record for:', fromEmail)
  self.storage.get(fromEmail, function (err, record) {
    if (err && !err.notFound) return _done(err)
    if (record && (dateSent < record.last_seen_autocrypt)) return _done()
    debug('got record for:', fromEmail, record)

    var error
    if (header.addr !== fromEmail) error = new Error('Invalid Autocrypt Header: addr not the same as from email.')
    if (header.type !== '1') error = new Error('Invalid Autocrypt Header: the only supported type is 1.')
    if (error) {
      debug('got an error', error)
      return self.storage.put(fromEmail, {last_seen: dateSent, state: 'reset'}, _done)
    }

    var updatedRecord = {
      last_seen: dateSent,
      last_seen_autocrypt: dateSent,
      keydata: header.keydata,
      state: header['prefer-encrypt'] === 'mutual' ? 'mutual' : 'nopreference',
      fpr: header.fpr,
      type: '1'
    }

    debug('updating record:', fromEmail, updatedRecord)
    // when valid
    self.storage.put(fromEmail, updatedRecord, _done)

    function _done (err) {
      if (err) return cb(err)
      return cb(error)
    }
  })
}

function defaultStorage (dir) {
  return level(dir || path.join(__dirname, 'autocrypt-data'), {valueEncoding: 'json'})
}
