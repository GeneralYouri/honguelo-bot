#!/usr/bin/env node

const logger = require('winston');
const schedule = require('node-schedule');
const package = require('../package.json');
const userRepo = require('./userRepo.js');
const discordHandler = require('./discordHandler');
const rollHandler = require('./rollHandler.js');

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true,
});
logger.level = 'debug';

discordHandler.setHandler(handleMessage);

const midnightPost = schedule.scheduleJob('0 0 0 * * *', async function () {
    const rollsByBest = await userRepo.findAllOrderByBestRoll();
    if (rollsByBest === null) return;

    let msg = '```It is currently midnight.\n' + 'The best roll so far is ' + rollsByBest[0].best_roll + ' from ' + rollsByBest[0].username + '.\n';

    let rollsByAvg = await userRepo.findAllOrderByAvg();
    if (rollsByAvg === null) return;

    let tot = 100;
    if (rollsByAvg.length < tot)
        tot = rollsByAvg.length;
    msg += 'The top ' + tot + ' scores are: ';

    for (let i = 0; i < tot; i++) {
        let avg = rollsByAvg[i].average;
        // Round to 2 decimal places
        avg = Math.round(avg * 100) / 100;
        msg += '\n' + (i + 1) + ' - ' + rollsByAvg[i].username + ': ' + avg + '';
    }

    msg += '\n\nYou can now roll again.```';
    msg += '\n<@&' + await discordHandler.getRole(null, 'Addicted').id + '> Ping.';
    discordHandler.sendMessageToChannel(config.leaderboardChannelID, msg);
});

async function getaverage(userid) {
    const userRes = await userRepo.findUserById(userid);

    if (!userRes || userRes.rolls.length === 0) {
        return 'you have not rolled yet.';
    } else {
        let avg = userRes.average;
        //Round to 2 decimal places
        avg = Math.round(avg * 100) / 100;
        return 'your score is ' + avg.toString();
    }
}

async function lastRoll(userid) {
    const result = await userRepo.findUserById(userid);
    if (!result) {
        return 'you haven\'t rolled yet. Use the command =roll to start playing.';
    } else {
        return 'your last roll was ' + result.rolls[result.rolls.length - 1].toString();
    }
}

async function findtop(userid) {
    const result = await userRepo.findUserById(userid);
    if (!result) {
        return 'you haven\'t rolled yet. Use the command =roll to start playing.';
    } else {
        return 'your top roll was ' + Math.max(...result.rolls).toString();
    }
}

async function findBot(userid) {
    const result = await userRepo.findUserById(userid);
    if (!result) {
        return 'you haven\'t rolled yet. Use the command =roll to start playing.';
    } else {
        return 'your bot roll was ' + Math.min(...result.rolls).toString();
    }
}

function helpMessage() {
    return '```=Help: Shows all of HONGUELO\'s commands. Looking at that right now!\n' +
        '=Roll: Rolls for your ELO if you haven\'t done so today\n' +
        '=Practice: Do a practice roll\n' +
        '=Last: Shows your last roll\n' +
        '=Leagues: Displays the leagues, and how to get them\n' +
        '=Score: Shows your score for the season so far\n' +
        '=Top: Displays your highest roll for the season so far\n' +
        '=Bot: Displays your lowest roll for the season so far\n' +
        '=Countdown: Displays time until your next roll\n' +
        '=Best: Shows the best roll for the season and the best score for the season\n' +
        '=Rank: Shows your rank compared to everyone else\'s\n' +
        '=Counter: Shows the number of rolls you made```';
}

function leaguesMessage() {
    return '```fix\n' +
        'Official ELO Leagues Requirements:```' +
        '1-99: F2P\n' +
        '100-1999: Normal\n' +
        '2000-3999: Evil\n' +
        '4000-4900: Sadistic\n' +
        '4901-5000: Whales';
}

async function countdown(userid) {
    const result = await userRepo.findUserById(userid);
    if (result != null && !rollHandler.userCanRoll(result)) {
        const next = new Date();
        next.setHours(0, 0, 0, 0);
        next.setDate(next.getDate() + 1);
        const diffInSec = Math.floor((next - new Date()) / (1000));
        const diffInMinutes = Math.floor(diffInSec / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);
        return 'next roll available in ' + diffInHours + ' hours, ' + (diffInMinutes - diffInHours * 60) + ' minutes, ' + (diffInSec - diffInMinutes * 60) + ' seconds.';
    } else {
        return 'you can roll now.';
    }
}

async function best() {
    const bestRolls = await userRepo.findAllOrderByBestRoll();

    if (bestRolls === null || bestRolls.length === 0) {
        return 'there have been no rolls this season so far';
    }

    let msg = 'the best roll for this season is `' + bestRolls[0].best_roll + '` from `' + bestRolls[0].username + '`.\n';

    const bestAvg = await userRepo.findAllOrderByAvg();

    msg += 'The best score for this season is `' + bestAvg[0].average.toFixed(2) + '` from `' + bestAvg[0].username + '`.';

    return msg;
}

async function rank(userid) {
    const bestAvg = await userRepo.findAllOrderByAvg();

    let position = 0;
    while (position < bestAvg.length && bestAvg[position].userid !== userid) {
        position++;
    }

    if (position === bestAvg.length)
        return 'You have not rolled yet.';
    else {
        position++;
        let suffix = 'th';
        if (position % 10 === 1 && position % 100 !== 11) suffix = 'st';
        if (position % 10 === 2 && position % 100 !== 12) suffix = 'nd';
        if (position % 10 === 3 && position % 100 !== 13) suffix = 'rd'; //tnx Youri because i'm lazy
        return 'at the moment, you are ranked ' + position + suffix + '.';
    }
}

async function counter(userid) {
    const user = await userRepo.findUserById(userid);
    let msg;
    if (user === null || user.rolls.length === 0) {
        msg = 'you have not rolled yet';
    } else {
        msg = 'you rolled ' + user.rolls.length + ' times.'
    }

    return msg;
}

async function handleMessage(evt) {
    const message = evt.content;
    /* Break the comment in case of DUNAK
    evt.react(evt.guild.emojis.cache.find(emoji => emoji.name === 'pog'))
    .then(console.log)
    .catch(console.error);*/

    if (message.substring(0, 1) === '=') {
        let args = message.toLowerCase().substring(1).split(' ');
        const cmd = args[0];
        args = args.splice(1);
        switch (cmd) {
            case 'version':
                evt.reply(package.version);
                break;
            case 'roll':
                rollHandler.evtRoll(evt);
                break;
            case 'practice':
                evt.reply(rollHandler.roll());
                break;
            case 'help':
                evt.reply(helpMessage());
                break;
            case 'leagues':
            case 'league':
                evt.reply(leaguesMessage());
                break;
            case 'score':
                evt.reply(await getaverage(evt.author.id));
                break;
            case 'last':
                evt.reply(await lastRoll(evt.author.id));
                break;
            case 'top':
                evt.reply(await findtop(evt.author.id));
                break;
            case 'countdown':
            case 'time':
                evt.reply(await countdown(evt.author.id));
                break;
            case 'best':
                evt.reply(await best());
                break;
            case 'rank':
                evt.reply(await rank(evt.author.id));
                break;
            case 'counter':
            case 'count':
                evt.reply(await counter(evt.author.id));
                break;
            case 'bot':
                evt.reply(await findBot(evt.author.id));
                break;
        }
    }
}
