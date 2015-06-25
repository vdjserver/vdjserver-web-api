
'use strict';

// Express Modules
var express      = require('express');
var morgan       = require('morgan');
var errorHandler = require('errorhandler');
var bodyParser   = require('body-parser');
var passport     = require('passport');
var _            = require('underscore');
var app          = module.exports = express();

// Server Options
var config = require('./config/config');
app.set('port', config.port);
app.set('sslOptions', config.sslOptions);

// CORS
var allowCrossDomain = function(request, response, next) {
    response.header('Access-Control-Allow-Origin', '*');
    response.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' === request.method) {
        response.status(200).end();
    }
    else {
        next();
    }
};

// Server Settings
app.use(morgan('combined'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(allowCrossDomain);
app.use(passport.initialize());
//app.use(express.methodOverride());
//app.locals.pretty = true;

try {
    var tmpRedis = process.env.REDIS_1_PORT;

    if (_.isArray(tmpRedis)) {
        tmpRedis = tmpRedis.split('tcp://');
        tmpRedis = tmpRedis[1].split(':');
        app.redisHost = tmpRedis[0];
        app.redisPort = tmpRedis[1];
        console.log('Detected redis settings from environment.');
        console.log('redisHost is: ' + app.redisHost);
        console.log('redisPort is: ' + app.redisPort);
    }
    else {
        console.log('Unable to detect redis settings from environment; using defaults instead.');
    }
}
catch (e) {
    console.error('Unable to detect redis settings from environment. Error is: ' + e);
}

// Server
var env = process.env.NODE_ENV || 'production';
if (env === 'test') {
    app.server = require('http').createServer(app).listen(8442, function() {
        console.log('Express Test HTTP server listening on port ' + app.get('port'));
    });
}
else if (env === 'development') {
    app.use(errorHandler({
        dumpExceptions: true,
        showStack: true,
    }));

    app.server = require('http').createServer(app).listen(app.get('port'), function() {
        console.log('Express Dev HTTP server listening on port ' + app.get('port'));
    });
}
else if (env === 'production') {
    app.use(errorHandler());

    app.server = require('https').createServer(app.get('sslOptions'), app).listen(app.get('port'), function() {
        console.log('Express Prod HTTPS server listening on port ' + app.get('port'));
    });
}

// Router
require('./routes/router')(app);

// WebsocketIO
require('./controllers/websocketController');

// Queue Management
var queueManager = require('./utilities/queueManager');

setInterval(function() {
    console.log("timer tick");
    queueManager.processFileUploads();
    console.log("timer post");
}, 10000);

//queueManager.processFileUploads();
