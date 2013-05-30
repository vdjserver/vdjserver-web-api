var AGS = require('./agave-settings');
var AG = {};
module.exports = AG;

var token = '';

AG.authPostOptions = function(path) {
    return {
		hostname: AGS.agaveAuthHost, 
		path: path, 
		method: 'POST', 
		auth: AGS.agaveUser+':'+AGS.agavePass, 
		rejectUnauthorized: false
    }
}

AG.postOptionsToken = function(path, token) {
	return {
		hostname: AGS.agaveHost, 
		path: path, 
		method: 'POST', 
		auth: AGS.agaveUser+':'+token, 
		rejectUnauthorized: false		
	}
}

AG.getToken = function(callback) {
	var request = require('https').request(AG.authPostOptions(AGS.agaveAuth), function(response) {
		var output = '';
		response.on('data', function(chunk) {
				output += chunk;
		});
		response.on('end',function() {
			var obj = JSON.parse(output);
			console.log("Status: " + obj.status);
			console.log("Token: " + obj.result.token);
			token = obj.result.token;
			if(callback) {
				callback(token);
			}
			
		});
	});
	request.on('error',function(e){
		console.log("Error: " + postOptions + "\n" + e.message);
		console.log( e.stack );
		return false;
	})
	request.end();
}

AG.createInternalUser = function(userData) {

	console.log('AG.createInternalUser called with ' + JSON.stringify(userData));
	
	AG.getToken(function(token) {
	
		console.log("Got token with " + token);
		
		var unshared = {
			"username": "gibberish",
			"email": "gibberish@example.com",
			"firstName": "Unshared",
			"lastName": "User",
			"position": "Consumer",
			"institution": "Example University",
			"phone": "512-555-5555",
			"fax": "512-555-5556",
			"researchArea": "Software Engineering",
			"department": "QA",
			"city": "Anywhere",
			"state": "TX",
			"country": "USA",
			"fundingAgencies": [
					"Dad",
					"Mom"
			],
			"gender": "MALE"
		};

		var postOptions = AG.postOptionsToken(AGS.agaveRegInternal, token);
		console.log("postOptions: " + JSON.stringify(postOptions));

		var request = require('https').request(postOptions, function(response) {
			var output = '';
			response.on('data', function(chunk) {
					output += chunk;
			});
			response.on('end',function() {
				console.log(output);
				var obj = JSON.parse(output);
				console.log("Status: " + obj.status);
				console.log("Username: " + obj.result.username);
				return obj;
			});
		});
		request.on('error',function(e){
			console.log("Error w/createInternalUser: " + postOptions + "\n" + e.message);
			console.log( e.stack );
			return false;
		})
	
		//write the JSON of the internal user
		request.write(JSON.stringify(unshared));
		request.end();			
	
	});
	

}


