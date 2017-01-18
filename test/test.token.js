
'use strict';

// Libraries
let assert = require('chai').assert;
let jsonApprover = require('json-approver');
let moment = require('moment');
let path = require('path');
let request = require('supertest-as-promised');

// TODO: put in env var
//request = request('192.168.99.100:8081');
request = request('http://localhost:8081');

describe('VDJ API Tests', function() {

    before(function(done) {
        done();
    });

    afterEach(function(done) {
        done();
    });

    it('should be able to fetch a token', function() {

        // Get token
        return request
            .post('/token')
            // TODO: add to env var
            .set('Authorization', 'Basic ' + new Buffer(process.env.VDJ_SERVICE_ACCOUNT + ':' + process.env.VDJ_SERVICE_ACCOUNT_SECRET).toString('base64'))
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .expect(200)
            .then(function(response) {
                assert.isTrue(jsonApprover.isJSON(response.text));

                let result = JSON.parse(response.text).result;

                assert.strictEqual(result.token_type, 'bearer');

                assert.isString(result.access_token);
                assert.isTrue(result.refresh_token.length > 0);

                assert.isString(result.refresh_token);
                assert.isTrue(result.access_token.length > 0);

                assert.isNumber(result.expires_in);
                assert.isString(result.scope);
            })
            ;
    });

    it('should get an error for bad token fetch', function() {

        // Get token
        return request
            .post('/token')
            // TODO: add to env var
            .set('Authorization', 'Basic ' + new Buffer('myFancyUsername' + ':' + 'myFancyPassword').toString('base64'))
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .expect(401)
            .then(function(response) {
                assert.isTrue(jsonApprover.isJSON(response.text));

                let result = JSON.parse(response.text);

                assert.strictEqual(result.result, '');
                assert.isString(result.status);
                assert.isTrue(result.status.length > 0);
            })
            ;
    });

    it('should be able to refresh a token', function() {

        // Get token
        return request
            .post('/token')
            // TODO: add to env var
            .set('Authorization', 'Basic ' + new Buffer(process.env.VDJ_SERVICE_ACCOUNT + ':' + process.env.VDJ_SERVICE_ACCOUNT_SECRET).toString('base64'))
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .expect(200)
            .then(function(response) {
                assert.isTrue(jsonApprover.isJSON(response.text));

                let result = JSON.parse(response.text).result;

                return result;
            })
            .then(function(tokenResult) {
                return request
                    .put('/token')
                    .set('Authorization', 'Basic ' + new Buffer(process.env.VDJ_SERVICE_ACCOUNT + ':' + tokenResult.refresh_token).toString('base64'))
                    .set('Content-Type', 'application/x-www-form-urlencoded')
                    .expect(200)
                    .then(function(response) {
                        assert.isTrue(jsonApprover.isJSON(response.text));

                        let result = JSON.parse(response.text).result;

                        assert.strictEqual(result.token_type, 'bearer');

                        assert.isString(result.access_token);
                        assert.isTrue(result.refresh_token.length > 0);

                        assert.isString(result.refresh_token);
                        assert.isTrue(result.access_token.length > 0);

                        assert.isNumber(result.expires_in);
                        assert.isString(result.scope);
                    })
                    ;
            })
            ;
    });
});
