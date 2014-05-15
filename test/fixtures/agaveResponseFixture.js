
var AgaveResponseFixture = {};

module.exports = AgaveResponseFixture;

AgaveResponseFixture.refreshToken = "123456ABC";
AgaveResponseFixture.accessToken  = "BlitherinBarnacles111";
AgaveResponseFixture.tokenType    = "bearer";
AgaveResponseFixture.expiresIn    = 3600;

AgaveResponseFixture.success = {
    refresh_token: AgaveResponseFixture.refreshToken,
    access_token:  AgaveResponseFixture.accessToken,
    token_type:    AgaveResponseFixture.tokenType,
    expires_in:    AgaveResponseFixture.expiresIn,
};
