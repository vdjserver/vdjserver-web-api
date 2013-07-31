
var TokenAuth = {};

TokenAuth.schema = function() {
    this.token            = "";
    this.username         = "";
    this.created          = "";
    this.expires          = "";
    this.renewed          = "";
    this.internalUsername = "";
    this.remainingUses    = "";
};

module.exports = TokenAuth.schema;
