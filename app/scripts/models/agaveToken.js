
var AgaveToken = {};

AgaveToken.schema = function() {
    this.token_type    = "";
    this.expires_in    = "";
    this.refresh_token = "";
    this.access_token  = "";
};

module.exports = AgaveToken.schema;
