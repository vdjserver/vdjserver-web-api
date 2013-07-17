
// Models
var ApiResponse = require('../app/models/apiResponse');

describe("apiResponse", function() {

    var apiResponse = null;

    beforeEach(function(done) {
    
        apiResponse = new ApiResponse.schema();

        done();
    });

    it("should change status to success when setSuccess is called", function() {
        apiResponse.setSuccess();
        apiResponse.status.should.equal('success');
    });

    it("should change status to error when setError is called", function() {
        apiResponse.setError();
        apiResponse.status.should.equal('error');
    });

});
