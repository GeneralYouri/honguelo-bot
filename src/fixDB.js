#!/usr/bin/env node

const Discord = require('discord.js');
const logger = require('winston');
const schedule = require('node-schedule');
const MongoClient = require('mongodb').MongoClient;
const package = require('../package.json');
const config = require('../config.json');
const User = require('./user.js');
const roles = ['F2P', 'Normal League', 'Evil League', 'Sadistic League', 'Whales League'];
const roles_levels = [100, 2000, 4000, 4901, 5001];

const uri = config.auth.mongoConnectionString;
const mongo = new MongoClient(uri, {
    useNewUrlParser: true,
});

let rolls;
mongo.connect(err => {
    rolls = mongo.db('user_data').collection('rolls');

    rolls.find({}, {
        projection: {
            _id: 1,
            username: 1,
            rolls: 1,
        }
    }).toArray((err, res) => {
        if(err) throw err;

        for(let i = 0; i < res.length; i++){
            const query = {
                _id: res[i]._id,
            };

            const cleanRolls = [];
            for(let j = 0; j < res[i].rolls.length; j++){
                cleanRolls.push(parseInt(res[i].rolls[j]));
            }

            const bestroll = Math.max(...res[i].rolls);
            const values = {
                $set: {
                    rolls: cleanRolls,
                    best_roll: bestroll,
                    average: average(cleanRolls),
                }
            };

            rolls.updateOne(query, values, (err, res) => {
                if (err) throw err;
                console.log('saved one value');
            });
        }
    })
});

function average(data) {
    let avg = 0;
    const seasonLength = 30;

    if (data.length) {
        for (let i = 0; i < data.length; i++)
            avg += data[i] / seasonLength;
    }

    return avg;
}
