
var InternalUserAuth = {};
module.exports = InternalUserAuth;


InternalUserAuth.schema = function() {
    this.internalUsername = "";
    this.token            = "";
    this.authUsername     = "";
    this.expires          = "";
};
