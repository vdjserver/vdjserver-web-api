
var config = {};

module.exports = config;


// General
config.port = 8443;
config.sessionSecret = 'super-duper-secret-secret';


// Mongoose
config.mongoosePort = 27017;

config.mongooseDevDb  = 'vdjserver_test';
config.mongooseProdDb = 'vdjserver';

config.mongooseDevDbString = 'mongodb://localhost:' + config.mongoosePort + '/' + config.mongooseDevDb;
config.mongooseProdDbString = 'mongodb://localhost:' + config.mongoosePort + '/' + config.mongooseProdDb;
