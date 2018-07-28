const { button } = require('yandex-dialogs-sdk');

module.exports = function setupDialogs(alice, words, db){
    alice.welcome(async (ctx) => {
        ctx.reply( 
            ctx.replyBuilder
            .text('Я помогу выучить английские слова, которые часто используются в программировании на C#. Поехали?')
            .tts('Я помогу выучить английские слова, которые часто используются в программировании на си шарп. Поехали?')
            .addButton(button('Поехали!'))
            .get());
    });

    alice.any(ctx => {
        db.getOrCreateUser(ctx.userId, ctx.sessionId).then(session => {
            console.log(session);
            if (session.lastSessionId === ctx.sessionId && session.lastWord){
                checkAnswer(session, ctx);
            }
            else{
                giveTask(session, ctx);
            }
            session.lastSessionId = ctx.sessionId;
            session.userId = ctx.userId;
            return db.updateUser(ctx.userId, session);
        });
    });

    function getNextWord(session){
        let nextWordIndex = getRandomArbitrary(words.length);
        const word = words[nextWordIndex];
        session.lastWord = word;
        return word;
    }
    
    function giveTask(session, ctx){
        const word = getNextWord(session);
        ctx.reply(ctx.replyBuilder
            .text(`Переведи слово ${word.en}`)
            .addButton(button('подскажи'))
            .addButton(button('сдаюсь'))
            .get());
    }
    
    function isDefeat(message){
        return ["сдаюсь", "не знаю"].indexOf(message.toLowerCase()) >= 0;
    }
    
    function formatDefeatMessage(word){
        const reply = [`Правильный ответ '${word.ru.split('|')[0]}'.`];
        if(word.example){
            reply.push(`Пример использования: ${word.example}.`)
        }
        return reply.join(' ');
    }
    
    function defeatAnswer(word, session, ctx){
        session.mistakes = 0;
        session.exampleUsed = false;
        const newWord = getNextWord(session);
        const defeatMessage = formatDefeatMessage(word);
        const nextWord = randomItem('Следующее слово|Следующее|А как на счёт'.split('|'));
        ctx.reply(`${defeatMessage} ${nextWord} ${newWord.en}`);
    }
    
    function correctAnswer(session, ctx){
        session.mistakes = 0;
        session.exampleUsed = false;
        const newWord = getNextWord(session);
        const ok = randomItem('Верно!|Да!|Ага.|Правильно!'.split('|'));
        const nextWord = randomItem('Следующее слово|Следующее|А как на счёт'.split('|'));
        ctx.reply(`${ok} ${nextWord} ${newWord.en}`);
    }
    
    function incorrectAnswer(word, session, ctx){
        session.mistakes = session.mistakes + 1 || 1;
        ctx.reply(ctx.replyBuilder
            .text(`Это неверный перевод слова ${word.en}. Попробуй ещё раз или попроси подсказку.`)
            .tts(`Это неверный перевод сл+ова ${word.en}. Попробуй ещё раз или попроси подсказку.`)
            .get());
    }
    
    function isCorrect(word, answer){
        return word.ru.indexOf(answer.toLowerCase()) >= 0
    }

    function isHintRequest(message){
        return [
            'помоги', 'подскажи', 
            'сложно', 'нет', 'не помогло',
            'хочу подсказку', 'дай подсказку', 'подсказку', 
        ].indexOf(message.toLowerCase()) >= 0;
    }

    function getRandomArbitrary(max) {
        return Math.trunc(Math.random() * max);
    }

    function randomItem(array) {
        return array[Math.trunc(Math.random() * array.length)];
    }

    function getHintCandidates(word){
        const i1 = getRandomArbitrary(words.length);
        const i2 = getRandomArbitrary(words.length);
        console.log(i1);
        console.log(i2);
        console.log(words.length);
        var candidates = [word.ru, words[i1].ru, words[i2].ru].map(w => w.split('|')[0]);
        candidates.sort((a, b) => Math.random());
        return candidates;
    }
    function convertIdentifierToTts(identifier){
        const tts = identifier.replace(/[A-Z]/g, " $&").trim();
        console.log(tts);
        return tts;
    }
    function giveHintAnswer(word, session, ctx){
        session.mistakes = session.mistakes + 1 || 1;
        console.log("ex used: " + session.exampleUsed);
        if (word.example && !session.exampleUsed){
            ctx.reply(ctx.replyBuilder
                .text(`Вот пример использования этого слова: ${word.example}. Теперь догадался?`)
                .tts(`Вот пример использования этого сл+ова: ${convertIdentifierToTts(word.example)}. - - Теперь догадался?`)
                .get());
            session.exampleUsed = true;
        }
        else {
            ctx.reply(`Один из этих вариантов правильный: ${getHintCandidates(word).join(', ')}`);
        }
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
}
