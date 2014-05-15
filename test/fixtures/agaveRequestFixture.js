
var AgaveRequestFixture = {};

module.exports = AgaveRequestFixture;

AgaveRequestFixture.username  = 'testMartyMcfly';
AgaveRequestFixture.password  = 'abracadabra';
AgaveRequestFixture.accessToken  = 'newToken!';
AgaveRequestFixture.refreshToken = 'refreshToken!';
AgaveRequestFixture.email     = 'testMartyMcfly@delorean.com';
AgaveRequestFixture.firstName = 'Marty';
AgaveRequestFixture.lastName  = 'McFly';
AgaveRequestFixture.city      = 'Del Valle';
AgaveRequestFixture.state     = 'CA';

AgaveRequestFixture.passwordAuth = {
    username: AgaveRequestFixture.username,
    password: AgaveRequestFixture.password,
};

AgaveRequestFixture.accessTokenAuth = {
    username: AgaveRequestFixture.username,
    password: AgaveRequestFixture.accessToken,
};

AgaveRequestFixture.refreshTokenAuth = {
    username: AgaveRequestFixture.username,
    password: AgaveRequestFixture.refreshToken,
};
