diff:
	yarn cdk --app "ts-node src/integ.default.ts" diff
synth:
	yarn cdk --app "ts-node src/integ.default.ts" synth --quiet
deploy:
	yarn cdk --app "ts-node src/integ.default.ts" deploy
destroy:
	yarn cdk --app "ts-node src/integ.default.ts" destroy
update_projen:
	npx projen
