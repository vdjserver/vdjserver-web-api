
var AgaveResponseFixture = {};

module.exports = AgaveResponseFixture;

var refreshToken = "123456ABC";
var accessToken  = "BlitherinBarnacles111";
var tokenType    = "bearer";
var expiresIn    = 3600;

AgaveResponseFixture.success = {
    status: "success",
    message: "",
    version: "2.2.0-r8265",
    result: {
        refresh_token: refreshToken,
        access_token:  accessToken,
        token_type:    tokenType,
        expires_in:    expiresIn
    }
};
