const Alice = require('yandex-dialogs-sdk');
const firebase = require('firebase');
const setupDialogs = require('./dialogs.js');
const Db = require('./db/db.js');
//const topics = require('./topics.js')
const fetch = require('node-fetch');

require('dotenv').config();

var config = {
    apiKey: process.env.firebaseApiKey,
    authDomain: "prog-eng-alice.firebaseapp.com",
    databaseURL: "https://prog-eng-alice.firebaseio.com",
    storageBucket: "prog-eng-alice.appspot.com",
};

function toObj(fs, r){
    let res = {};
    for(let i=0; i<fs.length; i++)
        if (r[i] !== undefined)    
            res[fs[i]] = r[i];
    return res;
}

function csv2objects(csv){
    const fs = csv[0];
    return csv.filter((r, i) => i > 0).map(row => toObj(fs, row));
}

async function main(){
    const googleApiKey = process.env.googleApiKey;
    const spreadsheetId = '1NqNuaKZnHE34byrtn6p5g91ZSfsMIDRoWZoKBW8WnjM';
    let words = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/words!A:Z?key=${googleApiKey}`)
        .then(r => r.json())
        .then(d => csv2objects(d.values));
    let topics = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/topics!A:Z?key=${googleApiKey}`)
        .then(r => r.json())
        .then(d => csv2objects(d.values));
    topics.forEach(topic => {
        topic.words = words.filter(w => w.topic === topic.id);
        console.log(topic.id + " " + topic.words.length);
    });
    
    firebase.initializeApp(config);
    firebase.auth()
        .signInWithEmailAndPassword(process.env.firebaseEmail, process.env.firebasePassword)
        .then((user) => {
            const db = firebase.database();
            var botDb = new Db(db);
            const alice = new Alice();
            setupDialogs(alice, topics, botDb);
            console.log("ready!");
            alice.listen('/', 3000);
        })
};

main();