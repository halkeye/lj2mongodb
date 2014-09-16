var mongodb = require('mongodb');
var moment = require('moment');
var crypto = require('crypto');
var async = require('async');
var LiveJournal = require('livejournal');
var EventEmitter = require("events").EventEmitter;
//var MD5 = require('MD5');
// Retrieve
var MongoClient = require('mongodb').MongoClient;

var MD5 = function(name) { return crypto.createHash('md5').update(name).digest("hex"); };
var _e = new EventEmitter();

var username = process.env.LIVEJOURNAL_USERNAME;
var password = process.env.LIVEJOURNAL_PASSWORD;

var calcChallenge = function(challenge) {
  return MD5(challenge+MD5(password))
}

var getSync = function(username, lastSync) {
  LiveJournal.RPC.getchallenge({}, function(err, value) {
    var options = {
      mode: 'syncitems',
      usejournal: username,
      ver: 1,
      lastsync: lastSync['L'] || '', // FIXME

      username: username,
      auth_method: "challenge",
      auth_challenge: value.challenge,
      auth_response: calcChallenge(value.challenge, password),
    };


    LiveJournal.RPC.syncitems(options, function(err, value) {
      console.log("Syncing for " + options.lastsync + ": " + value.count + " of " + value.total);
      value.syncitems.forEach(function(item) {
        var item_time = moment(item.time);

        var typeSplit = item.item.split('-');

        var type = typeSplit[0];
        var id = typeSplit[1];

        if (!lastSync[type] || item_time.isAfter(moment(lastSync[type]))) {
          lastSync[type] = item.time;
        }

        /* Fetch */
        if (type == 'L') {
          _e.emit('needEntrySync', { id: id, time: item.time, username: options.username });
        } else if (type == 'C') {
          _e.emit('needCommentSync', { id: id, time: item.time, username: options.username });
        } else {
          console.log("Not sure what to do about:", item);
        }
      });
      _e.emit('storeLastSync', options.username, lastSync);

      // when value.sync_count == sync_total we don't need to grab anymore
      if (value.count === value.total) {
        _e.emit('readyToSync', options.username);
      } else {
        getSync(options.username, lastSync);
      }
    });

  });
};

var grabEntries = function(username, lastsync) {
  LiveJournal.RPC.getchallenge({}, function(err, value) {
    var options = {
      usejournal: username,
      ver: 1,
      username: username,
      user: username,
      lastsync: lastsync,
      selecttype: 'syncitems',
      auth_method: "challenge",
      auth_challenge: value.challenge,
      auth_response: calcChallenge(value.challenge, password),
    };

    LiveJournal.RPC.getevents(options, function(err, value) {
      console.log("Downloading entries for " + options.lastsync + ": " + value.skip);
      _e.emit('storeEntries', username, value.events);
    });

  });
};


// Connect to the db
MongoClient.connect("mongodb://localhost:27017/livejournal", function(err, db) {
  if(err) { return console.dir(err); }
  var deleteLastSync;

  db.collection('lastSync', function(err, collection) {
    collection.findOne({_id: username}, function(err, lastSync) {
      lastSync = lastSync || {};
      getSync(username, lastSync.lastSync || {});
    });
    _e.on('storeLastSync', function(username, lastSync) {
      collection.update({_id: username}, {_id: username, lastSync: lastSync}, {w:1, upsert: true}, function(err, count, result) {
        if (err) { throw new Error(err); }
      });
    });
  });

  // FIXME - make this per username?
  db.collection('needEntrySync', function(err, collection) {
    deleteLastSync = function(username, id) {
      collection.remove({_id: Number(id)}, {w: 1}, function(err, numberOfRemovedDocs) {
        if (err) { throw new Error(err); }
      });
    };

    _e.on('needEntrySync', function(entry) {
      var id = entry.id;
      entry.timestamp = moment(entry.time).unix();
      delete entry.id;

      collection.update({_id: Number(id)}, {'$set': entry}, {w:1, upsert: true}, function(err, count, result) {
        if (err) { throw new Error(err); }
      });
    });

    _e.on('readyToSync', function(username) {
      // We are done grabbing updated items
      // So now grab all the actual items
      collection.findOne({}, { sort: {'timestamp': 1} }, function(err, results) {
        if (err) { throw new Error(err); }
        if (results === null) {
          _e.emit('doneSyncEntries', username);
          return;
        }

        var time = moment(results.time).subtract(1, 'second').format('YYYY-MM-DD HH:mm:ss');
        grabEntries(username, time);
      });
    });

    _e.on('storeEntries', function(username, entries) {
      db.collection(username, function(err, collection) {
        var saveEntry = function(entry, callback) {
          var find = {_id: Number(entry.itemid) };
          delete entry.itemid;
          // FIXME - process allowmask

          collection.update(find, {'$set': entry}, {w:1, upsert: true}, function(err, count, result) {
            if (err) { throw new Error(err); }
            deleteLastSync(username, find._id);
            callback();
          });
        };
        async.each(entries, saveEntry, function(err) {
          if (err) { throw new Error(err); }
          _e.emit('readyToSync', username);
        });
      });
    });

  });

});


_e.on('doneSyncEntries', function(username) {
  console.log('done syncing');
  process.exit();
});

_e.on('comment', function(entry) {
  console.log('comment', entry);
//  _e.emit('storeComment', entry);
});
