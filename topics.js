const topics = require('./vocabulary/index.json');
topics.forEach(topic => {
    topic.words = require('./vocabulary/' + topic.id + '.json');
});
module.exports = topics;