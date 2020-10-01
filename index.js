"use strict";
exports.__esModule = true;
var fs = require("fs");
var redis_1 = require("redis");
var yargs = require('yargs');
var path = require("path");
var lodash_1 = require("lodash");
var options = yargs.usage('Import a JSON file into redis.\nUsage: ' + path.basename(__filename) + ' <data.json>').options('u', {
    alias: 'redisurl',
    describe: "connect url for redis",
    "default": 'redis://localhost:6379'
}).options('d', {
    alias: 'dryrun',
    boolean: true,
    describe: "Do not actually import anything into redis, just show commands",
    "default": false
}).options('a', {
    alias: 'action',
    describe: "Whether to import or export",
    "default": 'import'
}).check(function (argv) {
    if (argv._.length === 0)
        throw 'No JSON file passed';
    var file = argv._[0];
    if (path.basename(file) === file) {
        file = path.join(__dirname, file);
    }
    try {
        fs.statSync(file);
    }
    catch (err) {
        if (err.errno === -2) {
            throw 'Invalid JSON file passed!';
        }
        else {
            throw err;
        }
    }
    var json = require(file);
    if (lodash_1["default"].isEmpty(json)) {
        throw 'JSON file is empty!';
    }
    else if (!lodash_1["default"].isObject(json)) {
        throw 'JSON file the wrong format!';
    }
    argv._[0] = file;
    argv.json = json;
    if (argv.action !== 'import' && argv.action !== 'export')
        throw 'Unknown Action! Must be "import" or "export"';
    return true;
});
var argv = options.argv;
var json = argv.json;
var client = redis_1["default"].createClient();
client.on("error", function (err) {
    console.error("Error " + err);
    client.quit();
});
client.on('ready', function () {
    if (argv.action === 'import') {
        console.log('Reading JSON file ' + path.basename(argv._[0]));
        console.log('Found ' + json.length + ' db to import');
        console.log('------------------------------');
        var dbCounter = 0;
        lodash_1["default"].each(json, function (data) {
            lodash_1["default"].each(lodash_1["default"].keys(data), function (key) {
                var value = data[key];
                if (lodash_1["default"].isEmpty(value)) {
                    // Skip empty key
                    return;
                }
                // Assume List
                if (lodash_1["default"].isArray(value)) {
                    lodash_1["default"].each(value, function (item) {
                        if (argv.dryrun === false) {
                            client.lpush(key, item);
                        }
                        console.log('lpush "' + key + '" "' + item + '"');
                    });
                    // Assume Hash, List or Sorted Set (NOT IMPLEMENTED)
                }
                else if (lodash_1["default"].isObject(value)) {
                    //     _.each(_.keys(value), function(item) {
                    //         console.log('sadd "' + key + '" "' + item + '"');
                    //     });
                    lodash_1["default"].each(lodash_1["default"].keys(value), function (itemKey) {
                        if (lodash_1["default"].isString(value[itemKey])) {
                            var itemValue = value[itemKey];
                            if (argv.dryrun === false) {
                                client.hset(key, itemKey, itemValue);
                            }
                            console.log('hset "' + key + '" "' + itemKey + '" "' + itemValue + '"');
                            // Assume this is a sorted set
                        }
                        else if (lodash_1["default"].isNumber(value[itemKey])) {
                            var itemWeight = value[itemKey];
                            // Should be trivial to implement sorted set, most likely
                            // client.zadd(key, itemKey, itemWeight);
                            console.error('SORTED SET NOT IMPLEMENTED');
                            // Assume this is a set
                        }
                        else if (lodash_1["default"].isBoolean(value[itemKey])) {
                            if (argv.dryrun === false) {
                                client.sadd(key, itemKey);
                            }
                            console.log('sadd "' + key + '" "' + itemKey + '"');
                        }
                        else {
                            console.error('UNKNOWN DATA TYPE: ' + value[itemKey]);
                        }
                    });
                    // Assume String
                }
                else if (lodash_1["default"].isString(value)) {
                    if (argv.dryrun === false) {
                        client.set(key, value);
                    }
                    console.log('set "' + key + '" "' + value + '"');
                }
            });
            dbCounter++;
        });
        client.quit();
        console.log('------------------------------');
        console.log('All JSON Data Processed!');
    }
    else {
        console.error('EXPORT ACTION NOT IMPLEMENTED!');
    }
    process.exit(0);
});
