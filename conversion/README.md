# Conversion scripts

These are scripts for doing various conversion tasks. Many might be one-time tasks to
correct data curation errors, but we also anticipate major conversion when upgrading
to a new version of the AIRR schema.

Most of these scripts are designed to within the `vdj-api` docker image
with a valid `.env` file. The following bash alias simplifies
the docker command. It expects the `conversion` directory is your current directory.

Here is a convenient alias to use, you might need to change the tag for the `vdj-api` image.

```
alias vdj-airr='docker run -v $PWD:/work -v $PWD/../.env:/vdjserver-web-api/.env -it vdj-api:latest'
```

# Miscellaneous scripts

* `fix_species.py`: This script is to fix the species ontology ID in Subject metadata
  which is incorrect either because `NCBITaxon` is not all uppercase, or the ID
  is `9096` instead of `9606` for human.

To evaluate which metadata entries will be modified without doing the modification:

```
vdj-airr python3 /work/fix_species.py
```

To actually perform the modifications:

```
vdj-airr python3 /work/fix_species.py --convert
```

# AIRR Schema V1.3 to V1.4


