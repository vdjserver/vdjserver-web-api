
var AgaveResponseFixture = {};

module.exports = AgaveResponseFixture;

AgaveResponseFixture.refreshToken = '123456ABC';
AgaveResponseFixture.accessToken  = 'BlitherinBarnacles111';
AgaveResponseFixture.tokenType    = 'bearer';
AgaveResponseFixture.expiresIn    = 3600;

AgaveResponseFixture.tokenSuccess = {
    refresh_token: AgaveResponseFixture.refreshToken,
    access_token:  AgaveResponseFixture.accessToken,
    token_type:    AgaveResponseFixture.tokenType,
    expires_in:    AgaveResponseFixture.expiresIn,
};

AgaveResponseFixture.createUserSuccess = {
    status: 'success',
    message: '',
    result: {
        'first_name':   '',
        'last_name':    'test128',
        'full_name':    'test128',
        'email': 'wscarbor@tacc.utexas.edu',
        'phone': '',
        'mobile_phone': '',
        'status':   'Active',
        'uid':      '',
        'username': 'test128',
    }
};

AgaveResponseFixture.createUserProfileSuccess = {
    'status':'success',
    'message':null,
    'version':'2.0.0-SNAPSHOT-r33a65',
    'result': {
        'uuid':'0001400786094352-5056a550b8-0001-012',
        'owner':'test129',
        'schemaId':null,
        'internalUsername':null,
        'associationIds':[],
        'lastUpdated':'2014-05-22T14:14:54.351-05:00',
        'name':'profile',
        'value': {
            'username':'test129',
            'email':'wscarbor@tacc.utexas.edu',
            'firstName':'Homer',
            'lastName':'Simpson',
            'city':'Austin',
            'state':'TX',
            'country':'USA',
            'affiliation':'University',
        },
        'created':'2014-05-22T14:14:54.351-05:00',
        '_links': {
            'self': {
                'href':'https://agave.iplantc.org/meta/v2/data/0001400786094352-5056a550b8-0001-012'
            }
        }
    }
};

AgaveResponseFixture.getUserProfileSuccess = {
    'status': 'success',
    'message': null,
    'version': '2.0.0-SNAPSHOT-r33a65',
    'result': [
        {
            'uuid': '0001400786094352-5056a550b8-0001-012',
            'owner': 'test129',
            'schemaId': null,
            'internalUsername': null,
            'associationIds': [],
            'lastUpdated': '2014-05-22T14:54:07.544-05:00',
            'name': 'profile',
            'value': {
                'firstName': 'Homer',
                'lastName': 'Simpson',
                'email': 'wscarbor@tacc.utexas.edu',
                'city': 'Austin',
                'state': 'TX',
                'country': 'USA',
                'affiliation': 'University'
            },
            'created': '2014-05-22T14:14:54.351-05:00',
            '_links': {
                'self': {
                    'href': 'https://agave.iplantc.org/meta/v2/data/0001400786094352-5056a550b8-0001-012'
                }
            }
        }
    ]
};

AgaveResponseFixture.createProjectSuccess = {
    'status': 'success',
    'message': null,
    'version': '2.0.0-SNAPSHOT-r33a65',
    'result': {
        'uuid': '0001400789295301-5056a550b8-0001-012',
        'owner': 'vdj',
        'schemaId': null,
        'internalUsername': null,
        'associationIds': [],
        'lastUpdated': '2014-05-22T15:08:15.300-05:00',
        'name': 'project',
        'value': {
            'name': 'Fancy Project'
        },
        'created': '2014-05-22T15:08:15.300-05:00',
        '_links': {
            'self': {
                'href': 'https://agave.iplantc.org/meta/v2/data/0001400789295301-5056a550b8-0001-012'
            }
        }
    }
};

AgaveResponseFixture.createProjectDirectorySuccess = {
    'status':'success',
    'message':null,
    'version':'2.0.0-SNAPSHOT-r16c6e',
    'result':{},
};

AgaveResponseFixture.addUsernameToMetadataPermissionsSuccess = {
    'status': 'success',
    'message': null,
    'version': '2.0.0-SNAPSHOT-r33a65',
    'result': {
        'username': 'wscarbor',
        'permission': {
            'read': true,
            'write': true
        },
        '_links': {
            'self': {
                'href': 'https://wso2-elb.tacc.utexas.edu/meta/v2/0001400791549491-5056a550b8-0001-012/pems/wscarbor'
            },
            'parent': {
                'href': 'https://wso2-elb.tacc.utexas.edu/meta/v2/0001400791549491-5056a550b8-0001-012'
            },
            'profile': {
                'href': 'https://wso2-elb.tacc.utexas.edu/meta/v2/wscarbor'
            }
        }
    }
};

AgaveResponseFixture.removeUsernameFromMetadataPermissionsSuccess = {
    'status': 'success',
    'message': null,
    'version': '2.0.0-SNAPSHOT-r33a65',
    'result': {},
};

