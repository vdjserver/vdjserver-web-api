
'use strict';

// Express Modules
var express      = require('express');
var morgan       = require('morgan');
var errorHandler = require('errorhandler');
var bodyParser   = require('body-parser');
var openapi      = require('express-openapi');
var passport     = require('passport');
var _            = require('underscore');
var path = require('path');
var fs = require('fs');
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

// Controllers
var apiResponseController = require('./controllers/apiResponseController');
var tokenController       = require('./controllers/tokenController');

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
//app.use(bodyParser.urlencoded({extended: true}));
app.use(allowCrossDomain);
app.use(passport.initialize());
//app.use(express.methodOverride());
//app.locals.pretty = true;

app.redisConfig = {
    port: 6379,
    host: 'localhost',
};

app.use(errorHandler({
    dumpExceptions: true,
    showStack: true,
}));

openapi.initialize({
  apiDoc: fs.readFileSync(path.resolve(__dirname, '../../swagger/vdjserver-api.yaml'), 'utf8'),
  app: app,
  promiseMode: true,
  consumesMiddleware: {
    'application/json': bodyParser.json(),
    'application/x-www-form-urlencoded': bodyParser.urlencoded({extended: true})
  },
  operations: {
      //getStatus: function(req, res) { res.send('{"result":"success"}'); }
      getStatus: apiResponseController.confirmUpStatus,
      createToken: tokenController.getToken,
      refreshToken: tokenController.refreshToken
  }
});

//app.use(function(err, req, res, next) {
//  res.status(err.status).json(err.message);
//});

app.listen(app.get('port'), function() {
    console.log('VDJ-API INFO: VDJServer API service listening on port ' + app.get('port'));
});

// Router
//require('./routes/router')(app);

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
