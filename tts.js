module.exports = function parseTts(tts){
    return {
        text: replaceAllInstruction(tts, 1),
        tts: replaceAllInstruction(tts, 2),
    };
}

function replaceAllInstruction(tts, index){
    while (true){
        let newTts = tts.replace(/\{(.+?)\|(.+?)\}/, '$' + index);
        if (newTts === tts) return tts;
        tts = newTts;
    } 
}
