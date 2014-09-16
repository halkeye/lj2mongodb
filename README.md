Livejournal to Mongodb
======================

Little hack to play around with nodejs, mongodb, and livejournal api.

Its realy messy but not really caring.

Config
------

Configuration is currently done using environmental variables (I use [direnv](http://direnv.net/))

* LIVEJOURNAL_USERNAME
* LIVEJOURNAL_PASSWORD

TODO
----

Pull in more info:

* comments
* security mapping
* properties
** moods (current_mood)
** pictures (picture_keyword)
** music (current_music)
** etc

Queries
-------

### Find all the properties

```javascript
db.<username>.mapReduce(
  function() { Object.keys(this.props).forEach(function(prop) { emit(prop, 1); }) },
  function(key, values) { return Array.sum(values); },
  { out: "properties" }
)
```

Thanks
------

* Challenge Response and Some other hints - https://github.com/ghewgill/ljdump/blob/master/ljdump.py
* Lastsync flow - http://www.livejournal.com/doc/server/ljp.csp.entry_downloading.html

License
-------

The MIT License (MIT)

Copyright (c) 2014 Gavin Mogan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
