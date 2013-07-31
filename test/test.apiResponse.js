
// Controllers
var apiResponseController = require('../app/controllers/apiResponseController');

// Models
var ApiResponse = require('../app/models/apiResponse');


describe("apiResponse model functions", function() {

    var apiResponse = null;

    beforeEach(function(done) {
    
        apiResponse = new ApiResponse();

        done();
    });

    it("should change status to success when setSuccess is called", function() {
        apiResponse.setSuccess();
        apiResponse.status.should.equal('success');
        
        // NOTE should also check status codes...
    });

    it("should change status to error when setError is called", function() {
        apiResponse.setError();
        apiResponse.status.should.equal('error');
    });

});


describe("apiResponse controller functions", function() {


});