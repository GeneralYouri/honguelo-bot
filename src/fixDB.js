#!/usr/bin/env node

var Discord = require('discord.js');
var logger = require('winston');
var schedule = require('node-schedule');
var User = require("./user.js");
const MongoClient = require('mongodb').MongoClient;
const package = require('../package.json');
const config = require('../config.json');
const roles = ["F2P", "Normal League", "Evil League", "Sadistic League", "Whales League"];
const roles_levels = [100, 2000, 4000, 4901, 5001];

const uri = config.auth.mongoConnectionString;
const mongo = new MongoClient(uri, {
    useNewUrlParser: true
});
var rolls;
mongo.connect(err => {
    rolls = mongo.db("user_data").collection("rolls");

    rolls.find({}, {
        projection: {
            _id: 1,
            username: 1,
            rolls: 1,
        }
    }).toArray((err, res) => {
        if(err) throw err;

        for(var i = 0; i < res.length; i++){
            var query = {
                _id: res[i]._id
            };

            var cleanRolls = [];
            for(var j = 0; j < res[i].rolls.length; j++){
                cleanRolls.push(parseInt(res[i].rolls[j]));
            }

            var bestroll = Math.max(...res[i].rolls);
            var values = {
                $set: {
                    rolls: cleanRolls,
                    best_roll: bestroll,
                    average: average(cleanRolls)
                }
            };

            rolls.updateOne(query, values, (err, res) => {
                if (err) throw err;
                console.log("saved one value")
            });
        }
    })
});

function average(data) {
    var avg = 0;
    var seasonLengt = 30;

    if (data.length) {
        for (var i = 0; i < data.length; i++)
            avg += data[i]/seasonLengt;
    }

    return avg;
}
