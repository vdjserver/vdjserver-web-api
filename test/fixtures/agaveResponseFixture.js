
var AgaveResponseFixture = {};

module.exports = AgaveResponseFixture;

AgaveResponseFixture.refreshToken = "123456ABC";
AgaveResponseFixture.accessToken  = "BlitherinBarnacles111";
AgaveResponseFixture.tokenType    = "bearer";
AgaveResponseFixture.expiresIn    = 3600;

AgaveResponseFixture.success = {
    status: "success",
    message: "",
    version: "2.2.0-r8265",
    result: {
        refresh_token: AgaveResponseFixture.refreshToken,
        access_token:  AgaveResponseFixture.accessToken,
        token_type:    AgaveResponseFixture.tokenType,
        expires_in:    AgaveResponseFixture.expiresIn
    }
};
