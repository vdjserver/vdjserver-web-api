test:
	@./node_modules/.bin/mocha --ui tdd --reporter spec \
		--require should \
		--ui bdd \
		--reporter spec \
		--timeout 6s

.PHONY: test
