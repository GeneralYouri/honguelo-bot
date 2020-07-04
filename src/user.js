module.exports = class User {
    constructor(id, name) {
        this._id = null;
        this.rolls = [];
        this.average = 0;
        this.userid = id;
        this.best_roll = 0;
        this.username = name;
        this.lastRoll = null;
    }
};
