module.exports = class User {
    constructor(params) {
        this.userId = params.userId;
        this.lastSessionId = params.lastSessionId;
        this.lastWord = params.lastWord;
        this.exampleUsed = params.exampleUsed;
//        this.lastGroup = params.lastGroup;
  //      this.groups = params.groups;
    }

    get currentGroup() {
        return this.groups[this.lastGroup];
    }

    get userData() {
        return {
            lastSessionId: this.lastSessionId,
            lastWord: this.lastWord,
            lastGroup: this.lastGroup,
            groups: this.groups
        }
    }

    updateCurrentGroup(word, result, db) {
        let currentResults = this.currentGroup[word];

        if (!currentResults) {
            this.currentGroup[word] = `${result}`

            return this.db.updateUser(this.userId, this.userData)
        }

        if (currentResults.length === 3) {
            const { first, second, last } = currentResults.split('|');

            this.currentGroup[word] = `${second}${last}${result}`;

            return this.db.updateUser(this.userId, this.userData)
        }

        currentResults = `${currentResults}|${result}`
        this.currentGroup[word] = currentResults;

        return this.db.updateUser(this.userId, this.userData)
    }
}