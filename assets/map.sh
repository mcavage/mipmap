#!/usr/bin/env node
// -*- mode: js -*-

var readline = require('readline');

var rl = readline.createInterface({
    input: process.stdin,
    output: {
        writable: true,
        write: function () { return (true); },
        end: function () {},
        destroy: function () {},
        destroySoon: function () {}
    }
});

rl.on('line', function (l) {
    try {
        var obj = JSON.parse(l);
        if (obj.remoteAddress)
            console.log(obj.remoteAddress);
    } catch (e) {}
});

rl.once('end', function () {
    process.exit(0);
});
