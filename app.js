
/**
 *
**/

var express = require('express');
var http = require('https');
var fs   = require('fs');
var app = express();
var sslOptions = {
	key: fs.readFileSync('/home/mock/vdjserver.org.certificate/vdjserver.org.key'), 
	cert: fs.readFileSync('/home/mock/vdjserver.org.certificate/vdjserver.org.cer')
};

app.configure(function(){

	app.set('port', 8443);
	app.set('views', __dirname + '/app/server/views');
	app.set('view engine', 'jade');
	app.locals.pretty = true;
//	app.use(express.favicon());
//	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({ secret: 'super-duper-secret-secret' }));
	app.use(express.methodOverride());
	app.use(require('stylus').middleware({ src: __dirname + '/app/public' }));
	app.use(express.static(__dirname + '/app/public'));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

require('./app/server/router')(app);

http.createServer(sslOptions,app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
})
