
// Basic Config
var express = require('express');
var app     = express();
var http    = require('https');


app.configure(function() {

	app.set('view engine', 'jade');
	app.set('views', __dirname + '/server/views');
	app.set('port', 8443);

	app.locals.pretty = true;
//	app.use(express.favicon());
//	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({ secret: 'super-duper-secret-secret' }));
	app.use(express.methodOverride());
	app.use(require('stylus').middleware({ src: __dirname + '/public' }));
	app.use(express.static(__dirname + '/public'));
});


app.configure('development', function() {
	app.use(express.errorHandler());
});



// Required Files
require('./server/routes/router')(app);
var appSettings = require('./server/modules/app-settings');



// Server / SSL
var sslOptions = {
	key:  appSettings.vdjKey,
	cert: appSettings.vdjCert
};

http.createServer(sslOptions,app).listen(app.get('port'), function() {
	console.log("Express server listening on port " + app.get('port'));
})
