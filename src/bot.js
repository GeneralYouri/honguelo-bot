#!/usr/bin/env node

var Discord = require('discord.js');
var logger = require('winston');
var schedule = require('node-schedule');
var auth = require('./auth.json');
var User = require("./user.js");
const MongoClient = require('mongodb').MongoClient;
const package = require('../package.json');
const roles = ["F2P", "Normal League", "Evil League", "Sadistic League", "Whales League"];
const roles_levels = [100, 2000, 4000, 4901, 5001];

const uri = auth.mongoConnectionString;
const mongo = new MongoClient(uri, {
    useNewUrlParser: true
});
var rolls;
mongo.connect(err => {
    rolls = mongo.db("user_data").collection("rolls");
});

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

const client = new Discord.Client();
token = auth.token;
client.login(token)

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', handleMessage);

var midnightPost = schedule.scheduleJob('0 0 0 * * *', function () {
    rolls.find({}, {
        projection: {
            _id: 0,
            username: 1,
            best_roll: 1
        }
    }).sort({
        best_roll: -1
    }).toArray((err, res) => {
        if (err) throw err;
        if (res === null || res.size === null) return;

        var msg = "```It is currently midnight.\n" +
            "The best roll so far is " + res[0].best_roll + " from " + res[0].username + ".\n";

        rolls.find({}, {
            projection: {
                _id: 0,
                username: 1,
                average: 1
            }
        }).sort({
            average: -1
        }).toArray((err, res) => {
            if (err) throw err;

            var tot = 10;
            if (res.length < tot)
                tot = res.length;
            msg += "The top " + tot + " averages are: ";

            for (var i = 0; i < tot; i++) {
                msg += "\n" + (i + 1) + " - " + res[i].username + ": " + res[i].average + "";
            }

            msg += "\n\nYou can now roll again.```";

            client.channels.cache.get('723818579845185536').send(msg);
        });
    });
});

function rollElo(user, evt) {
    console.log("Rolling for " + user.username);
    rolls.findOne({
        "userid": user.id
    }, (err, result) => {
        if (err) throw err;

        var userRes;
        if (!result) {
            userRes = new User(user.id, user.username);
        } else {
            userRes = result;
        }

        var reply;

        var midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        if (userRes.lastRoll >= midnight) {
            //if (userRes.lastRoll >= (new Date()).setSeconds(0, 0)) {
            var getout = client.emojis.cache.find(emoji => emoji.name === "getout");
            reply = `you already had your roll today. ${getout}`;
        } else {
            var rollres = roll();

            var reply = rollres.toString();
            if (userRes._id === null) {
                userrolls = [rollres];
                var insert = {
                    rolls: userrolls,
                    average: average(userrolls),
                    userid: user.id,
                    best_roll: rollres,
                    username: user.username,
                    lastRoll: new Date()
                };
                rolls.insertOne(insert, (err, res) => {
                    if (err) throw err;
                    console.log("saved one value")
                });
            } else {
                userRes.rolls.push(rollres);
                var query = {
                    _id: userRes._id
                };
                var bestroll = rollres > userRes.best_roll ? rollres : userRes.best_roll;
                var values = {
                    $push: {
                        rolls: rollres
                    },
                    $set: {
                        lastRoll: new Date(),
                        best_roll: bestroll,
                        average: average(userRes.rolls)
                    }
                };

                rolls.updateOne(query, values, (err, res) => {
                    if (err) throw err;
                    console.log("saved one value")
                });
            }

            //Deal with roles
            for (var i = 0; i < roles.length; i++) {
                var role = roles[i];
                var ro = evt.guild.roles.cache.find(r => r.name === role);
                if (evt.member.roles.cache.find(r => r.name === role));
                evt.member.roles.remove(ro.id);
            };

            var roleName = null;
            var i = 0;
            while (roleName === null) {
                if (rollres < roles_levels[i])
                    roleName = roles[i];
                i++;
            }
            var role = evt.guild.roles.cache.find(role => role.name === roleName);
            evt.member.roles.add(role);
        }

        evt.reply(reply);
    });
}

function roll() {
    var res = Math.round(Math.random() * 5000 + 1);

    return res;
}

function calcaverage(user, evt) {
    rolls.findOne({
        "userid": user.id
    }, (err, result) => {
        if (err) throw err;

        var userRes;
        if (!result) {
            userRes = new User(user.id, user.username);
        } else {
            userRes = result;
        }

        if (userRes.rolls.length === 0) {
            evt.reply("you have not rolled yet");
        } else {
            var avg = userRes.average;
            evt.reply("your average is " + avg.toString());
        }
    });
}

function average(data) {
    var avg = 0;

    if (data.length) {
        for (var i = 0; i < data.length; i++)
            avg += data[i];
        avg /= data.length;
    }

    //Round to 2 decimal places
    avg = Math.round(avg*100)/100

    return avg;
}