AgaveResponseFixture.getMetadataPermissionsSuccess = {
    'status': 'success',
    'message': null,
    'version': '2.0.0-SNAPSHOT-r33a65',
    'result': [
        {
            'username': 'vdj',
            'permission': {
                'read': true,
                'write': true
            },
            '_links': {
                'self': {
                    'href': 'https://wso2-elb.tacc.utexas.edu/meta/v2/0001400791549491-5056a550b8-0001-012/pems/vdj'
                },
                'parent': {
                    'href': 'https://wso2-elb.tacc.utexas.edu/meta/v2/0001400791549491-5056a550b8-0001-012'
                },
                'profile': {
                    'href': 'https://wso2-elb.tacc.utexas.edu/meta/v2/vdj'
                }
            }
        },
        {
            'username': 'test129',
            'permission': {
                'read': true,
                'write': true
            },
            '_links': {
                'self': {
                    'href': 'https://wso2-elb.tacc.utexas.edu/meta/v2/0001400791549491-5056a550b8-0001-012/pems/test129'
                },
                'parent': {
                    'href': 'https://wso2-elb.tacc.utexas.edu/meta/v2/0001400791549491-5056a550b8-0001-012'
                },
                'profile': {
                    'href': 'https://wso2-elb.tacc.utexas.edu/meta/v2/test129'
                }
            }
        }
    ]
};

AgaveResponseFixture.getProjectFileMetadataPermissionsSuccess = {
    'status': 'success',
    'message': null,
    'version': '2.0.0-SNAPSHOT-r33a65',
    'result': [
        {
            'uuid': '0001398948143440-5056a550b8-0001-012',
            'owner': 'jfonner',
            'schemaId': null,
            'internalUsername': null,
            'associationIds': [
                '0001398948141848-5056a550b8-0001-002'
            ],
            'lastUpdated': '2014-05-01T07:42:23.333-05:00',
            'name': 'projectFile',
            'value': {
                'projectUuid': '0001398809349374-5056a550b8-0001-012',
                'fileCategory': 'uploaded',
                'name': 'emid_1_rev.fastq',
                'length': 4036,
                'mimeType': 'application/octet-stream'
            },
            'created': '2014-05-01T07:42:23.333-05:00',
            '_links': {
                'self': {
                    'href': 'https://agave.iplantc.org/meta/v2/data/0001398948143440-5056a550b8-0001-012'
                },
                'file': {
                    'href': 'https://wso2-elb.tacc.utexas.edu/files/v2/media/system/data.vdjserver.org//projects/0001398809349374-5056a550b8-0001-012/files/emid_1_rev.fastq'
                }
            }
        },
        {
            'uuid': '0001398948160731-5056a550b8-0001-012',
            'owner': 'jfonner',
            'schemaId': null,
            'internalUsername': null,
            'associationIds': [
                '0001398948159888-5056a550b8-0001-002'
            ],
            'lastUpdated': '2014-05-01T07:42:40.731-05:00',
            'name': 'projectFile',
            'value': {
                'projectUuid': '0001398809349374-5056a550b8-0001-012',
                'fileCategory': 'uploaded',
                'name': 'emid_1_frw.fastq',
                'length': 4036,
                'mimeType': 'application/octet-stream'
            },
            'created': '2014-05-01T07:42:40.731-05:00',
            '_links': {
                'self': {
                    'href': 'https://agave.iplantc.org/meta/v2/data/0001398948160731-5056a550b8-0001-012'
                },
                'file': {
                    'href': 'https://wso2-elb.tacc.utexas.edu/files/v2/media/system/data.vdjserver.org//projects/0001398809349374-5056a550b8-0001-012/files/emid_1_frw.fastq'
                }
            }
        },
        {
            'uuid': '0001399084333693-5056a550b8-0001-012',
            'owner': 'jfonner',
            'schemaId': null,
            'internalUsername': null,
            'associationIds': [
                '0001399084332093-5056a550b8-0001-002'
            ],
            'lastUpdated': '2014-05-02T21:32:13.692-05:00',
            'name': 'projectFile',
            'value': {
                'projectUuid': '0001398809349374-5056a550b8-0001-012',
                'fileCategory': 'uploaded',
                'name': 'emid1.fasta',
                'length': 75,
                'mimeType': 'application/octet-stream',
                'isDeleted': false
            },
            'created': '2014-05-02T21:32:13.692-05:00',
            '_links': {
                'self': {
                    'href': 'https://agave.iplantc.org/meta/v2/data/0001399084333693-5056a550b8-0001-012'
                },
                'file': {
                    'href': 'https://wso2-elb.tacc.utexas.edu/files/v2/media/system/data.vdjserver.org//projects/0001398809349374-5056a550b8-0001-012/files/emid1.fasta'
                }
            }
        }
    ]
};
