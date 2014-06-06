
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

AgaveRequestFixture.projectName = 'Fancy Project';
AgaveRequestFixture.projectUuid = '0001400789295301-5056a550b8-0001-012';
AgaveRequestFixture.metadataUuid = '0001400789292222-5056a550b8-0001-222';
AgaveRequestFixture.jobId = '5056a550b834392Ab343';

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

AgaveRequestFixture.createUser = {
    username: 'newUser',
    password: 'newPassword',
    email: 'newEmail@newAddress.com',
};

AgaveRequestFixture.createUserProfile = {
    name: 'profile',
    value: {
        'username': 'test129',
        'email':    'wscarbor@tacc.utexas.edu',
        'firstName':'Homer',
        'lastName': 'Simpson',
        'city': 'Austin',
        'state':'TX',
        'country':    'USA',
        'affiliation':'University',
    }
};

AgaveRequestFixture.createProject = {
    name: 'project',
    value: {
        name: 'Fancy Project',
    },
};

AgaveRequestFixture.filePath = '123123123/myFile.fastq';
