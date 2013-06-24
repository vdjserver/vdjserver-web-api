test:
	@./node_modules/.bin/mocha --ui tdd --reporter spec \
		--require should \
		--ui bdd \
		--reporter spec

.PHONY: test
