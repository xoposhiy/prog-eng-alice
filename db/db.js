const User = require('../models/user.js');

module.exports = class DB {
    constructor(db) {
        this.db = db;
    }

    getUser(userId) {
        return this.db.ref(`users/${userId}`).once('value').then(snapshot => {
            return snapshot && new User(snapshot.val(), this);
        })
    }
    getOrCreateUser(userId, sessionId) {
        return this.db.ref(`users/${userId}`).once('value').then(snapshot => {
            if (snapshot && snapshot.val())
                return new User(snapshot.val(), this);
            else{
                const userDto = {
                    userId: userId,
                    lastSessionId: sessionId,
                };
                const user = new User(userDto, this);
                return this.db
                    .ref(`users/${userId}`)
                    .set(userDto)
                    .then(() => user);
            }
        })
    }

    addUser(userId, params) {
        return this.db.ref(`users/${userId}`).set(params);
    }

    updateUser(userId, params) {
        return this.db.ref(`users/${userId}`).update(params);
    }

    getWords() {
        return this.db.ref('vocabulary').once('value').then(snapshot => {
            return  snapshot && snapshot.val();
        });
    }
}