function lastRoll(user, evt) {
    rolls.findOne({
        "userid": user.id
    }, (err, result) => {
        if (err) throw err;

        if (!result) {
            evt.reply("you haven't rolled yet. Use the command =roll to start playing.");
            return;
        } else {
            evt.reply("your last roll was " + result.rolls[result.rolls.length - 1].toString());
        }

    });
}

function findtop(user, evt) {
    rolls.findOne({
        "userid": user.id
    }, (err, result) => {
        if (err) throw err;

        if (!result) {
            evt.reply("you haven't rolled yet. Use the command =roll to start playing.");
            return;
        } else {
            evt.reply("your top roll was " + Math.max(...result.rolls).toString());
        }

    });
}

function helpMessage() {
    return "```=Help: Shows all of HONGUELO's commands. Looking at that right now!\n" +
        "=Roll: Rolls for your ELO if you haven't done so today\n" +
        "=Practice: Do a practice roll\n" +
        "=Last: Shows your last roll\n" +
        "=Leagues: Displays the leagues, and how to get them\n" +
        "=Average: Shows your roll averages for the season so far\n" +
        "=Top: Displays your highest roll for the season so far\n" +
        "=Countdown: Displays time until next roll reset\n" +
        "=Best: Shows the best roll for the season and the best average for the season\n" +
        "=Rank: Shows your rank compared to everyone else's```";
}

function leaguesMessage() {
    return "```fix\n" +
        "Official ELO Leagues Requirements:```" +
        "1-99: F2P\n" +
        "100-1999: Normal\n" +
        "2000-3999: Evil\n" +
        "4000-4900: Sadistic\n" +
        "4901-5000: Whales";
}

function countdown() {
    var next = new Date();
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + 1);
    var diffInSec = Math.floor((next - new Date()) / (1000));
    var diffInMinutes = Math.floor(diffInSec / 60);
    var diffInHours = Math.floor(diffInMinutes / 60);
    return "next roll available in " + diffInHours + " hours, " + (diffInMinutes - diffInHours * 60) + " minutes, " + (diffInSec - diffInMinutes * 60) + " seconds."
}

function best(evt) {
    rolls.find({}, {
        projection: {
            _id: 0,
            username: 1,
            best_roll: 1
        }
    }).sort({
        best_roll: -1
    }).toArray((err, res1) => {
        if (err) throw err;
        if (res1 === null || res1.size === 0) {evt.reply("there have been no rolls this season so far"); return;}
        
        console.log(res1)
        var msg = "the best roll for this season is `" + res1[0].best_roll + "` from `" + res1[0].username + "`.\n"

        rolls.find({}, {
            projection: {
                _id: 0,
                username: 1,
                average: 1
            }
        }).sort({
            average: -1
        }).toArray((err, res2) => {
            if (err) throw err;
            
            msg += "The best average for this season is `" + res2[0].average.toFixed(2) + "` from `" + res2[0].username + "`.";

            evt.reply(msg);
        });
    });
}

function rank(evt) {
    rolls.find({}, {
        projection: {
            _id: 0,
            username: 1,
            average: 1,
            userid: 1
        }
    }).sort({
        average: -1
    }).toArray((err, res) => {
        if (err) throw err;

        var position = 0;
        while (position < res.length && res[position].userid != evt.author.id) {
            position++;
        }

        if (position === res.length)
            evt.reply("You have not rolled yet.");
        else {
            position++;
            var suffix = "th";
            if (position % 10 === 1 && position % 100 !== 11) suffix = 'st';
            if (position % 10 === 2 && position % 100 !== 12) suffix = 'nd';
            if (position % 10 === 3 && position % 100 !== 13) suffix = 'rd'; //tnx Youri because i'm lazy
            evt.reply("at the moment, you are ranked " + position + suffix + ".");
        }
    });
}

function handleMessage(evt) {
    message = evt.content;
    /* Break the comment in case of DUNAK
    evt.react(evt.guild.emojis.cache.find(emoji => emoji.name === "pog"))
    .then(console.log)
    .catch(console.error);*/
    if (message.substring(0, 1) == '=') {
        var args = message.toLowerCase().substring(1).split(' ');
        var cmd = args[0];
        args = args.splice(1);
        switch (cmd) {
            // =version
            case 'version':
                evt.reply(package.version);
                break;
                // =roll
            case 'roll':
                rollElo(evt.author, evt);
                break;
                // =practice
            case 'practice':
                evt.reply(roll());
                break;
                // =help
            case 'help':
                evt.reply(helpMessage());
                break;
                // =leagues
            case 'leagues':
                evt.reply(leaguesMessage());
                break;
                // =average
            case 'average':
                calcaverage(evt.author, evt);
                break;
                // =last
            case 'last':
                lastRoll(evt.author, evt);
                break;
                // =top
            case 'top':
                findtop(evt.author, evt);
                break;
                // =countdown
            case 'countdown':
                evt.reply(countdown());
                break;
                // =best
            case 'best':
                best(evt);
                break;
            case 'rank':
                rank(evt);
                break;
        }
    }
}
