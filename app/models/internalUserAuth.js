
var InternalUserAuth = {};
module.exports = InternalUserAuth;


InternalUserAuth.schema = function() {
    this.internalUsername = "";
    this.password         = "";
    this.token            = "";
    this.authUsername     = "";
    this.expires          = "";
};
