const Alice = require('yandex-dialogs-sdk');
const Scene = Alice.Scene

const db = {}; // sessionId => lastTask;

const alice = new Alice();
const { button } = Alice;

alice.welcome(async (ctx) => {
    // ctx.reply('Я помогу выучить английские слова, которые часто используются в программировании. Поехали?');
    ctx.reply( 
        ctx.replyBuilder
        .text('Я помогу выучить английские слова, которые часто используются в программировании. Поехали?')
        .addButton(button("Поехали!"))
        .get());
});

alice.any(ctx => {
    ctx.reply('hi all')});

alice.listen('/', 3000); 