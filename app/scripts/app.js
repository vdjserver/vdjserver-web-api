
'use strict';

// Express Modules
var express      = require('express');
var morgan       = require('morgan');
var errorHandler = require('errorhandler');
var bodyParser   = require('body-parser');
var passport     = require('passport');
var _            = require('underscore');
var app          = module.exports = express();

var webhookIO = require('./vendor/webhookIO');

// Verify we can login with service account
var ServiceAccount = require('./models/serviceAccount');
ServiceAccount.getToken()
    .then(function(serviceToken) {
	console.log('VDJ-API INFO: Successfully acquired service token.');
    })
    .fail(function(error) {
	console.error('VDJ-API ERROR: Service may need to be restarted.');
	webhookIO.postToSlack('VDJ-API ERROR: Unable to login with service account.\nSystem may need to be restarted.\n' + error);
	//process.exit(1);
    });

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

app.redisConfig = {
    port: 6379,
    host: 'localhost',
};

// Server
var env = process.env.NODE_ENV || 'production';
if (env === 'test') {
    app.server = require('http').createServer(app).listen(8442, function() {
        console.log('VDJ-API INFO: Express Test HTTP server listening on port ' + app.get('port'));
    });
}
else if (env === 'development') {
    app.use(errorHandler({
        dumpExceptions: true,
        showStack: true,
    }));

    app.server = require('http').createServer(app).listen(app.get('port'), function() {
        console.log('VDJ-API INFO: Express Dev HTTP server listening on port ' + app.get('port'));
    });
}
else if (env === 'production') {
    app.use(errorHandler());

    app.server = require('http').createServer(app).listen(app.get('port'), function() {
        console.log('VDJ-API INFO: Express Prod HTTP server listening on port ' + app.get('port'));
    });
}

// Router
require('./routes/router')(app);

// WebsocketIO
require('./utilities/websocketManager');

// Queue Management
var filePermissionsQueueManager = require('./queues/filePermissionsQueueManager');
filePermissionsQueueManager.processFileUploads();

var accountQueueManager = require('./queues/accountQueueManager');
accountQueueManager.processNewAccounts();

var jobQueueManager = require('./queues/jobQueueManager');
jobQueueManager.processJobs();

var projectQueueManager = require('./queues/projectQueueManager');
projectQueueManager.processProjects();
