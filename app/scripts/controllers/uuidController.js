
// Controllers
var apiResponseController = require('./apiResponseController');

var UuidController = {};
module.exports = UuidController;


UuidController.getSchemataUuids = function(successResultMessage, response) {

    var uuidList = {
        profile: '0001383863967692-5056831b44-0001-013'
    };

    apiResponseController.sendSuccess(uuidList, response);
};
