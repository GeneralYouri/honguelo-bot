const Discord = require('discord.js');
const config = require('../config.json');
const eloRoles = require('./eloRoles.json');

const client = new Discord.Client();
client.login(config.auth.token);
let honguGuild = null;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    honguGuild = client.guilds.cache.get(config.guildID);
    client.channels.cache.get(config.roleChannelID).messages.fetch(config.roleMessageID);
});

client.on('guildMemberAdd', (evt) => {
    const userid = evt.id;
    const guild = evt.guild;
    const member = guild.members.cache.find(member => member.id === userid);
    const rolename = (userid === '279656190655463425') ? 'Technical Director' : 'Unranked'; // June id

    giveRole(rolename, guild, member);
});

client.on('messageReactionAdd', (reaction, user) => {
    if (reaction.message.id === config.roleMessageID) {
        const userid = user.id;
        const guild = honguGuild;
        const member = guild.members.cache.find(member => member.id === userid);
        const rolename = 'Addicted';

        giveRole(rolename, guild, member);
    }
});

client.on('messageReactionRemove', (reaction, user) => {
    if (reaction.message.id === config.roleMessageID) {
        const userid = user.id;
        const guild = honguGuild;
        const member = guild.members.cache.find(member => member.id === userid);
        const rolename = 'Addicted';

        takeRole(rolename, guild, member);
    }
});

module.exports.setHandler = setHandler;
function setHandler(handleMessage) {
    client.on('message', handleMessage);
}

module.exports.getEmoji = getEmoji;
function getEmoji(name) {
    return client.emojis.cache.find(emoji => emoji.name === name);
}

module.exports.giveRole = giveRole;
function giveRole(roleName, guild, member) {
    const role = getRole(guild, roleName);
    member.roles.add(role);
}

module.exports.takeRole = takeRole;
function takeRole(rolename, guild, member) {
    const role = guild.roles.cache.find(r => r.name === rolename);
    if (role)
        member.roles.remove(role.id);
}

module.exports.clearRoles = clearRoles;
function clearRoles(guild, member) {
    eloRoles.forEach((role) => {
        takeRole(role.name, guild, member);
    });
}

module.exports.getRole = getRole;
function getRole(guild, roleName) {
    if (guild === null) guild = honguGuild;

    return guild.roles.cache.find(role => role.name === roleName);
}

module.exports.sendMessageToChannel = sendMessageToChannel;
function sendMessageToChannel(channelId, message) {
    client.channels.cache.get(channelId).send(message);
}
