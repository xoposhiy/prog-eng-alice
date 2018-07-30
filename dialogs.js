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
            dialog(session, ctx);
            session.lastSessionId = ctx.sessionId;
            session.userId = ctx.userId;
            return db.updateUser(ctx.userId, session);
        });
    });

    function dialog(session, ctx){
        const hasTask = session.topicId && session.lastWord;
        if (ctx.message && ctx.message.toLowerCase() == "iddqd"){
            return ctx.reply(session.topicId + '\n' + JSON.stringify(session.lastWord, null, ' '));
        }
        else if (hasTask && ctx.message){
            const word = session.lastWord;
            if (isCorrect(word, ctx.message))
                return correctAnswer(session, ctx);
            else if (isHintRequest(ctx.message))
                return giveHintAnswer(word, session, ctx);
            else if (isDefeat(ctx.message))
                return defeatAnswer(word, session, ctx);
            console.log('correct | hint | defeat');

        }
        if (!session.topicId && trySelectTopic(session, ctx)){
            console.log('selectTopic');
            return;
        }
        else if (!session.topicId || shouldListTopics(session, ctx)){
            console.log('listTopic');
            session.topicId = null;
            return listTopics(session, ctx);
        }
        else if (hasTask){
            console.log('incorrect');
            return incorrectAnswer(session.lastWord, session, ctx);
        }
        else{
            console.log('give task');
            return giveTask(session, ctx, true);
        }
    }

    function trySelectTopic(session, ctx){
        if (session.topicId) return false;
        const selected = topics.filter(t => ctx.payload == t.id || ctx.message && ctx.message.indexOf(t.command) >= 0);
        if (selected.length == 0) return false;
        const topic = selected[0];
        console.log('set topic to ' + topic.id);
        session.topicId = topic.id;
        giveTask(session, ctx, `Итак, тема '${topic.longname}'. Из возможных вариантов ответа выбирай тот, который лучше подходит к теме.`, true);
        return true;
    }

    function shouldListTopics(session, ctx){
        const phrases = 'хватит|достаточно|сменить тему|изменить тему|другая тема|другую тему|другой набор|другой набор слов'.split('|');
        return !session.topicId || ctx.message && phrases.indexOf(ctx.message.toLowerCase()) >= 0;

    }
    function listTopics(session, ctx){
        let builder = buildReply(ctx, `У меня есть несколько тематических наборов слов из разных областей {C#|си шарп}: ${topics.map(t=>t.name).join(', ')}.\nПредлагаю начать с темы '${topics[0].name}'.`);
        topics.forEach(t => {
            const name = parseTts(t.name);
            builder.addButton(button({
                title: name.text,
                payload: t.id
            }));
        });
        ctx.reply(builder.get());
    }

    function addTaskButtons(builder){
        return builder
            .addButton(button({title:'Подсказку', hide:true}))
            .addButton(button({title:'Сдаюсь', hide:true}))
            .addButton(button({title:'Сменить тему', hide:true}));

    }
    function giveTask(session, ctx, preText, firstTime){
        session.mistakes = 0;
        session.exampleUsed = false;
        session.explainUsed = false;
        session.candidatesUsed = false;
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

    function getWordData(session, word){
        session.topics = session.topics || {};
        session.topics[session.topicId] = session.topics[session.topicId] || {};
        return session.topics[session.topicId][word.en] = session.topics[session.topicId][word.en] || {tiesCount: 0, streak: 0};
    }

    function getNextWord(session){
        const words = getWords(session).map(w => ({ w: w, streak: getWordData(session, w).streak}));
        words.sort((a, b) => a.streak - b.streak);
        console.log(words.length + ' words in topic ' + session.topicId);
        console.log(words.map(w => w.streak + ' ' + w.w.en));
        let minStreak = words[0].streak;
        let candidates = words.filter(w => w.streak == minStreak).map(p => p.w);
        return session.lastWord = randomItem(candidates);
    }    
   
    function isDefeat(message){
        return ["сдаюсь", "не знаю"].indexOf(message.toLowerCase()) >= 0;
    }
    
    function defeatAnswer(word, session, ctx){
        registerTry(word, session, false);
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
        registerTry(session.lastWord, session, true);
        const newWord = getNextWord(session);
        const ok = randomItem('Верно!|Да!|Ага.|Правильно!'.split('|'));
        giveTask(session, ctx, ok, false);
    }
    
    function incorrectAnswer(word, session, ctx){
        registerTry(word, session, false);
        ctx.reply(
            addTaskButtons(
                buildReply(ctx, `Это неверный перевод {слова|сл+ова} ${word.en}. Попробуй ещё раз или попроси подсказку.`))
            .get());
    }
    
    function isHintRequest(message){
        return [
            'забыл', 'не могу вспомнить', 'не помню',
            'помоги', 'подскажи', 
            'сложно', 'нет', 'не помогло',
            'хочу подсказку', 'дай подсказку', 'давай подсказку', 'подсказку', 
        ].indexOf(message.toLowerCase()) >= 0;
    }

    function giveHintAnswer(word, session, ctx){
        registerTry(word, session, false);
        if (word.example && !session.exampleUsed){
            ctx.reply(
                buildReply(ctx, `Вот пример использования этого {слова|сл+ова}: {${word.example}|${convertIdentifierToTts(word.example)}}. Помогло?`)
                .get());
            session.exampleUsed = true;
        }
        else if (word.explain && !session.explainUsed){
            ctx.reply(
                buildReply(ctx, `Подсказываю. ${word.explain}. Помогло?`)
                .get());
            session.explainUsed = true;

        }
        else if (!session.candidatesUsed) {
            const candidates = getHintCandidates(session, word);
            const builder = buildReply(ctx, `Один из этих вариантов правильный: ${candidates.join(', ')}`);
            candidates.forEach(c => {
                const pair = parseTts(c);
                builder.addButton(button({
                    title: pair.text,
                    hide:true
                }))
            });
            session.candidatesUsed = true;
            ctx.reply(builder.get());
        }
        else {
            ctx.reply('Больше подсказок нет. Сдаёшься?');
        }
    }

    function registerTry(word, session, success){
        if (!success) session.mistakes = session.mistakes + 1 || 1;
        session.topics = session.topics || {};
        session.topics[session.topicId] = session.topics[session.topicId] || {};
        let wordData = session.topics[session.topicId][word.en] || {};
        wordData.triesCount = wordData.triesCount + 1 || 1;
        if (success)
            wordData.streak = (wordData.streak || 0) + 1;
        else
            wordData.streak = 0;
        session.topics[session.topicId][word.en] = wordData;
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
