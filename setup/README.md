# Setup VDJ API v2.0

# Setup clients for OAuth authentication

The OAuth redirect workflow requires clients to be defined and the redirect URL is part
of the client definition. Therefore, we need to create a client for each of the
different environments. The client ID needs to be defined in `environment-config.js`
for vdjserver-web-backbone so that the GUI constructs the correct redirect URL. That
client ID is also passed to the VDJ API to get a token after successful authentication.

TODO: update to use vdjserver python tool

To list the current clients:

```
curl -H "X-Tapis-Token: $JWT" https://vdjserver.tapis.io/v3/oauth2/clients
```

+ Production server (production)



+ Staging server (staging)

```
curl -H "X-Tapis-Token: $JWT" -H "Content-type: application/json" -d '{"client_id": "staging", "callback_url": "https://vdj-staging.tacc.utexas.edu/oauth2/callback"}' https://vdjserver.tapis.io/v3/oauth2/clients
```

+ Dev server (develop)

```
curl -H "X-Tapis-Token: $JWT" -H "Content-type: application/json" -d '{"client_id": "develop", "callback_url": "https://vdj-dev.tacc.utexas.edu/oauth2/callback"}' https://vdjserver.tapis.io/v3/oauth2/clients
```

+ Localhost at port 8080 (localhost8080)

```
curl -H "X-Tapis-Token: $JWT" -H "Content-type: application/json" -d '{"client_id": "localhost8080", "callback_url": "http://localhost:8080/oauth2/callback"}' https://vdjserver.tapis.io/v3/oauth2/clients
```

+ Localhost at port 9001

```
curl -H "X-Tapis-Token: $JWT" -H "Content-type: application/json" -d '{"client_id": "localhost9001", "callback_url": "http://localhost:9001/oauth2/callback"}' https://vdjserver.tapis.io/v3/oauth2/clients
```

# ADC Download Cache

```
curl http://localhost:8080/api/v2/adc/registry | jq
```

To manually insert/enable repositories in the cache.

iReceptor Public Archive has the following repositories:

+ IPA1
+ IPA2

```
curl --data @cache_ipa1_repository.json -H 'content-type:application/json' -H 'Authorization: Bearer TOKEN' http://localhost:8080/api/v2/adc/registry
curl --data @cache_ipa2_repository.json -H 'content-type:application/json' -H 'Authorization: Bearer TOKEN' http://localhost:8080/api/v2/adc/registry
curl --data @cache_ipa3_repository.json -H 'content-type:application/json' -H 'Authorization: Bearer TOKEN' http://localhost:8080/api/v2/adc/registry
curl --data @cache_ipa4_repository.json -H 'content-type:application/json' -H 'Authorization: Bearer TOKEN' http://localhost:8080/api/v2/adc/registry
curl --data @cache_ipa5_repository.json -H 'content-type:application/json' -H 'Authorization: Bearer TOKEN' http://localhost:8080/api/v2/adc/registry

curl --data @cache_covid19-1_repository.json -H 'content-type:application/json' -H 'Authorization: Bearer TOKEN' http://localhost:8080/api/v2/adc/registry
curl --data @cache_covid19-2_repository.json -H 'content-type:application/json' -H 'Authorization: Bearer TOKEN' http://localhost:8080/api/v2/adc/registry
curl --data @cache_covid19-3_repository.json -H 'content-type:application/json' -H 'Authorization: Bearer TOKEN' http://localhost:8080/api/v2/adc/registry
curl --data @cache_covid19-4_repository.json -H 'content-type:application/json' -H 'Authorization: Bearer TOKEN' http://localhost:8080/api/v2/adc/registry
```

# Tapis Meta V3 API

VDJServer V2 will run its own Mongo database, which may get converted to Postgresql at
some point, and Tapis Meta service points to it.

Why not connect directly to the database instead of going through the Tapis API? Primarily
for historical purposes as the DB was initially run and maintained by the TACC data group
as part of the VDJServer Repository for the AIRR Data Commons.

For VDJServer V2, we need a single collection to hold the Tapis V3 meta records.
If starting from a brand new database, there are setup steps. We rely upon the docker image
and a valid `.env` file for running many commands. The following bash alias simplifies
the docker command. It expects the `setup` directory is your current directory.

```
alias tapis-js='docker run -v $PWD:/work --env-file $PWD/../../.env -it vdjserver/vdj-tapis-js:latest'
```

# Authentication

For Tapis V3, get a token. Assign the access token to JWT environment variable for
curl commands below.

```
tapis-js node get_v3_token.js
export JWT=access_token
```

# Collections

A curl GET command will show all the collections in the database. Replace `DBNAME`
with the appropriate database, `v1test` is for testing while `v1airr` is the production database.

```
curl -X GET -H 'Content-Type: application/json' -H "X-Tapis-Token: $JWT" https://vdjserver.tapis.io/v3/meta/DBNAME
```

We create two collections, one for development/test and the other for production.

```
curl -X PUT -H 'Content-Type: application/json' -H "X-Tapis-Token: $JWT" https://vdjserver.tapis.io/v3/meta/v1test/tapis_meta
curl -X PUT -H 'Content-Type: application/json' -H "X-Tapis-Token: $JWT" https://vdjserver.tapis.io/v3/meta/v1airr/tapis_meta
```

# Indexes

Indexes are defined specifically for each collection. Indexes need to be deleted before
they can be updated, so each index should be managed separately as we don't want to
recreate all the indexes every time one changes.

To show the current set of indexes on a collection.

For Tapis V3:

```
curl -X GET -H 'Content-Type: application/json' -H "X-Tapis-Token: $JWT" https://vdjserver.tapis.io/v3/meta/DBNAME/rearrangement_change/_indexes | jq
```

The command to delete the `junction_suffixes` index.

For Tapis V3:

```
curl -X DELETE -H 'Content-Type: application/json' -H "X-Tapis-Token: $JWT" https://vdjserver.tapis.io/v3/meta/DBNAME/rearrangement_change/_indexes/junction_suffixes
```

## Tapis V3 Meta Indexes

* uuid

```
curl -X PUT --data @uuid_index.json -H 'Content-Type: application/json' -H "X-Tapis-Token: $JWT" https://vdjserver.tapis.io/v3/meta/DBNAME/rearrangement_change/_indexes/junction_suffixes
```

# Conversion from Tapis V2 to V3

We do the work in two stages. VDJServer V1 has a bunch of old and
incorrect meta records, so we don't want to bring these forward but
instead us the opportunity to clean up the data. First we bulk upload
the DB dump from Tapis V2 into a temporary collection, and second we
validate and copy the appropriate records into the main collection.


