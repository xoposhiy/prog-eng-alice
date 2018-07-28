const Alice = require('yandex-dialogs-sdk');
const firebase = require('firebase');
const setupDialogs = require('./dialogs.js');
const Db = require('./db/db.js');
require('dotenv').config();

console.log("process.env:");
console.log(process.env);

var config = {
    apiKey: process.env.firebaseApiKey,
    authDomain: "prog-eng-alice.firebaseapp.com",
    databaseURL: "https://prog-eng-alice.firebaseio.com",
    storageBucket: "prog-eng-alice.appspot.com",
};

firebase.initializeApp(config);
firebase.auth()
    .signInWithEmailAndPassword(process.env.firebaseEmail, process.env.firebasePassword)
    .then((user) => {
        const db = firebase.database();
        var botDb = new Db(db);
        botDb.getWords().then(words => {
            const alice = new Alice();
            setupDialogs(alice, words, botDb);
            console.log("ready!");
            alice.listen('/', 3000);
        });
    })
