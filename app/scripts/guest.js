
'use strict';

var http = require('http');
var https = require('https');

var agaveSettings = require('./config/agaveSettings');
var webhookIO = require('./vendor/webhookIO');

// node libraries
var requestLib = require('request');

// Verify we can login with guest account
var GuestAccount = require('./models/guestAccount');
GuestAccount.getToken()
    .then(function(guestToken) {
	console.log('VDJ-GUEST INFO: Successfully acquired guest token.');
    })
    .fail(function(error) {
	console.error('VDJ-GUEST ERROR: Service may need to be restarted.');
	webhookIO.postToSlack('VDJ-GUEST ERROR: Unable to login with guest account.\nSystem may need to be restarted.\n' + error);
	//process.exit(1);
    });

http.createServer(function(request, response) {
    //console.log(request);

    if (request.method != 'GET') {
	console.error('VDJ-GUEST ERROR: Unauthorized request, method: ' + request.method + ' url: ' + request.url + ' headers: ' + request.headers);
	response.writeHead(401, {});
	response.end();
    } else {
	GuestAccount.getToken()
	    .then(function(guestToken) {
		// splice out the leading guest path
		var newUrl = request.url;
		var pathList = newUrl.split("/");
		if (pathList.length > 1) pathList.splice(1,1);
		newUrl = pathList.join('/');

		var requestSettings = {
		    url: 'https://' + agaveSettings.hostname + newUrl,
		    method:   'GET',
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + GuestAccount.accessToken(),
		    }
		};
		//console.log(request);
		//console.log(requestSettings);

		requestLib(requestSettings).pipe(response);
/*
		var requestSettings = {
		    host:     agaveSettings.hostname,
		    method:   request.method,
		    path:     request.url,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + GuestAccount.accessToken(),
		    }
		};

		var proxy_request = require('https').request(requestSettings, function(proxy_response) {
		    proxy_response.on('data', function(chunk) {
			response.write(chunk, 'binary');
		    });
		    proxy_response.on('end', function() {
			response.end();
		    });
		    response.writeHead(proxy_response.statusCode, proxy_response.headers);
		});

		request.addListener('data', function(chunk) {
		    proxy_request.write(chunk, 'binary');
		});
		request.addListener('end', function() {
		    proxy_request.end();
		});
*/
	    })
	    .fail(function(error) {
		console.error('VDJ-GUEST ERROR: Unable to acquire guest account token.\n' + error);
		webhookIO.postToSlack('VDJ-GUEST ERROR: Unable to login with guest account.\n' + error);
		response.end();
	    });
    }
}).listen(8082);

