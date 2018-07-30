module.exports = class DB {
    constructor(db) {
        this.db = db;
    }

    getUser(userId) {
        return this.db.ref(`users/${userId}`).once('value').then(snapshot => {
            return snapshot && snapshot.val();
        })
    }
    getOrCreateUser(userId, sessionId) {
        return this.db.ref(`users/${userId}`).once('value').then(snapshot => {
            if (snapshot && snapshot.val())
                return snapshot.val();
            else{
                const userDto = {
                    userId: userId,
                    lastSessionId: sessionId,
                };
                return this.db
                    .ref(`users/${userId}`)
                    .set(userDto)
                    .then(() => userDto);
            }
        })
    }

    addUser(userId, userDto) {
        return this.db.ref(`users/${userId}`).set(userDto);
    }

    updateUser(userId, userDto) {
        return this.db.ref(`users/${userId}`).update(userDto);
    }
}