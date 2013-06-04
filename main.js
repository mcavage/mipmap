#!/usr/bin/env node
// -*- mode: js -*-
// Copyright (c) 2013, Mark Cavage. All rights reserved.

var fs = require('fs');
var path = require('path');

var assert = require('assert-plus');
var carrier = require('carrier');
var dashdash = require('dashdash');
var geoip = require('geoip');
var hogan = require('hogan.js');
var uuid = require('node-uuid');
var vasync = require('vasync');



///--- Globals

var CITIES = {
    type: 'FeatureCollection',
    cities: []
};
var COUNTRY_COUNT = {};
var DB = new geoip.City(path.join(__dirname, 'inc', 'GeoLiteCity.dat'));

var OPTIONS = [
    {
        names: ['help', '?'],
        type: 'bool',
        help: 'Print this help and exit.'
    },
    {
        names: ['height', 'h'],
        type: 'positiveInteger',
        help: 'Output height (pixels) of the generated SVG image',
        helpArg: 'HEIGHT',
        'default': 550
    },
    {
        names: ['number', 'n'],
        type: 'positiveInteger',
        help: 'Number of unique cities to keep (sorted)',
        helpArg: 'NUM_CITIES',
        'default': 100
    },
    {
        names: ['range', 'r'],
        type: 'positiveInteger',
        help: 'Maximum number of IP hits to account for in a country',
        'default': 10
    },
    {
        names: ['width', 'w'],
        type: 'positiveInteger',
        help: 'Output width (pixels) of the generated SVG image',
        helpArg: 'WIDTH',
        'default': 960
    }
];

var OUT_DIR = '/tmp/' + uuid.v1();
var OUT_DIR_DATA = OUT_DIR + '/data';
var OUT_DIR_DEPS = OUT_DIR + '/deps';
var OUT_MAP_FILE = OUT_DIR + '/index.html';

var MAP_TMPL = hogan.compile(fs.readFileSync(path.join(__dirname,
                                                       'inc',
                                                       'map.html'),
                                             'utf8'));



///--- Functions

function pad(n) {
    var n1 = n;
    if (n < 10) {
        n = '00' + n;
    } else if (n < 100) {
        n = '0' + n;
    } else {
        n = '' + n;
    }

    return (n);
}


function appendCity(ip, barrier) {
    var op = uuid.v1();
    barrier.start(op)
    DB.lookup(ip, function (err, data) {
        if (err) {
            console.error('mipmap: error (ip lookup): %s', err.toString());
            process.nextTick(barrier.done.bind(barrier, op));
            return;
        }

        if (!COUNTRY_COUNT[data.country_code])
            COUNTRY_COUNT[data.country_code] = 1;
        COUNTRY_COUNT[data.country_code]++;

        var city;
        if (CITIES.cities.some(function (c) {
            var match = false;
            if (c.properties.name === data.city) {
                city = c;
                match = true;
            }
            return (match);
        })) {
            city.properties.count++;
        } else {
            CITIES.cities.push({
                type: 'Feature',
                id: pad((CITIES.cities.length + 1)),
                geometry: {
                    type: 'Point',
                    coordinates: [
                        data.longitude,
                        data.latitude
                    ]
                },
                properties: {
                    count: 1,
                    country_code: data.country_code,
                    name: data.city
                }
            });
        }

        process.nextTick(barrier.done.bind(barrier, op));
    });
}


function copy(f, dir) {
    dir = dir || OUT_DIR_DATA;
    var out = fs.createWriteStream(dir + '/' + f);
    fs.createReadStream('./inc/' + f).pipe(out);
}


function copyDependencies(opts) {
    var dir = path.join(__dirname, 'deps');
    fs.readdir(dir, function (err, files) {
        assert.ifError(err);

        files.forEach(function (f) {
            var src = path.join(dir, f);
            var dst = path.join(OUT_DIR_DEPS, f);
            fs.createReadStream(src).pipe(fs.createWriteStream(dst));
        });
    });
}


function serialize(opts) {
    var cb = assert.ifError.bind(assert);
    var city_data = JSON.stringify(CITIES);
    var city_file = OUT_DIR_DATA + '/cities.json';
    var country_data = JSON.stringify(COUNTRY_COUNT);
    var country_file = OUT_DIR_DATA + '/country_count.json';
    var map_data = MAP_TMPL.render(opts);

    fs.writeFile(city_file, city_data, 'utf8', cb);
    fs.writeFile(country_file, country_data, 'utf8', cb);
    fs.writeFile(OUT_MAP_FILE, map_data, 'utf8', cb);
}


function usage(parser, msg) {
    if (msg)
        console.error('mipmap: error %s', msg);


    console.log('usage: mipmap [OPTIONS]\n' +
                'options:\n' +
                parser.help({includeEnv: true}).trimRight());

    process.exit(msg ? 1 : 0);
}




///--- Mainline

(function main() {
    var barrier = vasync.barrier();
    var finished = 0;
    var opts;
    var parser = dashdash.createParser({options: OPTIONS});

    try {
        opts = dashdash.parse({options: OPTIONS});
    } catch (e) {
        usage(parser, e.message);
    }

    if (opts.help)
        usage(parser);

    fs.mkdirSync(OUT_DIR);
    fs.mkdirSync(OUT_DIR_DATA);
    fs.mkdirSync(OUT_DIR_DEPS);
    copyDependencies();

    var reader = carrier.carry(process.stdin);
    reader.on('line',  function onIpAddress(line) {
        appendCity(line, barrier);
    });

    reader.once('end', function onStdinDone() {
        barrier.once('drain', function onGeoIpDone() {
            CITIES.cities.sort(function (a, b) {
                var ap = a.properties;
                var bp = b.properties;
                var rc = 0;
                if (ap.count < bp.count) {
                    rc = -1;
                } else if (ap.count > bp.count) {
                    rc = 1;
                }
                return (rc);
            });

            CITIES.cities.length = Math.min(CITIES.cities.length, opts.number);

            serialize(opts);
            console.log(OUT_DIR);
        });
    });

    process.stdin.resume();
})();
