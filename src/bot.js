#!/usr/bin/env node

const logger = require('winston');
const schedule = require('node-schedule');
const package = require('../package.json');
const config = require('../config.json');
const eloRoles = require('./eloRoles.json');
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

    const lines = [
        '```',
        'It is currently midnight.',
        `The best roll so far is ${rollsByBest[0].best_roll} from ${rollsByBest[0].username}.`,
        '',
    ];

    let rollsByAvg = await userRepo.findAllOrderByAvg();
    if (rollsByAvg === null) return;

    const n = Math.min(rollsByAvg.length, 100);
    lines.push(`The top ${n} scores are:`);

    for (let i = 0; i < n; i++) {
        let avg = rollsByAvg[i].average;
        lines.push(`${i + 1} - ${rollsByAvg[i].username}: ${avg.toFixed(2)}`);
    }

    lines.push(
        '',
        'You can now roll again',
        '```',
        `<@&${await discordHandler.getRole(null, 'Addicted').id}> Ping`,
    );
    const msg = lines.join('\n');
    discordHandler.sendMessageToChannel(config.leaderboardChannelID, msg);
});

const noRollsMessage = 'you haven\'t rolled yet. Use the command `=roll` to start playing.';

async function getAverage(userid) {
    const user = await userRepo.findUserById(userid);

    if (!user || user.rolls.length === 0) {
        return noRollsMessage;
    } else {
        let avg = user.average;
        return `your score is ${avg.toFixed(2)}`;
    }
}

async function lastRoll(userid) {
    const user = await userRepo.findUserById(userid);
    if (!user) {
        return noRollsMessage;
    } else {
        return `your last roll was ${user.rolls[user.rolls.length - 1]}`;
    }
}

async function findTop(userid) {
    const user = await userRepo.findUserById(userid);
    if (!user) {
        return noRollsMessage;
    } else {
        return `your top roll was ${Math.max(...user.rolls)}`;
    }
}

async function findBot(userid) {
    const user = await userRepo.findUserById(userid);
    if (!user) {
        return noRollsMessage;
    } else {
        return `your bot roll was ${Math.min(...user.rolls)}`;
    }
}

// TODO: Make this dynamically generate by reading other commands, instead of being hardcoded
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
    const parsedRoles = eloRoles.slice(1).map((role, index) => `${eloRoles[index].topBound}-${role.topBound - 1}: ${role.name}`);
    return `\`\`\`fix\nOfficial ELO Leagues Requirements:\`\`\`${parsedRoles.join('\n')}`;
}

async function countdown(userid) {
    const result = await userRepo.findUserById(userid);
    if (result != null && !rollHandler.canUserRoll(result)) {
        const next = new Date();
        next.setHours(0, 0, 0, 0);
        next.setDate(next.getDate() + 1);
        const diffInSec = Math.floor((next - new Date()) / (1000));
        const diffInMinutes = Math.floor(diffInSec / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);
        return `next roll available in ${diffInHours} hours, ${diffInMinutes - diffInHours * 60} minutes, ${diffInSec - diffInMinutes * 60} seconds.`;
    } else {
        return 'you can roll now.';
    }
}

async function best() {
    const bestRolls = await userRepo.findAllOrderByBestRoll();
    if (bestRolls === null || bestRolls.length === 0) {
        return 'there have been no rolls this season so far';
    }

    const bestAvg = await userRepo.findAllOrderByAvg();
    const lines = [
        `the best roll for this season is \`${bestRolls[0].best_roll}\` from \`${bestRolls[0].username}\`.`,
        `The best score for this season is \`${bestAvg[0].average.toFixed(2)}\` from \`${bestAvg[0].username}\`.`,
    ];
    return lines.join('\n');
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
        const suffix = getNumberSuffix(position);
        return `at the moment, you are ranked ${position}${suffix}.`;
    }
}

// tnx Youri because i'm lazy
function getNumberSuffix(n) {
    let suffix = 'th';
    if (n % 10 === 1 && n % 100 !== 11) suffix = 'st';
    if (n % 10 === 2 && n % 100 !== 12) suffix = 'nd';
    if (n % 10 === 3 && n % 100 !== 13) suffix = 'rd';
    return suffix;
}

async function counter(userid) {
    const user = await userRepo.findUserById(userid);
    let msg;
    if (user === null || user.rolls.length === 0) {
        msg = 'you have not rolled yet';
    } else {
        msg = `you rolled ${user.rolls.length} times.`;
    }

    return msg;
}

async function handleMessage(evt) {
    const message = evt.content;
    /* Break the comment in case of DUNAK
    evt.react(evt.guild.emojis.cache.find(emoji => emoji.name === 'pog'))
    .then(console.log)
    .catch(console.error);*/

    if (message.startsWith('=')) {
        // Parse command arguments
        const args = message.slice(1).split(/\s+/g);
        const cmd = args.shift().toLowerCase();
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
                evt.reply(await getAverage(evt.author.id));
                break;
            case 'last':
                evt.reply(await lastRoll(evt.author.id));
                break;
            case 'top':
                evt.reply(await findTop(evt.author.id));
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
