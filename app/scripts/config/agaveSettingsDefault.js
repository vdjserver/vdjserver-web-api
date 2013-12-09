
/*
    How To Setup agaveSettings.js

    Replace the following empty parameter strings with appropriate Agave
    authenticated user credentials: authenticatedUser, authenticatedUserPassword.

    If you want to be able to run unit/integration tests, then also set
    the following with test internal user credentials: testInternalUser, testInternalUserPassword.
*/

module.exports = {

    // Auth Settings
    clientKey:    '',
    clientSecret: '',

    // API Settings
    hostname: '129.114.60.211',

    // Endpoints
    authEndpoint: '/token'
};
