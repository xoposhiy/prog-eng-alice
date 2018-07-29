const parseTts = require('./tts.js');
const { button } = require('yandex-dialogs-sdk');

function joinSentences(...sentences){
    return sentences.filter(s => s !== undefined && s !== null && s != '').join('\n');
}

module.exports = function setupDialogs(alice, topics, db){
    function buildReply(ctx, message){
        const {text, tts} = parseTts(message);
        return ctx.replyBuilder
            .text(text)
            .tts(tts)
    }

    alice.welcome(async (ctx) => {
        ctx.reply(
            buildReply(ctx, 'Я помогу выучить английские слова, которые часто используются в программировании на {C#|си шарп}. Поехали?')
            .addButton(button({title:"Поехали", hide:true}))
            .get()
        );
    });
    alice.any(ctx => {
        db.getOrCreateUser(ctx.userId, ctx.sessionId).then(session => {
            if (session.lastSessionId != ctx.sessionId){
                console.log('session cleared');
                session = {
                    userId:ctx.userId, 
                    lastSessionId:ctx.sessionId
                };
            }
            if (ctx.message && ctx.message.toLowerCase() == "iddqd"){
                ctx.reply(session.topicId + '\n' + JSON.stringify(session.lastWord, null, ' '));
            }
            else if (trySelectTopic(session, ctx)){
            }
            else if (shouldListTopics(session, ctx)){
                listTopics(session, ctx);
            }
            else if (session.lastWord){
                checkAnswer(session, ctx);
            }
            else{
                giveTask(session, ctx, true);
            }
            session.lastSessionId = ctx.sessionId;
            session.userId = ctx.userId;
            return db.updateUser(ctx.userId, session);
        });
    });

    function trySelectTopic(session, ctx){
        const selected = topics.filter(t => ctx.payload == t.id || ctx.message && ctx.message.indexOf(t.command) >= 0);
        if (selected.length == 0) return false;
        const topic = selected[0];
        console.log('set topic to ' + topic.id);
        session.topicId = topic.id;
        giveTask(session, ctx, `Итак, тема '${topic.longname}'. Из возможных вариантов ответа выбирай тот, который лучше подходит к теме.`, true);
        return true;
    }

    function shouldListTopics(session, ctx){
        const phrases = 'хватит|достаточно|другая тема|другую тему|другой набор|другой набор слов'.split('|');
        return !session.topicId || phrases.indexOf(ctx.message.toLowerCase()) >= 0;

    }
    function listTopics(session, ctx){
        let builder = buildReply(ctx, `У меня есть несколько тематических наборов слов из разных областей {C#|си шарп}: ${topics.map(t=>t.name).join(', ')}.\nПредлагаю начать со темы '${topics[0].name}'.`);
        topics.forEach(t => {
            const name = parseTts(t.name);
            builder.addButton(button({
                title: name.text,
                tts: name.text,
                payload: t.id
            }));
        });
        ctx.reply(builder.get());
    }

    function checkAnswer(session, ctx){
        const word = session.lastWord;
        if (isDefeat(ctx.message))
            defeatAnswer(word, session, ctx);
        if (isHintRequest(ctx.message))
            giveHintAnswer(word, session, ctx);
        else if (isCorrect(word, ctx.message))
            correctAnswer(session, ctx);
        else 
            incorrectAnswer(word, session, ctx);
    }

    function addTaskButtons(builder){
        return builder
            .addButton(button({title:'Подсказку', hide:true}))
            .addButton(button({title:'Сдаюсь', hide:true}));

    }
    function giveTask(session, ctx, preText, firstTime){
        const word = getNextWord(session);
        let translateWord = 'Переведи слово';
        if (!firstTime)
            translateWord = randomItem('Следующее слово:|Следующее:|Переведи слово '.split('|'));

        ctx.reply(
            addTaskButtons(
                buildReply(ctx, joinSentences(preText, `${translateWord} ${word.en}.`))
            ).get());
    }

    function getWords(session){
        return topics.filter(t => t.id == session.topicId)[0].words;
    }

    function getNextWord(session){
        const words = getWords(session);
        return session.lastWord = randomItem(words);
    }    
   
    function isDefeat(message){
        return ["сдаюсь", "не знаю"].indexOf(message.toLowerCase()) >= 0;
    }
    
    function defeatAnswer(word, session, ctx){
        session.mistakes = 0;
        session.exampleUsed = false;
        const defeatMessage = formatDefeatMessage(word);
        const newWord = getNextWord(session);
        giveTask(session, ctx, defeatMessage, false);
    }
    
    function formatDefeatMessage(word){
        const reply = [`Правильный ответ '${word.ru.split('|')[0]}'.`];
        if(word.example){
            reply.push(`Пример использования: {${word.example}|${convertIdentifierToTts(word.example)}}.`)
        }
        return reply.join(' ');
    }
    
    function isCorrect(word, answer){
        return word.ru.indexOf(answer.toLowerCase()) >= 0
    }
    function correctAnswer(session, ctx){
        session.mistakes = 0;
        session.exampleUsed = false;
        const newWord = getNextWord(session);
        const ok = randomItem('Верно!|Да!|Ага.|Правильно!'.split('|'));
        giveTask(session, ctx, ok, false);
    }
    
    function incorrectAnswer(word, session, ctx){
        session.mistakes = session.mistakes + 1 || 1;
        ctx.reply(
            addTaskButtons(
                buildReply(ctx, `Это неверный перевод {слова|сл+ова} ${word.en}. Попробуй ещё раз или попроси подсказку.`))
            .get());
    }
    
    function isHintRequest(message){
        return [
            'помоги', 'подскажи', 
            'сложно', 'нет', 'не помогло',
            'хочу подсказку', 'дай подсказку', 'давай подсказку', 'подсказку', 
        ].indexOf(message.toLowerCase()) >= 0;
    }

    function giveHintAnswer(word, session, ctx){
        session.mistakes = session.mistakes + 1 || 1;
        if (word.example && !session.exampleUsed){
            ctx.reply(
                buildReply(ctx, `Подсказка. Вот пример использования этого {слова|сл+ова}: {${word.example}|${convertIdentifierToTts(word.example)}}. Помогло?`)
                .get());
            session.exampleUsed = true;
        }
        else {
            const candidates = getHintCandidates(session, word);
            const builder = buildReply(ctx, `Один из этих вариантов правильный: ${candidates.join(', ')}`);
            candidates.forEach(c => {
                const pair = parseTts(c);
                builder.addButton(button({
                    title: pair.text,
                    tts: pair.tts,
                    hide:true
                }))
            });

            ctx.reply(builder.get());
        }
    }

    function getHintCandidates(session, word){
        const words = getWords(session);
        const w1 = randomItem(words);
        const w2 = randomItem(words);
        var candidates = [word.ru, w1.ru, w2.ru].map(w => w.split('|')[0]);
        candidates.sort((a, b) => Math.random());
        return candidates;
    }

    function convertIdentifierToTts(identifier){
        const tts = identifier.replace(/[A-Z]/g, " $&").trim();
        return tts;
    }

    function randomItem(array) {
        return array[Math.trunc(Math.random() * array.length)];
    }
}
