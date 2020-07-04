const config = require('../config.json');
const eloRoles = require('./eloRoles.json');
const User = require('./user.js');
const userRepo = require('./userRepo.js');
const discordHandler = require('./discordHandler');

module.exports.evtRoll = doRoll;
module.exports.canUserRoll = canUserRoll;
module.exports.roll = getRoll;

async function doRoll(evt) {
    const roll = getRoll();
    const didUpdate = await updateRoll(roll, evt.author.id, evt.author.username);
    let reply;

    if (!didUpdate) {
        const getout = discordHandler.getEmoji('getout');
        reply = `you already had your roll today. ${getout}`;
    } else {
        // Find which role to give based on the roll
        const matchedRole = eloRoles.find(option => roll < option.topBound) || eloRoles[0];

        discordHandler.clearRoles(evt.guild, evt.member);
        discordHandler.giveRole(matchedRole.name, evt.guild, evt.member);
        reply = roll.toString();
    }

    evt.reply(reply);
}

async function updateRoll(roll, userID, username) {
    console.log(`Rolling for ${username}`);

    let user = await userRepo.findUserById(userID);
    if (!user) {
        user = new User(userID, username);
    }

    if (!canUserRoll(user)) {
        return false;
    } else {
        user.rolls.push(roll);
        user.best_roll = Math.max(user.best_roll, roll);
        user.average = score(user.rolls);

        userRepo.upsertOne(user);
    }

    return true;
}

function canUserRoll(user) {
    if (user.lastRoll === null) return true;

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return (user.lastRoll < midnight);
}

function getRoll() {
    return Math.round(Math.random() * 5000 + 1);
}

function score(rolls) {
    return rolls.reduce((sum, roll) => sum + roll, 0) / (config.seasonLength || 1);
}
