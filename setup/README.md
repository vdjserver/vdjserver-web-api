# Setup VDJ API v2.0

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

