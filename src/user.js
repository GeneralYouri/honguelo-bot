
module.exports = class User{
        constructor(id, name) {
        this._id = null;
        this.userid = id;
        this.name = name;
        this.rolls = [];
        this.lastRoll = null;
    }
}