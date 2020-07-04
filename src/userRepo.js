const MongoClient = require('mongodb').MongoClient;
const config = require('../config.json');

const uri = config.auth.mongoConnectionString;
const mongo = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
var rolls = null;
mongo.connect(err => {
    rolls = mongo.db("user_data").collection("rolls");
});

module.exports.findAllOrderByBestRoll = async function findAllOrderByBestRoll() {
    if (rolls === null) return null;

    let cursor = await rolls.find({}, {
        projection: {
            _id: 0,
            username: 1,
            best_roll: 1,
            userid: 1
        },
        sort: {
            best_roll: -1
        }
    });

    return cursor.toArray();
}

module.exports.findAllOrderByAvg = async function findAllOrderByAvg() {
    if (rolls === null) return null;

    return rolls.find({}, {
        projection: {
            _id: 0,
            username: 1,
            average: 1,
            userid: 1
        }
    }).sort({
        average: -1
    }).toArray();
}

module.exports.findUserById = async function findAllById(id) {
    return rolls.findOne({
        "userid": id
    });
}

module.exports.upsertOne = async function upsertOne(user) {
    var query = {
        userid: user.userid
    };
    var values = {
        $set: {
            lastRoll: new Date(),
            username: user.username,
            rolls: user.rolls,
            average: user.average,
            best_roll: user.best_roll,
        }
    };

    rolls.updateOne(query, values, {
        upsert: true
    });
}
