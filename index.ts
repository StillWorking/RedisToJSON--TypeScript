import * as fs from "fs";
import redis from "redis";
const yargs = require('yargs')
import * as path from "path";
import _ from "lodash";

let options = yargs.usage('Import JSON onto Redis\nUsage: ' + path.basename(__filename) + ' <data.json>').options('u', {
    alias: 'url',
    describe: "connect to redis",
    default: 'redis://localhost:6379'
}).options('c', {
    alias: 'commands',
    boolean: true,
    describe: "Shows commands only",
    default: false
}).options('a', {
    alias: 'action',
    describe: "Whether to import or export",
    default: 'import'
}).check((argv) => {
    if (argv._.length === 0) throw 'No JSON file selected';
    let file = argv._[0];
    if (path.basename(file) === file) {
        file = path.join(__dirname, file);
    }
    try {
        fs.statSync(file);
    } catch (e) {
        if (e.error === -2) {
            throw 'Invalid JSON file';
        } else {
            throw e;
        }
    }
    let json = require(file);
    if (_.isEmpty(json)) {
        throw 'JSON file is empty!';
    } else if (!_.isObject(json)) {
        throw 'Not a JSON file';
    }
    argv._[0] = file;
    argv.json = json;
    if (argv.action !== 'import' && argv.action !== 'export') throw 'Please select import or export"';
    return true;
});

let argv = options.argv;
let json = argv.json;

const client = redis.createClient();

client.on("err", (e: string) => {
    console.error("error " + e);
    client.quit();
});

client.on('ready', () => {
    if (argv.action === 'import') {
        console.log('Reading JSON file ' + path.basename(argv._[0]));
        console.log('Found ' + json.length + ' db to import');
        console.log('------------------------------');

        let dbCounter = 0;
        _.each(json, (data: { [x: string]: any; }) => {
            _.each(_.keys(data), (key: string) => {
                let value = data[key];
                if (_.isEmpty(value)) {
                    return;
                }
                if (_.isArray(value)) {
                    _.each(value, (item: string) => {
                        if (argv.commands === false) {
                            client.lpush(key, item);
                        }
                        console.log('lpush "' + key + '" "' + item + '"');
                    });
                    /** Implemented assuming sorted set was utilized */
                } else if (_.isObject(value)) {
                    _.each(_.keys(value), (itemKey: string) => {
                        if (_.isString(value[itemKey])) {
                            let itemValue = value[itemKey];
                            if (argv.commands === false) {
                                client.hset(key, itemKey, itemValue);
                            }
                            console.log('hset "' + key + '" "' + itemKey + '" "' + itemValue + '"');

                        } else if (_.isNumber(value[itemKey])) {
                            let itemWeight = value[itemKey];
                            console.error('Not a sorted set');
                        } else if (_.isBoolean(value[itemKey])) {
                            if (argv.commands === false) {
                                client.sadd(key, itemKey);
                            }
                            console.log('sadd "' + key + '" "' + itemKey + '"');
                        } else {
                            console.error('Data type unknown: ' + value[itemKey]);
                        }
                    });
                } else if (_.isString(value)) {
                    if (argv.commands === false) {
                        client.set(key, value);
                    }
                    console.log('set "' + key + '" "' + value + '"');
                }
            });
            dbCounter++;
        });

        client.quit();
        console.log('------------------------------');
        console.log('JSON processed');
    } else {
        console.error('Export not done');
    }

    process.exit(0);
});