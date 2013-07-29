
var TokenAuth = {};
module.exports = TokenAuth;


TokenAuth.schema = function() {
    this.token            = "";
    this.username         = "";
    this.created          = "";
    this.expires          = "";
    this.renewed          = "";
    this.internalUsername = "";
    this.password         = "";
    this.remainingUses    = "";
};
